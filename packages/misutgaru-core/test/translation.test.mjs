import assert from 'node:assert/strict';
import test from 'node:test';
import { buildTranslationUserText, openAiChatCompletionsEndpoint, parseTranslationResponse, threadWindowDefaults } from '../built/index.js';

test('translation contracts normalize endpoint and bound image output', () => {
	assert.equal(openAiChatCompletionsEndpoint('https://example.test/v1/').toString(), 'https://example.test/v1/chat/completions');
	const prompt = buildTranslationUserText(
		{ text: 'hello', media: [{ type: 'image/png', name: 'a.png', comment: 'cat', imageNumber: 1 }] },
		'ko',
		[{ text: 'previous', media: [{ type: 'image/png', name: 'b.png', comment: null, imageNumber: 2 }] }],
	);
	assert.match(prompt, /previous[\s\S]*image #2[\s\S]*Post to translate[\s\S]*hello[\s\S]*image #1\] a\.png, alt text: "cat"/);
	assert.match(prompt, /Images #1-#1 are target images/);
	const parsed = parseTranslationResponse('{"sourceLang":"en","text":"안녕","images":[{"kind":"description","sourceLang":"unknown","text":"sky"},{"kind":"translation","sourceLang":"ja","text":"x"}]}', ['file-a']);
	assert.deepEqual(parsed, {
		sourceLang: 'en',
		text: '안녕',
		images: [{ fileId: 'file-a', kind: 'description', sourceLang: 'unknown', text: 'sky' }],
	});
	// The preserved local UI work widened thread popups to 760px.
	assert.equal(threadWindowDefaults.width, 760);
	assert.ok(threadWindowDefaults.minWidth <= threadWindowDefaults.width);
});
