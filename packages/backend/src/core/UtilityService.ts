/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { URL, domainToASCII } from 'node:url';
import { Inject, Injectable } from '@nestjs/common';
import RE2 from 're2';
import semver from 'semver';
import { DI } from '@/di-symbols.js';
import type { Config } from '@/config.js';
import { bindThis } from '@/decorators.js';
import { MiMeta, SoftwareSuspension } from '@/models/Meta.js';
import { MiInstance } from '@/models/Instance.js';

type KeywordMatcher =
	| { type: 'words'; words: string[] }
	| { type: 'regexp'; regexp: RE2 | null };

@Injectable()
export class UtilityService {
	private readonly hostSetCache = new WeakMap<string[], Set<string>>();
	private readonly keywordMatcherCache = new WeakMap<string[], KeywordMatcher[]>();

	constructor(
		@Inject(DI.config)
		private config: Config,

		@Inject(DI.meta)
		private meta: MiMeta,
	) {
	}

	private getHostSet(hosts: string[]): Set<string> {
		let set = this.hostSetCache.get(hosts);
		if (set == null) {
			set = new Set(hosts);
			this.hostSetCache.set(hosts, set);
		}
		return set;
	}

	private matchesHostOrParent(hosts: string[], host: string): boolean {
		const set = this.getHostSet(hosts);
		let candidate = host.toLowerCase();
		for (;;) {
			if (set.has(candidate)) return true;
			const separator = candidate.indexOf('.');
			if (separator < 0) return false;
			candidate = candidate.slice(separator + 1);
		}
	}

	private getKeywordMatchers(keyWords: string[]): KeywordMatcher[] {
		const cached = this.keywordMatcherCache.get(keyWords);
		if (cached) return cached;

		const regexpPattern = /^\/(.+)\/(.*)$/;
		const matchers = keyWords.map(filter => {
			const regexp = filter.match(regexpPattern);
			if (!regexp) return { type: 'words', words: filter.split(' ') } as const;
			try {
				return { type: 'regexp', regexp: new RE2(regexp[1], regexp[2]) } as const;
			} catch {
				return { type: 'regexp', regexp: null } as const;
			}
		});
		this.keywordMatcherCache.set(keyWords, matchers);
		return matchers;
	}

	@bindThis
	public getFullApAccount(username: string, host: string | null): string {
		return host ? `${username}@${this.toPuny(host)}` : `${username}@${this.toPuny(this.config.host)}`;
	}

	@bindThis
	public isSelfHost(host: string | null): boolean {
		if (host == null) return true;
		return this.toPuny(this.config.host) === this.toPuny(host);
	}

	@bindThis
	public isUriLocal(uri: string): boolean {
		return this.punyHost(uri) === this.toPuny(this.config.host);
	}

	// メールアドレスのバリデーションを行う
	// https://html.spec.whatwg.org/multipage/input.html#valid-e-mail-address
	@bindThis
	public validateEmailFormat(email: string): boolean {
		const regexp = /^[a-zA-Z0-9.!#$%&'*+\/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
		return regexp.test(email);
	}

	@bindThis
	public isBlockedHost(blockedHosts: string[], host: string | null): boolean {
		if (host == null) return false;
		return this.matchesHostOrParent(blockedHosts, host);
	}

	@bindThis
	public isSilencedHost(silencedHosts: string[] | undefined, host: string | null): boolean {
		if (!silencedHosts || host == null) return false;
		return this.matchesHostOrParent(silencedHosts, host);
	}

	@bindThis
	public isMediaSilencedHost(silencedHosts: string[] | undefined, host: string | null): boolean {
		if (!silencedHosts || host == null) return false;
		return this.getHostSet(silencedHosts).has(host.toLowerCase());
	}

	@bindThis
	public concatNoteContentsForKeyWordCheck(content: {
		cw?: string | null;
		text?: string | null;
		pollChoices?: string[] | null;
		others?: string[] | null;
	}): string {
		/**
		 * ノートの内容を結合してキーワードチェック用の文字列を生成する
		 * cwとtextは内容が繋がっているかもしれないので間に何も入れずにチェックする
		 */
		return `${content.cw ?? ''}${content.text ?? ''}\n${(content.pollChoices ?? []).join('\n')}\n${(content.others ?? []).join('\n')}`;
	}

	@bindThis
	public isKeyWordIncluded(text: string, keyWords: string[]): boolean {
		if (keyWords.length === 0) return false;
		if (text === '') return false;

		const matched = this.getKeywordMatchers(keyWords).some(matcher => {
			if (matcher.type === 'words') {
				return matcher.words.every(keyword => text.includes(keyword));
			}
			if (matcher.regexp == null) return false;
			// A newly-created RegExp/RE2 starts at index 0. Preserve that behavior
			// even for cached expressions using global/sticky flags.
			(matcher.regexp as unknown as { lastIndex: number }).lastIndex = 0;
			return matcher.regexp.test(text);
		});

		return matched;
	}

	@bindThis
	public extractDbHost(uri: string): string {
		const url = new URL(uri);
		return this.toPuny(url.host);
	}

	@bindThis
	public toPuny(host: string): string {
		return domainToASCII(host.toLowerCase());
	}

	@bindThis
	public toPunyNullable(host: string | null | undefined): string | null {
		if (host == null) return null;
		return domainToASCII(host.toLowerCase());
	}

	@bindThis
	public punyHost(url: string): string {
		const urlObj = new URL(url);
		const host = `${this.toPuny(urlObj.hostname)}${urlObj.port.length > 0 ? ':' + urlObj.port : ''}`;
		return host;
	}

	@bindThis
	public isFederationAllowedHost(host: string): boolean {
		if (this.isSelfHost(host)) return true;
		if (this.meta.federation === 'none') return false;
		if (this.meta.federation === 'specified' && !this.matchesHostOrParent(this.meta.federationHosts, host)) return false;
		if (this.isBlockedHost(this.meta.blockedHosts, host)) return false;

		return true;
	}

	@bindThis
	public isFederationAllowedUri(uri: string): boolean {
		const host = this.extractDbHost(uri);
		return this.isFederationAllowedHost(host);
	}

	@bindThis
	public isDeliverSuspendedSoftware(software: Pick<MiInstance, 'softwareName' | 'softwareVersion'>): SoftwareSuspension | undefined {
		if (software.softwareName == null) return undefined;
		if (software.softwareVersion == null) {
			// software version is null; suspend iff versionRange is *
			return this.meta.deliverSuspendedSoftware.find(x =>
				x.software === software.softwareName
				&& x.versionRange.trim() === '*');
		} else {
			const softwareVersion = software.softwareVersion;
			return this.meta.deliverSuspendedSoftware.find(x =>
				x.software === software.softwareName
				&& semver.satisfies(softwareVersion, x.versionRange, { includePrerelease: true }));
		}
	}
}
