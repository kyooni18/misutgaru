#!/usr/bin/env node
/* SPDX-License-Identifier: AGPL-3.0-only */
import { readFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const marker = '@misutgaru-vune-native';
const roots = process.argv.slice(2);
if (roots.length === 0) roots.push('packages/frontend/src');

async function collect(target, output) {
	const info = await stat(target);
	if (info.isFile()) {
		if (/\.vune(?:\.[cm]?[jt]sx?)?$/.test(target)) output.push(target);
		return;
	}
	for (const entry of await readdir(target, { withFileTypes: true })) {
		if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
		const child = path.join(target, entry.name);
		if (entry.isDirectory()) await collect(child, output);
		else if (/\.vune(?:\.[cm]?[jt]sx?)?$/.test(entry.name)) output.push(child);
	}
}

const candidates = [];
for (const root of roots) await collect(path.resolve(root), candidates);
candidates.sort();

const forbidden = [
	{ label: '@vune-ui/vue import', pattern: /from\s+['"]@vune-ui\/vue['"]/g },
	{ label: 'legacy Vune/Vue bridge import', pattern: /from\s+['"]@\/vune\/vue\.js['"]/g },
	{ label: 'legacy Vue host import', pattern: /from\s+['"]@\/vune\/compat-vue\.js['"]/g },
	{ label: 'Misutgaru native HTML bridge import', pattern: /from\s+['"]@\/vune\/native\.js['"]/g },
	{ label: 'VueComponent fallback', pattern: /\bVueComponent\s*\(/g },
	{ label: 'VueSlot fallback', pattern: /\bVueSlot\s*\(/g },
	{ label: 'raw Element primitive', pattern: /\bElement\s*\(/g },
	{ label: 'non-SwiftUI Box primitive', pattern: /\bBox\s*\(/g },
	{ label: 'unrestricted nativeElement escape hatch', pattern: /\bnativeElement\s*\(/g },
	{ label: 'direct viewElement host construction', pattern: /\bviewElement\s*\(/g },
	{ label: 'legacy createVuneComponent factory', pattern: /\bcreateVuneComponent\b/g },
	{ label: 'legacy NativeVuneFactory API', pattern: /\bNativeVuneFactory\b/g },
	{ label: 'legacy nativeWebDecoration adapter', pattern: /\bnativeWebDecoration\b/g },
	{ label: 'Vue placement host leaked into native source', pattern: /\bcreateVuneWebHost\b/g },
	{ label: '.vue dependency in native Vune source', pattern: /from\s+['"][^'"]+\.vue['"]/g },
	{ label: 'function-style component binding', pattern: /\bconst\s+(?:render|view|component)\b/g },
];

let marked = 0;
let failed = false;
for (const file of candidates) {
	const source = await readFile(file, 'utf8');
	marked += source.includes(marker) ? 1 : 0;
	const label = path.relative(process.cwd(), file);
	if (!/\bexport\s+struct\s+[A-Za-z_$][\w$]*(?:\s*<[^>{}]+>)?\s*:\s*View\b/.test(source)) {
		console.error(`${label}: native Vune violation: missing exported struct ...: View`);
		failed = true;
	}
	if (!/\bvar\s+body\s*:\s*some\s+View\b/.test(source)) {
		console.error(`${label}: native Vune violation: missing var body: some View`);
		failed = true;
	}
	for (const rule of forbidden) {
		rule.pattern.lastIndex = 0;
		let match;
		while ((match = rule.pattern.exec(source)) !== null) {
			const prefix = source.slice(0, match.index);
			const line = prefix.split('\n').length;
			console.error(`${label}:${line}: native Vune violation: ${rule.label}`);
			failed = true;
		}
	}
}

if (marked === 0) {
	console.error(`No ${marker} files found.`);
	process.exitCode = 1;
} else if (failed) {
	process.exitCode = 1;
} else {
	console.log(`Native Vune boundary check passed: ${marked} files.`);
}
