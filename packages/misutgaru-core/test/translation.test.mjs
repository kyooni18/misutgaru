import assert from 'node:assert/strict';
import test from 'node:test';
import { buildTranslationUserText, openAiChatCompletionsEndpoint, parseTranslationResponse, threadWindowDefaults } from '../built/index.js';

test('translation contracts normalize endpoint and bound image output', () => {
	assert.equal(openAiChatCompletionsEndpoint('https://example.test/v1/').toString(), 'https://example.test/v1/chat/completions');
	assert.match(buildTranslationUserText('hello', 'ko', ['previous']), /previous/);
	const parsed = parseTranslationResponse('{"sourceLang":"en","text":"안녕","images":[{"kind":"description","sourceLang":"unknown","text":"sky"},{"kind":"translation","sourceLang":"ja","text":"x"}]}', ['file-a']);
	assert.deepEqual(parsed, {
		sourceLang: 'en',
		text: '안녕',
		images: [{ fileId: 'file-a', kind: 'description', sourceLang: 'unknown', text: 'sky' }],
	});
	assert.equal(threadWindowDefaults.width, 640);
});
