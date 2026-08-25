/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { EventEmitter } from 'node:events';
import { Inject, Injectable } from '@nestjs/common';
import * as Redis from 'ioredis';
import * as WebSocket from 'ws';
import { DI } from '@/di-symbols.js';
import type { MiAccessToken } from '@/models/_.js';
import { bindThis } from '@/decorators.js';
import { parseRedisStreamEvent } from '@/misc/redis-event.js';
import { MiLocalUser } from '@/models/User.js';
import { UserService } from '@/core/UserService.js';
import { AuthenticateService, AuthenticationError } from './AuthenticateService.js';
import MainStreamConnection, { ConnectionRequest } from './stream/Connection.js';
import type * as http from 'node:http';
import { ContextIdFactory, ModuleRef } from '@nestjs/core';

type EventListener = (...args: any[]) => void;

const STREAM_USER_STATE_REFRESH_INTERVAL = 10_000;
const ACTIVE_USER_UPDATE_INTERVAL = 1000 * 60 * 5;
const ACTIVE_USER_SCHEDULER_INTERVAL = 1000;

type ActiveUser = {
	user: MiLocalUser;
	streams: Set<MainStreamConnection>;
	nextStateRefreshAt: number;
	nextLastActiveUpdateAt: number;
	refreshing: boolean;
};

/**
 * Per-WebSocket subscription scope backed by the shared stream emitter.
 * This avoids allocating an EventEmitter per connection while still allowing
 * deterministic cleanup of every listener owned by the connection.
 */
class StreamSubscriptionScope {
	private readonly listeners: Array<string | EventListener> = [];

	constructor(private readonly emitter: EventEmitter) {}

	public on(event: string, listener: EventListener): this {
		this.emitter.on(event, listener);
		this.listeners.push(event, listener);
		return this;
	}

	public off(event: string, listener: EventListener): this {
		this.emitter.off(event, listener);
		for (let i = this.listeners.length - 2; i >= 0; i -= 2) {
			if (this.listeners[i] === event && this.listeners[i + 1] === listener) {
				this.listeners.splice(i, 2);
				break;
			}
		}
		return this;
	}

	public dispose(): void {
		for (let i = 0; i < this.listeners.length; i += 2) {
			this.emitter.off(this.listeners[i] as string, this.listeners[i + 1] as EventListener);
		}
		this.listeners.length = 0;
	}
}

@Injectable()
export class StreamingApiServerService {
	#wss: WebSocket.WebSocketServer;
	#connections = new Map<WebSocket.WebSocket, number>();
	#streamEvents = new EventEmitter();
	#activeUsers = new Map<MiLocalUser['id'], ActiveUser>();
	#activeUserSchedulerIntervalId: NodeJS.Timeout | null = null;
	#cleanConnectionsIntervalId: NodeJS.Timeout | null = null;

	constructor(
		@Inject(DI.redisForSub)
		private redisForSub: Redis.Redis,

		private moduleRef: ModuleRef,
		private authenticateService: AuthenticateService,
		private usersService: UserService,
	) {
		// A channel can legitimately have many websocket subscribers.
		this.#streamEvents.setMaxListeners(0);
	}

	@bindThis
	private onRedisMessage(_: string, data: string): void {
		let parsed: ReturnType<typeof parseRedisStreamEvent>;
		try {
			parsed = parseRedisStreamEvent(data);
		} catch {
			return;
		}

		if (typeof parsed.channel !== 'string') return;
		// Dispatch directly to listeners of the actual stream channel instead of
		// forwarding every Redis event through every websocket connection.
		this.#streamEvents.emit(parsed.channel, parsed.message);
	}

	private ensureActiveUserScheduler(): void {
		if (this.#activeUserSchedulerIntervalId != null) return;
		this.#activeUserSchedulerIntervalId = setInterval(() => this.refreshActiveUsers(), ACTIVE_USER_SCHEDULER_INTERVAL);
	}

	private stopActiveUserSchedulerIfIdle(): void {
		if (this.#activeUsers.size !== 0 || this.#activeUserSchedulerIntervalId == null) return;
		clearInterval(this.#activeUserSchedulerIntervalId);
		this.#activeUserSchedulerIntervalId = null;
	}

	private refreshActiveUsers(): void {
		const now = Date.now();
		for (const active of this.#activeUsers.values()) {
			if (now >= active.nextLastActiveUpdateAt) {
				active.nextLastActiveUpdateAt = now + ACTIVE_USER_UPDATE_INTERVAL;
				void this.usersService.updateLastActiveDate(active.user).catch(() => undefined);
			}

			if (active.refreshing || now < active.nextStateRefreshAt) continue;
			const primary = active.streams.values().next().value as MainStreamConnection | undefined;
			if (primary == null) continue;

			active.nextStateRefreshAt = now + STREAM_USER_STATE_REFRESH_INTERVAL;
			active.refreshing = true;
			void primary.fetch().then(state => {
				if (state == null) return;
				for (const stream of active.streams) {
					if (stream !== primary) stream.applyUserState(state);
				}
			}).catch(() => {
				// A transient cache/database failure should not terminate the scheduler.
			}).finally(() => {
				active.refreshing = false;
			});
		}
	}

	private acquireActiveUser(user: MiLocalUser, stream: MainStreamConnection): void {
		const active = this.#activeUsers.get(user.id);
		if (active) {
			active.streams.add(stream);
			return;
		}

		const now = Date.now();
		this.#activeUsers.set(user.id, {
			user,
			streams: new Set([stream]),
			nextStateRefreshAt: now + STREAM_USER_STATE_REFRESH_INTERVAL,
			nextLastActiveUpdateAt: now + ACTIVE_USER_UPDATE_INTERVAL,
			refreshing: false,
		});
		this.ensureActiveUserScheduler();
		void this.usersService.updateLastActiveDate(user).catch(() => undefined);
	}

	private releaseActiveUser(userId: MiLocalUser['id'], stream: MainStreamConnection): void {
		const active = this.#activeUsers.get(userId);
		if (!active) return;
		active.streams.delete(stream);
		if (active.streams.size > 0) return;
		this.#activeUsers.delete(userId);
		this.stopActiveUserSchedulerIfIdle();
	}

	@bindThis
	public attach(server: http.Server): void {
		this.#wss = new WebSocket.WebSocketServer({
			noServer: true,
		});

		server.on('upgrade', async (request, socket, head) => {
			if (request.url == null) {
				socket.write('HTTP/1.1 400 Bad Request\r\n\r\n');
				socket.destroy();
				return;
			}

			const q = new URL(request.url, `http://${request.headers.host}`).searchParams;

			let user: MiLocalUser | null = null;
			let app: MiAccessToken | null = null;

			// https://datatracker.ietf.org/doc/html/rfc6750.html#section-2.1
			// Note that the standard WHATWG WebSocket API does not support setting any headers,
			// but non-browser apps may still be able to set it.
			const token = request.headers.authorization?.startsWith('Bearer ')
				? request.headers.authorization.slice(7)
				: q.get('i');

			try {
				[user, app] = await this.authenticateService.authenticate(token);

				if (app !== null && !app.permission.some(p => p === 'read:account')) {
					throw new AuthenticationError('Your app does not have necessary permissions to use websocket API.');
				}
			} catch (e) {
				if (e instanceof AuthenticationError) {
					socket.write([
						'HTTP/1.1 401 Unauthorized',
						'WWW-Authenticate: Bearer realm="Misskey", error="invalid_token", error_description="Failed to authenticate"',
					].join('\r\n') + '\r\n\r\n');
				} else {
					socket.write('HTTP/1.1 500 Internal Server Error\r\n\r\n');
				}
				socket.destroy();
				return;
			}

			if (user?.isSuspended) {
				socket.write('HTTP/1.1 403 Forbidden\r\n\r\n');
				socket.destroy();
				return;
			}

			const contextId = ContextIdFactory.create();
			this.moduleRef.registerRequestByContextId<ConnectionRequest>({
				user,
				token: app,
			}, contextId);
			const stream = await this.moduleRef.create(MainStreamConnection, contextId);

			await stream.init();

			this.#wss.handleUpgrade(request, socket, head, (ws) => {
				this.#wss.emit('connection', ws, request, {
					stream, user, app,
				});
			});
		});

		this.redisForSub.on('message', this.onRedisMessage);

		this.#wss.on('connection', async (connection: WebSocket.WebSocket, request: http.IncomingMessage, ctx: {
			stream: MainStreamConnection,
			user: MiLocalUser | null;
			app: MiAccessToken | null
		}) => {
			const { stream, user } = ctx;
			const subscriptions = new StreamSubscriptionScope(this.#streamEvents);

			// Connection only uses on/off, so the lightweight subscription scope is a
			// drop-in EventEmitter surface without per-connection emitter fan-out.
			await stream.listen(subscriptions as unknown as EventEmitter, connection);

			this.#connections.set(connection, Date.now());
			if (user) this.acquireActiveUser(user, stream);

			connection.once('close', () => {
				stream.dispose();
				subscriptions.dispose();
				this.#connections.delete(connection);
				if (user) this.releaseActiveUser(user.id, stream);
			});

			connection.on('pong', () => {
				this.#connections.set(connection, Date.now());
			});
		});

		// 一定期間通信が無いコネクションは実際には切断されている可能性があるため定期的にterminateする
		this.#cleanConnectionsIntervalId = setInterval(() => {
			const now = Date.now();
			for (const [connection, lastActive] of this.#connections.entries()) {
				if (now - lastActive > 1000 * 60 * 2) {
					connection.terminate();
					this.#connections.delete(connection);
				} else {
					connection.ping();
				}
			}
		}, 1000 * 60);
	}

	@bindThis
	public detach(): Promise<void> {
		this.redisForSub.off('message', this.onRedisMessage);
		// ws.Server#close waits for upgraded clients. Terminate owned sockets first
		// so application shutdown cannot be held open by idle browser connections.
		for (const connection of this.#connections.keys()) connection.terminate();
		this.#connections.clear();
		this.#activeUsers.clear();
		if (this.#activeUserSchedulerIntervalId != null) {
			clearInterval(this.#activeUserSchedulerIntervalId);
			this.#activeUserSchedulerIntervalId = null;
		}
		this.#streamEvents.removeAllListeners();
		if (this.#cleanConnectionsIntervalId) {
			clearInterval(this.#cleanConnectionsIntervalId);
			this.#cleanConnectionsIntervalId = null;
		}
		return new Promise((resolve) => {
			this.#wss.close(() => resolve());
		});
	}
}
