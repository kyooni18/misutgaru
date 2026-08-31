#!/usr/bin/env node
/* SPDX-License-Identifier: AGPL-3.0-only */
import { rm, mkdir, symlink, stat } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import path from 'node:path';
import process from 'node:process';

const root = path.resolve(import.meta.dirname, '..');
const vune = path.join(root, 'packages/modules/Vune');

async function requireFile(file, hint) {
	try {
		const info = await stat(file);
		if (info.isFile()) return;
	} catch {}
	throw new Error(`${hint}: ${path.relative(root, file)} is missing`);
}

function run(command, args, cwd = root) {
	return new Promise((resolve, reject) => {
		const child = spawn(command, args, {
			cwd,
			stdio: 'inherit',
			env: process.env,
		});
		child.on('error', reject);
		child.on('exit', code => code === 0 ? resolve() : reject(new Error(`${command} ${args.join(' ')} exited with ${code}`)));
	});
}

await requireFile(path.join(vune, 'package.json'), 'Vune submodule is not initialized');
await requireFile(path.join(vune, 'pnpm-lock.yaml'), 'Vune lockfile is missing');
await requireFile(path.join(vune, 'packages/animation/package.json'), 'Vune animation package is missing');

const pnpm = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';
if (!process.argv.includes('--skip-install')) {
	await run(pnpm, ['install', '--frozen-lockfile'], vune);
}

await run(pnpm, ['run', 'build'], vune);

// The outer Misskey workspace intentionally keeps Vune as local link dependencies.
// Reassert those links after the nested workspace install so clean/container builds
// cannot leave a stale or missing renderer package behind.
const frontendNodeModules = path.join(root, 'packages/frontend/node_modules');
const localFrontendPackages = [
	['@vune-ui/animation', 'packages/modules/Vune/packages/animation'],
	['@vune-ui/core', 'packages/modules/Vune/packages/core'],
	['@vune-ui/compiler', 'packages/modules/Vune/packages/compiler'],
	['@vune-ui/vite', 'packages/modules/Vune/packages/vite'],
	['@vune-ui/vue', 'packages/modules/Vune/packages/vue'],
	['@vune-ui/web', 'packages/modules/Vune/packages/web'],
	['vune-ui', 'packages/modules/Vune'],
];
for (const [name, relativeTarget] of localFrontendPackages) {
	const link = path.join(frontendNodeModules, name);
	await mkdir(path.dirname(link), { recursive: true });
	await rm(link, { recursive: true, force: true });
	const linkTarget = path.relative(path.dirname(link), path.join(root, relativeTarget)) || '.';
	await symlink(linkTarget, link, process.platform === 'win32' ? 'junction' : 'dir');
}
console.log('Local Vune modules, including @vune-ui/animation, are ready.');
