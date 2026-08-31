#!/usr/bin/env node
/* SPDX-License-Identifier: AGPL-3.0-only */
import { readFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const root = path.resolve(import.meta.dirname, '..');
const ignoredDirs = new Set([
	'.git',
	'.pi',
	'node_modules',
	'.pnpm-store',
	'built',
	'build',
	'storybook-static',
	'coverage',
	'dist',
]);
const textExtensions = new Set([
	'', '.c', '.cc', '.css', '.d.ts', '.graphql', '.h', '.html', '.js', '.json', '.jsx',
	'.md', '.mjs', '.mts', '.scss', '.sh', '.sql', '.svg', '.toml', '.ts', '.tsx', '.txt',
	'.vue', '.vune', '.yaml', '.yml',
]);
const conflictPattern = /^(<<<<<<<(?: .*)?|=======$|>>>>>>> .*)$/m;
const failures = [];
let scannedFiles = 0;

async function walk(dir) {
	for (const entry of await readdir(dir, { withFileTypes: true })) {
		if (entry.isDirectory() && ignoredDirs.has(entry.name)) continue;
		const file = path.join(dir, entry.name);
		if (entry.isDirectory()) {
			await walk(file);
			continue;
		}
		if (!entry.isFile()) continue;
		const ext = path.extname(entry.name);
		if (!textExtensions.has(ext) && !entry.name.startsWith('.')) continue;
		let source;
		try {
			source = await readFile(file, 'utf8');
		} catch {
			continue;
		}
		scannedFiles += 1;
		if (source.includes('\0')) continue;
		if (conflictPattern.test(source)) {
			failures.push(`${path.relative(root, file)} contains an unresolved merge marker`);
		}
	}
}

async function readJson(relative) {
	const file = path.join(root, relative);
	try {
		return JSON.parse(await readFile(file, 'utf8'));
	} catch (error) {
		failures.push(`${relative} is not valid JSON: ${error.message}`);
		return null;
	}
}

async function requirePackage(relative, expectedName) {
	const packageJson = await readJson(path.join(relative, 'package.json'));
	if (!packageJson) return null;
	if (packageJson.name !== expectedName) failures.push(`${relative}/package.json must declare ${expectedName}`);
	return packageJson;
}

await walk(root);

const rootPackage = await readJson('package.json');
const frontendPackage = await readJson('packages/frontend/package.json');
const backendPackage = await readJson('packages/backend/package.json');
const misutgaruCorePackage = await requirePackage('packages/misutgaru-core', '@misutgaru/core');
const vunePackage = await requirePackage('packages/modules/Vune', 'vune-ui');
const animationPackage = await requirePackage('packages/modules/Vune/packages/animation', '@vune-ui/animation');
const dbInvariant = await readJson('scripts/db-schema-invariant.json');
if (dbInvariant) {
	if (dbInvariant.scope?.migrations !== 'packages/backend/migration/**') failures.push('DB invariant must fingerprint the vanilla migration tree');
	if (dbInvariant.scope?.entityModels !== 'packages/backend/src/models/*.ts') failures.push('DB invariant must fingerprint TypeORM entity models');
	if (dbInvariant.scope?.entityUtilities !== 'packages/backend/src/models/util/**') failures.push('DB invariant must include schema-shaping model utilities such as models/util/id.ts');
	if (dbInvariant.scope?.decoratedBackendSources !== 'packages/backend/src/**/*.ts containing TypeORM schema decorators') failures.push('DB invariant must discover TypeORM-decorated backend sources outside the historical models directory');
	if (dbInvariant.scope?.entityRegistry !== 'packages/backend/src/postgres.ts#entities + DataSource entities/migrations options') failures.push('DB invariant must fingerprint the TypeORM entity registry and DataSource schema options');
	if (!dbInvariant.files?.['packages/backend/src/models/util/id.ts']) failures.push('DB invariant manifest must fingerprint models/util/id.ts');
	if (!dbInvariant.runtime?.entityRegistrySha256 || !dbInvariant.runtime?.dataSourceSchemaOptionsSha256) failures.push('DB invariant manifest must include runtime TypeORM schema fingerprints');
}

if (rootPackage && misutgaruCorePackage) {
	if (!rootPackage.workspaces?.includes?.('packages/misutgaru-core')) failures.push('root workspaces must include packages/misutgaru-core');
	if (frontendPackage?.dependencies?.['@misutgaru/core'] !== 'workspace:*') failures.push('frontend @misutgaru/core must use workspace:*');
	if (backendPackage?.dependencies?.['@misutgaru/core'] !== 'workspace:*') failures.push('backend @misutgaru/core must use workspace:*');
	try {
		const lockfile = await readFile(path.join(root, 'pnpm-lock.yaml'), 'utf8');
		if (!/^  packages\/misutgaru-core:\s*\{\}\s*$/m.test(lockfile)) failures.push('pnpm-lock.yaml must contain the packages/misutgaru-core importer');
		for (const importer of ['packages/backend', 'packages/frontend']) {
			const start = lockfile.indexOf(`  ${importer}:`);
			let end = -1;
			if (start >= 0) {
				const remainder = lockfile.slice(start + 3);
				const match = /\n  (?=\S)/.exec(remainder);
				if (match) end = start + 3 + match.index;
			}
			const block = start < 0 ? '' : lockfile.slice(start, end < 0 ? undefined : end);
			if (!block.includes("'@misutgaru/core':") || !block.includes('specifier: workspace:*') || !block.includes('version: link:../misutgaru-core')) {
				failures.push(`pnpm-lock.yaml ${importer} importer must link @misutgaru/core`);
			}
		}
	} catch (error) {
		failures.push(`cannot validate @misutgaru/core lockfile wiring: ${error.message}`);
	}
}

if (rootPackage && vunePackage) {
	if (rootPackage.packageManager !== vunePackage.packageManager) failures.push(`root ${rootPackage.packageManager ?? 'missing packageManager'} does not match local Vune ${vunePackage.packageManager ?? 'missing packageManager'}`);
	const linked = rootPackage.dependencies?.['vune-ui'];
	if (linked !== 'link:packages/modules/Vune') failures.push('root vune-ui dependency must point at packages/modules/Vune');
	const compilerLink = rootPackage.devDependencies?.['@vune-ui/compiler'];
	if (compilerLink !== 'link:packages/modules/Vune/packages/compiler') failures.push('root @vune-ui/compiler must link the checked-out local Vune compiler');
}

if (frontendPackage && vunePackage && animationPackage) {
	if (frontendPackage.dependencies?.['vune-ui'] !== 'link:../modules/Vune') failures.push('frontend vune-ui must use the checked-out local module');
	const localVuneLinks = {
		'@vune-ui/animation': 'link:../modules/Vune/packages/animation',
		'@vune-ui/core': 'link:../modules/Vune/packages/core',
		'@vune-ui/vue': 'link:../modules/Vune/packages/vue',
		'@vune-ui/web': 'link:../modules/Vune/packages/web',
	};
	for (const [name, expected] of Object.entries(localVuneLinks)) {
		if (frontendPackage.dependencies?.[name] !== expected) failures.push(`frontend ${name} must link the checked-out local Vune package`);
	}
	for (const [name, expected] of Object.entries({
		'@vune-ui/compiler': 'link:../modules/Vune/packages/compiler',
		'@vune-ui/vite': 'link:../modules/Vune/packages/vite',
	})) {
		if (frontendPackage.devDependencies?.[name] !== expected) failures.push(`frontend ${name} must link the checked-out local Vune package`);
	}
}


try {
	const lockfile = await readFile(path.join(root, 'pnpm-lock.yaml'), 'utf8');
	for (const expected of [
		'specifier: link:packages/modules/Vune/packages/compiler',
		'specifier: link:../modules/Vune/packages/animation',
		'specifier: link:../modules/Vune/packages/core',
		'specifier: link:../modules/Vune/packages/vue',
		'specifier: link:../modules/Vune/packages/web',
		'specifier: link:../modules/Vune/packages/vite',
		'specifier: link:../modules/Vune/packages/compiler',
	]) {
		if (!lockfile.includes(expected)) failures.push(`pnpm-lock.yaml is missing local Vune link: ${expected}`);
	}
} catch (error) {
	failures.push(`cannot validate local Vune lockfile wiring: ${error.message}`);
}

for (const relative of [
	'packages/modules/Vune/pnpm-lock.yaml',
	'packages/modules/Vune/packages/animation/package.json',
	'packages/modules/Vune/packages/animation/index.d.ts',
	'packages/modules/Vune/packages/animation/src/index.js',
	'packages/modules/Vune/packages/core/package.json',
	'packages/modules/Vune/packages/compiler/package.json',
	'packages/modules/Vune/packages/web/package.json',
]) {
	try {
		const info = await stat(path.join(root, relative));
		if (!info.isFile()) failures.push(`${relative} is missing`);
	} catch {
		failures.push(`${relative} is missing; initialize submodules recursively`);
	}
}

try {
	const dockerfile = await readFile(path.join(root, 'Dockerfile'), 'utf8');
	const dockerignore = await readFile(path.join(root, '.dockerignore'), 'utf8');
	if (!rootPackage?.scripts?.build?.includes('pnpm modules:build')) failures.push('root build must prepare the local Vune workspace before the application build');
	if (!dockerfile.includes('pnpm build')) failures.push('Dockerfile must invoke the root build so local framework preparation cannot be skipped');
	const prebuiltVuneCopy = dockerfile.split('\n').some(line => line.trimStart().startsWith('COPY ') && !line.includes('--from=') && line.includes('packages/modules/Vune/dist'));
	if (prebuiltVuneCopy) failures.push('Dockerfile must not require prebuilt packages/modules/Vune/dist from the source context');
	if (/^packages\/modules\/Vune\/\*$/m.test(dockerignore)) failures.push('.dockerignore must not hide Vune source required by the clean Docker build');
	if (!dockerfile.includes('packages/misutgaru-core/package.json')) failures.push('Dockerfile must expose the @misutgaru/core workspace manifest during dependency installation');
	if (!dockerfile.includes('packages/misutgaru-core/built')) failures.push('Dockerfile runner must copy the built @misutgaru/core runtime package');
} catch (error) {
	failures.push(`cannot validate Docker local-module build: ${error.message}`);
}

try {
	const viteConfig = await readFile(path.join(root, 'packages/frontend/vite.config.ts'), 'utf8');
	const compilerVite = await readFile(path.join(root, 'packages/modules/Vune/packages/compiler/src/vite.ts'), 'utf8');
	if (!viteConfig.includes("vueHost: { factoryImport: '@/vune/compat-vue.js' }")) failures.push('frontend Vite config must enable compiler-generated transitional Vue hosts');
	if (!compilerVite.includes('vue-host')) failures.push('Vune compiler Vite plugin must preserve the ?vue-host codegen entry point');
} catch (error) {
	failures.push(`cannot validate typed Vune Vue-host integration: ${error.message}`);
}

try {
	const inventory = await readFile(path.join(root, 'docs/source-map/INVENTORY.md'), 'utf8');
	const declared = Number(inventory.match(/Source files indexed:\s*(\d+)/)?.[1] ?? 0);
	const rows = (inventory.match(/^\| `[^`]+` \|/gm) ?? []).length;
	if (declared < 1000 || rows < 1000) failures.push('docs/source-map/INVENTORY.md looks truncated; regenerate the source inventory');
	if (declared !== rows) failures.push(`source inventory declares ${declared} files but contains ${rows} table rows`);
} catch (error) {
	failures.push(`cannot read source inventory: ${error.message}`);
}

try {
	const yamlModule = await import('js-yaml');
	const yamlLoad = yamlModule.load ?? yamlModule.default?.load;
	if (typeof yamlLoad !== 'function') throw new Error('js-yaml load() export is unavailable');
	for (const relative of [
		'.config/example.yml',
		'.config/docker_example.yml',
		'.config/playwright-devcontainer.yml',
		'.github/workflows/misutgaru-integrity.yml',
		'pnpm-workspace.yaml',
	]) {
		try {
			yamlLoad(await readFile(path.join(root, relative), 'utf8'));
		} catch (error) {
			failures.push(`${relative} is not valid YAML: ${error.message}`);
		}
	}
} catch (error) {
	if (error?.code !== 'ERR_MODULE_NOT_FOUND') failures.push(`failed to load js-yaml: ${error.message}`);
	else console.warn('js-yaml is not installed; YAML parsing skipped (merge-marker scan still ran).');
}

if (failures.length > 0) {
	for (const failure of failures) console.error(`integrity: ${failure}`);
	process.exitCode = 1;
} else {
	console.log(`Repository integrity check passed (${scannedFiles} text files scanned).`);
}
