/* SPDX-License-Identifier: AGPL-3.0-only */
import { readFile, readdir } from 'node:fs/promises';
import { extname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../packages/frontend/src/', import.meta.url));
const nativeMarker = '@misutgaru-vune-native';
const compatMarker = '@misutgaru-vune-compat';

async function walk(dir) {
	const entries = await readdir(dir, { withFileTypes: true });
	const files = [];
	for (const entry of entries) {
		const path = join(dir, entry.name);
		if (entry.isDirectory()) files.push(...await walk(path));
		else files.push(path);
	}
	return files;
}

const files = await walk(root);
const vueFiles = files.filter(file => extname(file) === '.vue');
const vuneFiles = files.filter(file => /\.vune(?:\.[cm]?[jt]sx?)?$/.test(file));
const wrappers = [];
const nativeFiles = [];
const compatFiles = [];
const featureCounts = new Map();
let swiftSyntaxFiles = 0;
let vueComponentFallbacks = 0;
let vueSlotFallbacks = 0;
let rawElementFallbacks = 0;
let nativeVueComponentFallbacks = 0;
let nativeVueSlotFallbacks = 0;
let nativeRawElementFallbacks = 0;
let nativeStructFiles = 0;
let nativeConstDeclarations = 0;
let nativeVueFileDependencies = 0;
let forEachFiles = 0;

for (const file of vueFiles) {
	const source = await readFile(file, 'utf8');
	const isWrapper = /\.vune['"]/.test(source);
	if (isWrapper) wrappers.push(file);
	for (const feature of ['v-if', 'v-for', '<Transition', '<Teleport', '<slot', 'v-model', 'ref=', ':is=', '<component']) {
		const count = source.split(feature).length - 1;
		if (count > 0) featureCounts.set(feature, (featureCounts.get(feature) ?? 0) + 1);
	}
}

for (const file of vuneFiles) {
	const source = await readFile(file, 'utf8');
	const isNative = source.includes(nativeMarker);
	const isCompat = source.includes(compatMarker);
	if (isNative) nativeFiles.push(file);
	if (isCompat) compatFiles.push(file);
	if (/\b(?:VStack|HStack|ZStack|Group|Grid|LazyVStack|ForEach)\s*\([^)]*\)\s*\{/.test(source)) swiftSyntaxFiles += 1;
	const vueComponents = (source.match(/\bVueComponent\s*\(/g) ?? []).length;
	const vueSlots = (source.match(/\bVueSlot\s*\(/g) ?? []).length;
	const rawElements = (source.match(/\bElement\s*\(/g) ?? []).length;
	vueComponentFallbacks += vueComponents;
	vueSlotFallbacks += vueSlots;
	rawElementFallbacks += rawElements;
	if (isNative) {
		if (/\bexport\s+struct\s+[A-Za-z_$][\w$]*(?:\s*<[^>{}]+>)?\s*:\s*View\b/.test(source) && /\bvar\s+body\s*:\s*some\s+View\b/.test(source)) nativeStructFiles += 1;
		nativeConstDeclarations += (source.match(/\bconst\s+[A-Za-z_$][\w$]*\s*(?:=|:)/g) ?? []).length;
		nativeVueFileDependencies += (source.match(/from\s+['"][^'"]+\.vue['"]/g) ?? []).length;
		nativeVueComponentFallbacks += vueComponents;
		nativeVueSlotFallbacks += vueSlots;
		nativeRawElementFallbacks += rawElements;
	}
	if (/\bForEach\s*\(/.test(source)) forEachFiles += 1;
}

console.log(`Vue SFC compatibility surface: ${vueFiles.length}`);
console.log(`Vune source components:         ${vuneFiles.length}`);
console.log(`Native Vune components:         ${nativeFiles.length}`);
console.log(`Explicit compatibility shells:  ${compatFiles.length}`);
console.log(`Legacy Vue placement shells:    ${wrappers.length}`);
console.log(`SwiftUI-syntax Vune files:      ${swiftSyntaxFiles}`);
console.log(`Vune files using ForEach:       ${forEachFiles}`);
console.log(`Vue component fallback calls:   ${vueComponentFallbacks}`);
console.log(`Vue slot fallback calls:        ${vueSlotFallbacks}`);
console.log(`Raw Element fallback calls:     ${rawElementFallbacks}`);
console.log(`Native Vue component calls:     ${nativeVueComponentFallbacks}`);
console.log(`Native Vue slot calls:          ${nativeVueSlotFallbacks}`);
console.log(`Native raw Element calls:       ${nativeRawElementFallbacks}`);
console.log(`Native SwiftUI struct Views:    ${nativeStructFiles}`);
console.log(`Native const declarations:      ${nativeConstDeclarations}`);
console.log(`Native .vue dependencies:       ${nativeVueFileDependencies}`);
console.log(`Native share of Vune sources:   ${((nativeFiles.length / Math.max(1, vuneFiles.length)) * 100).toFixed(1)}%`);
console.log(`Legacy-shell coverage:          ${((wrappers.length / Math.max(1, vueFiles.length)) * 100).toFixed(1)}%`);
console.log('');
console.log('Compatibility Vune:');
for (const file of compatFiles.sort()) console.log(`  ${relative(root, file)}`);
console.log('');
console.log('Native Vune:');
for (const file of nativeFiles.sort()) console.log(`  ${relative(root, file)}`);
console.log('');
console.log('Remaining Vue template features (rough inventory):');
for (const [feature, count] of [...featureCounts.entries()].sort((a, b) => b[1] - a[1])) {
	console.log(`  ${feature.padEnd(12)} ${String(count).padStart(4)}`);
}
