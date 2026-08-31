#!/usr/bin/env node
/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { diagnoseVuneSource, transformVuneSource } from '@vune-ui/compiler';

const roots = process.argv.slice(2);
if (roots.length === 0) roots.push('packages/frontend/src');

async function collect(target, output, vueOutput) {
	const stat = await import('node:fs/promises').then(fs => fs.stat(target));
	if (stat.isFile()) {
		if (/\.vune(?:\.[cm]?[jt]sx?)?$/.test(target)) output.push(target);
		else if (/\.vue$/.test(target)) vueOutput.push(target);
		return;
	}
	for (const entry of await readdir(target, { withFileTypes: true })) {
		if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
		const child = path.join(target, entry.name);
		if (entry.isDirectory()) await collect(child, output, vueOutput);
		else if (/\.vune(?:\.[cm]?[jt]sx?)?$/.test(entry.name)) output.push(child);
		else if (/\.vue$/.test(entry.name)) vueOutput.push(child);
	}
}

const files = [];
const vueFiles = [];
for (const root of roots) await collect(path.resolve(root), files, vueFiles);
files.sort();
vueFiles.sort();

let failed = false;
let warnings = 0;
for (const file of files) {
	const source = await readFile(file, 'utf8');
	if (/\bcreateVuneComponent\b/.test(source)) {
		console.error(`${path.relative(process.cwd(), file)}: error VUNE_LEGACY_FACTORY: .vune sources must use struct ...: View authoring; keep Vue placement only at an explicit host boundary.`);
		failed = true;
	}
	const diagnostics = diagnoseVuneSource(source);
	for (const diagnostic of diagnostics) {
		const label = path.relative(process.cwd(), file);
		console.error(`${label}:${diagnostic.line}:${diagnostic.column} ${diagnostic.severity} ${diagnostic.code}: ${diagnostic.message}`);
		if (diagnostic.severity === 'error') failed = true;
		else warnings += 1;
	}
	try {
		const output = transformVuneSource(source, file);
		if (!output || typeof output !== 'string') {
			console.error(`${path.relative(process.cwd(), file)}: compiler returned no output`);
			failed = true;
		}
	} catch (error) {
		console.error(`${path.relative(process.cwd(), file)}: compiler failed: ${error instanceof Error ? error.message : String(error)}`);
		failed = true;
	}
}

for (const file of vueFiles) {
	const source = await readFile(file, 'utf8');
	const template = /<template[^>]*>([\s\S]*?)<\/template>/.exec(source)?.[1] ?? '';
	for (const match of source.matchAll(/import\s+([A-Za-z_$][\w$]*)\s+from\s+['"]([^'"]+\.vune)['"];?/g)) {
		const component = match[1];
		const module = match[2];
		const explicitHost = new RegExp(`create(?:VuneWebHost|VuneVueHost|PageVuneWebHost)\\s*\\(\\s*${component}\\b`).test(source);
		if (explicitHost) continue;
		const directTemplatePlacement = new RegExp(`<${component}(?:\\s|/|>)`).test(template);
		const directDefaultExport = new RegExp(`export\\s+default\\s+${component}\\s*;`).test(source);
		if (!directTemplatePlacement && !directDefaultExport) continue;
		console.error(`${path.relative(process.cwd(), file)}: error VUNE_RAW_VUE_PLACEMENT: ${component} imports ${module} as a raw Vune constructor. Use ${module}?vue-host or an explicit Vune host adapter before exposing it to Vue.`);
		failed = true;
	}
}

if (failed) process.exitCode = 1;
else console.log(`Vune check passed: ${files.length} files${warnings ? `, ${warnings} warnings` : ''}.`);
