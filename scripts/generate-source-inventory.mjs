#!/usr/bin/env node
/*
 * SPDX-License-Identifier: AGPL-3.0-only
 *
 * Generates a searchable, repository-wide source inventory for contributors.
 * Optionally pass --upstream /path/to/misskey to classify files against an
 * upstream Misskey checkout.
 */
import { createHash } from 'node:crypto';
import { readFile, readdir, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const output = path.join(repoRoot, 'docs/source-map/INVENTORY.md');
const roots = ['packages', 'packages-private', 'scripts'];
const ignoredDirectories = new Set(['node_modules', '.git', '.pi', 'dist', 'built', 'build', 'coverage', 'storybook-static', 'target']);
const sourceExtensions = new Set([
  '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.vue',
  '.scss', '.sass', '.css', '.html', '.json', '.json5', '.yml', '.yaml', '.sh',
]);

const args = process.argv.slice(2);
const upstreamIndex = args.indexOf('--upstream');
const upstreamRoot = upstreamIndex >= 0 && args[upstreamIndex + 1]
  ? path.resolve(args[upstreamIndex + 1])
  : null;

async function walk(dir) {
  const result = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (entry.isDirectory() && ignoredDirectories.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) result.push(...await walk(full));
    else if (sourceExtensions.has(path.extname(entry.name))) result.push(full);
  }
  return result;
}

async function exists(file) {
  try { await stat(file); return true; } catch { return false; }
}

async function digest(file) {
  const data = await readFile(file);
  return createHash('sha256').update(data).digest('hex');
}

function titleize(value) {
  return value
    .replace(/\.(?:test|spec|stories|story|types|data|impl)$/i, '')
    .replace(/[-_.]+/g, ' ')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .trim();
}

function packageArea(rel) {
  const parts = rel.split('/');
  if (parts[0] === 'scripts') return 'tooling';
  if (parts[0] === 'packages-private') return 'private package';
  if (parts[0] !== 'packages') return parts[0];
  const pkg = parts[1] ?? 'packages';
  if (pkg === 'backend') return 'backend';
  if (pkg === 'frontend') return 'frontend';
  if (pkg === 'sw') return 'service worker';
  if (pkg === 'misskey-js') return 'client SDK';
  if (pkg === 'frontend-shared') return 'frontend shared';
  if (pkg === 'frontend-embed') return 'embed frontend';
  if (pkg === 'frontend-builder') return 'frontend build';
  if (pkg === 'shared') return 'shared';
  if (pkg === 'i18n') return 'i18n';
  if (pkg === 'icons-subsetter') return 'icon tooling';
  if (pkg === 'misskey-bubble-game') return 'bubble game';
  if (pkg === 'misskey-reversi') return 'reversi';
  if (pkg === 'modules') return 'linked module';
  return pkg;
}

function exportedSymbols(source) {
  const names = [];
  const pattern = /^\s*export\s+(?:default\s+)?(?:abstract\s+)?(?:class|function|const|let|var|type|interface|enum)\s+([A-Za-z_$][\w$]*)/gm;
  for (const match of source.matchAll(pattern)) {
    if (!names.includes(match[1])) names.push(match[1]);
    if (names.length >= 4) break;
  }
  return names;
}

function describe(rel, source = '') {
  const ext = path.extname(rel);
  const base = path.basename(rel, ext);
  const label = titleize(base);

  if (/\/migration\//.test(rel)) return `Database migration ${base}; schema history file, normally immutable after merge.`;
  if (/\.(?:test|spec)\.[^.]+$/.test(rel)) return `Tests for ${titleize(base)}.`;
  if (/\.stories\./.test(rel)) return `Storybook scenarios for ${titleize(base)}.`;
  if (/\/src\/server\/api\/endpoints\//.test(rel)) {
    const route = rel.split('/src/server/api/endpoints/')[1].replace(/\.ts$/, '');
    return `Backend API endpoint for ${route}.`;
  }
  if (/\/src\/server\/api\/stream\/channels\//.test(rel)) return `Streaming API channel for ${label}.`;
  if (/\/src\/server\/api\/stream\//.test(rel)) return `Streaming API infrastructure for ${label}.`;
  if (/\/src\/server\//.test(rel)) return `Backend server layer for ${label}.`;
  if (/\/src\/core\/entities\//.test(rel)) return `Entity packing and API serialization for ${label}.`;
  if (/\/src\/core\/activitypub\//.test(rel)) return `ActivityPub processing for ${label}.`;
  if (/\/src\/core\/chart\//.test(rel)) return `Statistics/chart service for ${label}.`;
  if (/\/src\/core\//.test(rel) && /Service\.ts$/.test(rel)) return `Backend domain service for ${label.replace(/ Service$/i, '')}.`;
  if (/\/src\/core\//.test(rel) && /Module\.ts$/.test(rel)) return `Nest module wiring for ${label.replace(/ Module$/i, '')}.`;
  if (/\/src\/queue\/processors\//.test(rel)) return `Background queue processor for ${label.replace(/ Processor Service$/i, '')}.`;
  if (/\/src\/queue\//.test(rel)) return `Queue infrastructure for ${label}.`;
  if (/\/src\/boot\//.test(rel)) return `Backend startup or shutdown path for ${label}.`;
  if (/\/src\/misc\//.test(rel)) return `Backend utility for ${label}.`;
  if (/\/src\/models\//.test(rel)) return `Database model or schema definition for ${label}.`;
  if (/\/src\/daemons\//.test(rel)) return `Long-running backend daemon for ${label}.`;

  if (rel.endsWith('.vue')) {
    if (/\/pages\//.test(rel)) return `Vue route/page for ${label}.`;
    if (/\/widgets\//.test(rel)) return `Vue widget UI for ${label}.`;
    if (/\/ui\//.test(rel)) return `Vue application shell UI for ${label}.`;
    return `Vue component for ${label}.`;
  }
  if (/\/src\/pages\//.test(rel)) return `Frontend page logic for ${label}.`;
  if (/\/src\/components\//.test(rel)) return `Frontend component support for ${label}.`;
  if (/\/src\/widgets\//.test(rel)) return `Frontend widget support for ${label}.`;
  if (/\/src\/utility\//.test(rel) || /\/src\/scripts\//.test(rel)) return `Frontend utility for ${label}.`;
  if (/\/src\/composables\//.test(rel)) return `Reusable frontend composable for ${label}.`;
  if (/packages\/sw\/src\//.test(rel)) return `Service Worker source for ${label}.`;
  if (/packages\/misskey-js\/src\/autogen\//.test(rel)) return `Generated Misskey API client/type source for ${label}; regenerate instead of hand-editing.`;
  if (/packages\/misskey-js\//.test(rel)) return `Misskey JavaScript client SDK source for ${label}.`;
  if (/packages\/i18n\//.test(rel)) return `Localization build/runtime source for ${label}.`;
  if (rel.startsWith('scripts/')) return `Repository tooling script for ${label}.`;
  if (ext === '.scss' || ext === '.sass' || ext === '.css') return `Styles for ${label}.`;
  if (ext === '.json' || ext === '.json5' || ext === '.yml' || ext === '.yaml') return `Package or tool configuration for ${label}.`;
  if (ext === '.html') return `HTML entry/template for ${label}.`;
  const symbols = exportedSymbols(source);
  return symbols.length > 0
    ? `Source for ${label}; exports ${symbols.map(name => `\`${name}\``).join(', ')}.`
    : `Source for ${label}.`;
}

async function deltaStatus(rel, file) {
  if (!upstreamRoot) return 'current';
  const upstreamFile = path.join(upstreamRoot, rel);
  if (!await exists(upstreamFile)) return 'added';
  return await digest(file) === await digest(upstreamFile) ? 'same' : 'modified';
}

const files = [];
for (const root of roots) {
  const full = path.join(repoRoot, root);
  if (await exists(full)) files.push(...await walk(full));
}
files.sort((a, b) => a.localeCompare(b));

const rows = [];
const counts = new Map();
for (const file of files) {
  const rel = path.relative(repoRoot, file).split(path.sep).join('/');
  const area = packageArea(rel);
  const status = await deltaStatus(rel, file);
  const ext = path.extname(file);
  const source = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'].includes(ext) ? await readFile(file, 'utf8') : '';
  counts.set(status, (counts.get(status) ?? 0) + 1);
  rows.push(`| \`${rel}\` | ${area} | ${status} | ${describe(rel, source)} |`);
}

const statusSummary = [...counts.entries()].map(([k, v]) => `${k}: ${v}`).join(', ');
const upstreamNote = upstreamRoot
  ? `Delta column compares against the upstream tree supplied at generation time. ${statusSummary}.`
  : 'Delta column is current because no upstream tree was supplied. Regenerate with --upstream to classify added, modified, and same files.';

const content = `# Source inventory\n\nThis file is generated by \`scripts/generate-source-inventory.mjs\`. It is a searchable index, not a replacement for reading the implementation.\n\n${upstreamNote}\n\nSource files indexed: ${rows.length}.\n\n| Path | Area | Delta | Purpose |\n| --- | --- | --- | --- |\n${rows.join('\n')}\n`;
await writeFile(output, content);
console.log(`Wrote ${output} with ${rows.length} source rows.`);
