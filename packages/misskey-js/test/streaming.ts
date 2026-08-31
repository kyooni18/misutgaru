import { describe, test, expect, vi } from 'vitest';
import WS from 'vitest-websocket-mock';
import Stream from '../src/streaming.js';

describe('Streaming', () => {
	test('backs off when the server is unreachable', async () => {
		vi.useFakeTimers();
		let attempts = 0;
		let stream: Stream | undefined;

		class FailingWebSocket extends EventTarget {
			public static readonly CONNECTING = 0;
			public static readonly OPEN = 1;
			public static readonly CLOSING = 2;
			public static readonly CLOSED = 3;

			public binaryType: BinaryType = 'blob';
			public bufferedAmount = 0;
			public extensions = '';
			public protocol = '';
			public readyState = FailingWebSocket.CONNECTING;
			public readonly url: string;

			constructor(url: string) {
				super();
				this.url = url;
				attempts++;
				setTimeout(() => {
					this.readyState = FailingWebSocket.CLOSED;
					this.dispatchEvent(new Event('close'));
				}, 0);
			}

			public send(): void {}

			public close(): void {
				this.readyState = FailingWebSocket.CLOSED;
			}
		}

		try {
			stream = new Stream('https://misskey.test', null, {
				WebSocket: FailingWebSocket,
			});

			await vi.advanceTimersByTimeAsync(0);
			expect(attempts).toBe(1);

			await vi.advanceTimersByTimeAsync(999);
			expect(attempts).toBe(1);
		} finally {
			stream?.close();
			vi.useRealTimers();
		}
	});

	test('useChannel', async () => {
		const server = new WS('wss://misskey.test/streaming');
		const stream = new Stream('https://misskey.test', { token: 'TOKEN' });
		const mainChannelReceived: any[] = [];
		const main = stream.useChannel('main');
		main.on('meUpdated', payload => {
			mainChannelReceived.push(payload);
		});

		const ws = await server.connected;
		expect(new URLSearchParams(new URL(ws.url).search).get('i')).toEqual('TOKEN');

		const msg = JSON.parse(await server.nextMessage as string);
		const mainChannelId = msg.body.id;
		expect(msg.type).toEqual('connect');
		expect(msg.body.channel).toEqual('main');
		expect(mainChannelId != null).toEqual(true);

		server.send(JSON.stringify({
			type: 'channel',
			body: {
				id: mainChannelId,
				type: 'meUpdated',
				body: {
					id: 'foo'
				}
			}
		}));

		expect(mainChannelReceived[0]).toEqual({
			id: 'foo'
		});

		stream.close();
		server.close();
	});

	test('useChannel with parameters', async () => {
		const server = new WS('wss://misskey.test/streaming');
		const stream = new Stream('https://misskey.test', { token: 'TOKEN' });
		const chatChannelReceived: any[] = [];
		const chat = stream.useChannel('chat', { other: 'aaa' });
		chat.on('message', payload => {
			chatChannelReceived.push(payload);
		});

		const ws = await server.connected;
		expect(new URLSearchParams(new URL(ws.url).search).get('i')).toEqual('TOKEN');

		const msg = JSON.parse(await server.nextMessage as string);
		const chatChannelId = msg.body.id;
		expect(msg.type).toEqual('connect');
		expect(msg.body.channel).toEqual('chat');
		expect(msg.body.params).toEqual({ other: 'aaa' });
		expect(chatChannelId != null).toEqual(true);

		server.send(JSON.stringify({
			type: 'channel',
			body: {
				id: chatChannelId,
				type: 'message',
				body: {
					id: 'foo'
				}
			}
		}));

		expect(chatChannelReceived[0]).toEqual({
			id: 'foo'
		});

		stream.close();
		server.close();
	});

	test('ちゃんとチャンネルごとにidが異なる', async () => {
		const server = new WS('wss://misskey.test/streaming');
		const stream = new Stream('https://misskey.test', { token: 'TOKEN' });

		stream.useChannel('chat', { other: 'aaa' });
		stream.useChannel('chat', { other: 'bbb' });

		const ws = await server.connected;
		expect(new URLSearchParams(new URL(ws.url).search).get('i')).toEqual('TOKEN');

		const msg = JSON.parse(await server.nextMessage as string);
		const chatChannelId = msg.body.id;
		const msg2 = JSON.parse(await server.nextMessage as string);
		const chatChannelId2 = msg2.body.id;

		expect(chatChannelId != null).toEqual(true);
		expect(chatChannelId2 != null).toEqual(true);
		expect(chatChannelId).not.toEqual(chatChannelId2);

		stream.close();
		server.close();
	});

	test('Connection#send', async () => {
		const server = new WS('wss://misskey.test/streaming');
		const stream = new Stream('https://misskey.test', { token: 'TOKEN' });

		const chat = stream.useChannel('chat', { other: 'aaa' });
		chat.send('read', { id: 'aaa' });

		const ws = await server.connected;
		expect(new URLSearchParams(new URL(ws.url).search).get('i')).toEqual('TOKEN');

		const connectMsg = JSON.parse(await server.nextMessage as string);
		const channelId = connectMsg.body.id;
		const msg = JSON.parse(await server.nextMessage as string);

		expect(msg.type).toEqual('ch');
		expect(msg.body.id).toEqual(channelId);
		expect(msg.body.type).toEqual('read');
		expect(msg.body.body).toEqual({ id: 'aaa' });

		stream.close();
		server.close();
	});

	test('Connection#dispose', async () => {
		const server = new WS('wss://misskey.test/streaming');
		const stream = new Stream('https://misskey.test', { token: 'TOKEN' });
		const mainChannelReceived: any[] = [];
		const main = stream.useChannel('main');
		main.on('meUpdated', payload => {
			mainChannelReceived.push(payload);
		});

		const ws = await server.connected;
		expect(new URLSearchParams(new URL(ws.url).search).get('i')).toEqual('TOKEN');

		const msg = JSON.parse(await server.nextMessage as string);
		const mainChannelId = msg.body.id;
		expect(msg.type).toEqual('connect');
		expect(msg.body.channel).toEqual('main');
		expect(mainChannelId != null).toEqual(true);
		main.dispose();

		server.send(JSON.stringify({
			type: 'channel',
			body: {
				id: mainChannelId,
				type: 'meUpdated',
				body: {
					id: 'foo'
				}
			}
		}));

		expect(mainChannelReceived.length).toEqual(0);

		stream.close();
		server.close();
	});

	// TODO: SharedConnection#dispose して一定時間経ったら disconnect メッセージがサーバーに送られてくるかのテスト

	// TODO: チャンネル接続が使いまわされるかのテスト
});
