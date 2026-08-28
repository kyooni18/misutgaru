#!/usr/bin/env node
/* SPDX-License-Identifier: AGPL-3.0-only */
import { createHash } from 'node:crypto';
import { readFile, readdir, stat, writeFile } from 'node:fs/promises';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const manifestPath = join(repoRoot, 'scripts', 'db-schema-invariant.json');
const args = process.argv.slice(2);
const upstreamArg = args.indexOf('--upstream');
const upstreamRoot = upstreamArg >= 0 ? resolve(args[upstreamArg + 1] ?? '') : null;
const writeManifest = args.includes('--write');

const normalized = path => path.split('\\').join('/');
const sha256 = data => createHash('sha256').update(data).digest('hex');
const SCHEMA_DECORATOR_RE = /@(Entity|Column|PrimaryColumn|PrimaryGeneratedColumn|Index|Unique|Check|JoinColumn|JoinTable|ManyToOne|OneToMany|OneToOne|ManyToMany)\b/;

async function filesUnder(root, relativeDir, recursive) {
  const dir = join(root, relativeDir);
  const result = [];
  const visit = async current => {
    for (const entry of await readdir(current, { withFileTypes: true })) {
      const path = join(current, entry.name);
      if (entry.isDirectory()) {
        if (recursive) await visit(path);
      } else if (entry.isFile()) {
        result.push(normalized(relative(root, path)));
      }
    }
  };
  await visit(dir);
  return result;
}

async function schemaFiles(root) {
  const migrations = await filesUnder(root, 'packages/backend/migration', true);
  const modelDir = join(root, 'packages/backend/src/models');
  const models = [];
  for (const entry of await readdir(modelDir, { withFileTypes: true })) {
    if (entry.isFile() && entry.name.endsWith('.ts')) {
      models.push(normalized(relative(root, join(modelDir, entry.name))));
    }
  }

  // Entity decorators depend on helpers under models/util. A change to id.ts,
  // for example, changes every primary/foreign ID column without touching any
  // entity file, so it must be part of the compatibility fingerprint too.
  const modelUtilities = await filesUnder(root, 'packages/backend/src/models/util', true);

  // Do not assume future schema-bearing sources stay in the historical models
  // directory. If a new TypeORM-decorated source appears anywhere in backend
  // src, include it automatically so the vanilla comparison reports it as an
  // added/modified schema source rather than silently trusting path layout.
  const backendSources = await filesUnder(root, 'packages/backend/src', true);
  const decoratedSources = [];
  for (const path of backendSources) {
    if (!path.endsWith('.ts')) continue;
    const source = await readFile(join(root, path), 'utf8');
    if (SCHEMA_DECORATOR_RE.test(source)) decoratedSources.push(path);
  }

  return [...new Set([...migrations, ...models, ...modelUtilities, ...decoratedSources])].sort();
}

async function schemaRuntimeFingerprint(root) {
  const postgresPath = join(root, 'packages/backend/src/postgres.ts');
  const source = await readFile(postgresPath, 'utf8');
  const entityRegistry = source.match(/export const entities\s*=\s*\[(.*?)\n\];/s)?.[0];
  const dataSourceSchemaOptions = source.match(/\n\s*entities:\s*entities,\s*\n\s*migrations:\s*\[[^\n]+\],/s)?.[0];
  if (!entityRegistry) throw new Error('could not locate exported TypeORM entity registry in packages/backend/src/postgres.ts');
  if (!dataSourceSchemaOptions) throw new Error('could not locate TypeORM entities/migrations options in packages/backend/src/postgres.ts');
  const normalizeBlock = block => block.replace(/\r\n/g, '\n').replace(/[ \t]+$/gm, '').trim();
  return {
    entityRegistrySha256: sha256(normalizeBlock(entityRegistry)),
    dataSourceSchemaOptionsSha256: sha256(normalizeBlock(dataSourceSchemaOptions)),
  };
}

async function snapshot(root) {
  const files = await schemaFiles(root);
  const entries = {};
  for (const path of files) {
    entries[path] = sha256(await readFile(join(root, path)));
  }
  const aggregate = sha256(files.map(path => `${path}\0${entries[path]}\n`).join(''));
  const runtime = await schemaRuntimeFingerprint(root);
  const pkg = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'));
  return {
    version: pkg.version,
    scope: {
      migrations: 'packages/backend/migration/**',
      entityModels: 'packages/backend/src/models/*.ts',
      entityUtilities: 'packages/backend/src/models/util/**',
      decoratedBackendSources: 'packages/backend/src/**/*.ts containing TypeORM schema decorators',
      entityRegistry: 'packages/backend/src/postgres.ts#entities + DataSource entities/migrations options',
    },
    fileCount: files.length,
    aggregateSha256: aggregate,
    runtime,
    files: entries,
  };
}

function compare(expected, actual) {
  const problems = [];
  if (expected.version !== actual.version) {
    problems.push(`version mismatch: expected ${expected.version}, got ${actual.version}`);
  }
  const expectedPaths = new Set(Object.keys(expected.files));
  const actualPaths = new Set(Object.keys(actual.files));
  for (const path of expectedPaths) {
    if (!actualPaths.has(path)) problems.push(`missing schema source: ${path}`);
    else if (expected.files[path] !== actual.files[path]) problems.push(`modified schema source: ${path}`);
  }
  for (const path of actualPaths) {
    if (!expectedPaths.has(path)) problems.push(`added schema source: ${path}`);
  }
  if (expected.aggregateSha256 !== actual.aggregateSha256 && problems.length === 0) {
    problems.push('aggregate DB schema fingerprint changed');
  }
  if (expected.runtime?.entityRegistrySha256 !== actual.runtime.entityRegistrySha256) {
    problems.push('TypeORM entity registry changed');
  }
  if (expected.runtime?.dataSourceSchemaOptionsSha256 !== actual.runtime.dataSourceSchemaOptionsSha256) {
    problems.push('TypeORM DataSource schema options changed');
  }
  return problems;
}

if (writeManifest) {
  if (!upstreamRoot) throw new Error('--write requires --upstream /path/to/vanilla-misskey');
  const upstreamStat = await stat(upstreamRoot).catch(() => null);
  if (!upstreamStat?.isDirectory()) throw new Error(`upstream directory not found: ${upstreamRoot}`);
  const manifest = await snapshot(upstreamRoot);
  manifest.generatedFrom = `vanilla Misskey ${manifest.version}`;
  manifest.note = 'Generated from vanilla Misskey. Misutgaru must keep migrations, TypeORM entity models, schema-shaping model utilities, every TypeORM-decorated backend source, the entity registry, and the DataSource schema options identical.';
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(`wrote ${normalized(relative(repoRoot, manifestPath))}: ${manifest.fileCount} files, ${manifest.aggregateSha256}`);
}

const compareLiveUpstream = args.includes('--against-upstream');
if (compareLiveUpstream && !upstreamRoot) throw new Error('--against-upstream requires --upstream /path/to/vanilla-misskey');
const expected = compareLiveUpstream
  ? await snapshot(upstreamRoot)
  : JSON.parse(await readFile(manifestPath, 'utf8'));
const actual = await snapshot(repoRoot);
const problems = compare(expected, actual);
if (problems.length > 0) {
  console.error('Misutgaru DB compatibility invariant failed. PostgreSQL schema sources must remain identical to vanilla Misskey.');
  for (const problem of problems) console.error(`- ${problem}`);
  process.exit(1);
}
console.log(`DB invariant OK${compareLiveUpstream ? ' against live upstream' : ''}: ${actual.fileCount} files, ${actual.aggregateSha256}`);
