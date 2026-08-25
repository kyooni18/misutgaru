#!/usr/bin/env node
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { diagnoseVuneSource, transformVuneSource } from '@vune-ui/compiler';

const roots = process.argv.slice(2);
if (roots.length === 0) roots.push('packages/frontend/src');

async function collect(target, output) {
	const stat = await import('node:fs/promises').then(fs => fs.stat(target));
	if (stat.isFile()) {
		if (/\.vune\.[cm]?[jt]sx?$/.test(target)) output.push(target);
		return;
	}
	for (const entry of await readdir(target, { withFileTypes: true })) {
		if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
		const child = path.join(target, entry.name);
		if (entry.isDirectory()) await collect(child, output);
		else if (/\.vune\.[cm]?[jt]sx?$/.test(entry.name)) output.push(child);
	}
}

const files = [];
for (const root of roots) await collect(path.resolve(root), files);
files.sort();

let failed = false;
let warnings = 0;
for (const file of files) {
	const source = await readFile(file, 'utf8');
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

if (failed) process.exitCode = 1;
else console.log(`Vune check passed: ${files.length} files${warnings ? `, ${warnings} warnings` : ''}.`);
