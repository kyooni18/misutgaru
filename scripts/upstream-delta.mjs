#!/usr/bin/env node
/* SPDX-License-Identifier: AGPL-3.0-only */
import { createHash } from 'node:crypto';
import { readFile, readdir, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const root = path.resolve(import.meta.dirname, '..');
const ignored = new Set(['.git', '.pi', 'node_modules', '.pnpm-store', 'built', 'build', 'dist', 'coverage', 'storybook-static']);

function argument(name) {
	const index = process.argv.indexOf(name);
	return index >= 0 ? process.argv[index + 1] : undefined;
}

async function exists(target) {
	try { return (await stat(target)).isDirectory(); } catch { return false; }
}

async function collect(base, dir = base, output = new Map()) {
	for (const entry of await readdir(dir, { withFileTypes: true })) {
		if (entry.isDirectory() && ignored.has(entry.name)) continue;
		const absolute = path.join(dir, entry.name);
		if (entry.isDirectory()) {
			await collect(base, absolute, output);
			continue;
		}
		if (!entry.isFile()) continue;
		const relative = path.relative(base, absolute).split(path.sep).join('/');
		const content = await readFile(absolute);
		output.set(relative, createHash('sha256').update(content).digest('hex'));
	}
	return output;
}

let upstream = argument('--upstream') ?? process.env.MISSKEY_UPSTREAM;
if (!upstream) {
	for (const candidate of [path.resolve(root, '../misskey-develop'), path.resolve(root, '../../misskey-develop')]) {
		if (await exists(candidate)) { upstream = candidate; break; }
	}
}
if (!upstream) {
	console.error('Usage: pnpm upstream:delta -- --upstream /path/to/misskey');
	process.exit(2);
}
upstream = path.resolve(upstream);
if (!await exists(upstream)) {
	console.error(`Upstream directory does not exist: ${upstream}`);
	process.exit(2);
}

const [currentFiles, upstreamFiles] = await Promise.all([collect(root), collect(upstream)]);
const added = [];
const modified = [];
const removed = [];
const same = [];

for (const [file, hash] of currentFiles) {
	if (!upstreamFiles.has(file)) added.push(file);
	else if (upstreamFiles.get(file) === hash) same.push(file);
	else modified.push(file);
}
for (const file of upstreamFiles.keys()) {
	if (!currentFiles.has(file)) removed.push(file);
}
for (const list of [added, modified, removed, same]) list.sort();

const base = JSON.parse(await readFile(path.join(root, 'UPSTREAM_BASE.json'), 'utf8'));
const summary = {
	base,
	upstreamPath: upstream,
	counts: {
		same: same.length,
		modified: modified.length,
		added: added.length,
		removed: removed.length,
	},
	added,
	modified,
	removed,
};

const writeTarget = argument('--write');
if (writeTarget) {
	const target = path.resolve(root, writeTarget);
	const lines = [
		'# Upstream delta',
		'',
		`Base: ${base.repository} ${base.ref} / ${base.version}`,
		`Snapshot date: ${base.snapshotDate}`,
		`Commit: ${base.commit ?? 'unknown in supplied archive'}`,
		'',
		`Same: ${same.length}`,
		`Modified: ${modified.length}`,
		`Added: ${added.length}`,
		`Removed: ${removed.length}`,
		'',
		'## Modified',
		...modified.map(file => `- ${file}`),
		'',
		'## Added',
		...added.map(file => `- ${file}`),
		'',
		'## Removed',
		...removed.map(file => `- ${file}`),
		'',
	];
	await writeFile(target, lines.join('\n'));
	console.log(`Wrote ${path.relative(root, target)}`);
}

if (process.argv.includes('--json')) console.log(JSON.stringify(summary, null, 2));
else console.log(`Upstream delta: ${same.length} same, ${modified.length} modified, ${added.length} added, ${removed.length} removed.`);
