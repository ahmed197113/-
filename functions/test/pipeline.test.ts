import assert from 'node:assert/strict';
import { test } from 'node:test';

import { buildPrompt, isTemplateActive } from '../src/lib/prompt';
import { generateWithFallback } from '../src/providers';
import { ProviderError } from '../src/providers/ImageProvider';
import { MockProvider } from '../src/providers/mockProvider';
import { isExpired, SELFIE_TTL_MS } from '../src/privacy';

const input = {
  selfieUrls: ['https://x/selfie.jpg'],
  prompt: 'p',
  negativePrompt: 'n',
  model: 'm',
  aspectRatio: '9:16' as const,
  count: 4,
  styleStrength: 0.8,
  timeoutMs: 1000,
};

test('prompt fills slots and always appends safety rules', () => {
  const { prompt, negative } = buildPrompt(
    { prompt_template: 'portrait of a {gender} in {outfit}, {background}', outfit: 'thobe', background: 'desert' },
    'female',
  );
  assert.match(prompt, /portrait of a woman in thobe, desert/);
  assert.match(prompt, /modest clothing/);
  assert.match(prompt, /do not westernize/);
  assert.match(negative, /text, letters/); // the AI must never draw text
  assert.match(negative, /prophets/);
});

test('seasonal activation', () => {
  const t = { prompt_template: '', active_from: '2026-09-01', active_to: '2026-10-15' };
  assert.equal(isTemplateActive(t, new Date('2026-09-23')), true);
  assert.equal(isTemplateActive(t, new Date('2026-11-01')), false);
  assert.equal(isTemplateActive({ prompt_template: '', is_published: false }, new Date()), false);
});

test('retries then succeeds', async () => {
  const r = await generateWithFallback(input, new MockProvider(1), null, 2, 1);
  assert.equal(r.images.length, 4);
});

test('falls back to the second provider', async () => {
  const broken = { name: 'broken', generate: async () => { throw new ProviderError('down', false); } };
  const r = await generateWithFallback(input, broken, new MockProvider(), 2, 1);
  assert.equal(r.provider, 'mock');
});

test('throws when every provider fails', async () => {
  await assert.rejects(generateWithFallback(input, new MockProvider(99), null, 1, 1));
});

test('selfies expire after 24h, results after 30 days', () => {
  const now = Date.now();
  assert.equal(isExpired('uploads', now - SELFIE_TTL_MS, now), true);
  assert.equal(isExpired('uploads', now - SELFIE_TTL_MS + 60_000, now), false);
  assert.equal(isExpired('results', now - 29 * 864e5, now), false);
  assert.equal(isExpired('results', now - 30 * 864e5, now), true);
});
