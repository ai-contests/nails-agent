import { afterEach, expect, test } from 'bun:test';
import { callLlmModel } from './llm.ts';

const originalEnv = { ...process.env };
const originalFetch = globalThis.fetch;

function clearOptionalModelScopeEnv() {
  delete process.env['MODELSCOPE_ENABLE_THINKING'];
  delete process.env['MODELSCOPE_MAX_TOKENS'];
  delete process.env['MODELSCOPE_RESPONSE_FORMAT'];
}

afterEach(() => {
  process.env = { ...originalEnv };
  globalThis.fetch = originalFetch;
});

test('requires a ModelScope API key from env', async () => {
  delete process.env['MODELSCOPE_API_KEY'];
  delete process.env['NVIDIA_API_KEY'];

  globalThis.fetch = (async () => {
    throw new Error('fetch should not be called without an API key');
  }) as unknown as typeof fetch;

  await expect(callLlmModel([{ role: 'user', content: 'hello' }])).rejects.toThrow('MODELSCOPE_API_KEY is not set');
});

test('uses ModelScope URL and model from env', async () => {
  process.env['MODELSCOPE_API_KEY'] = 'env-api-key';
  process.env['MODELSCOPE_API_URL'] = 'https://example.test/v1/chat/completions';
  process.env['MODELSCOPE_MODEL'] = 'Qwen/Qwen3-Test';
  clearOptionalModelScopeEnv();

  let requestedUrl = '';
  let requestedBody: unknown;
  let requestedAuth = '';

  globalThis.fetch = (async (url, init) => {
    requestedUrl = String(url);
    requestedBody = JSON.parse(String(init?.body));
    const headers = init?.headers as Record<string, string>;
    requestedAuth = headers['Authorization'] || '';

    return new Response(JSON.stringify({
      choices: [{ message: { content: 'agent reply' } }],
    }), { status: 200 });
  }) as typeof fetch;

  const reply = await callLlmModel([{ role: 'user', content: 'analyze' }]);

  expect(reply).toBe('agent reply');
  expect(requestedUrl).toBe('https://example.test/v1/chat/completions');
  expect(requestedAuth).toBe('Bearer env-api-key');
  expect(requestedBody).toEqual({
    model: 'Qwen/Qwen3-Test',
    messages: [{ role: 'user', content: 'analyze' }],
    temperature: 0.2,
    max_tokens: 1024,
  });
});

test('passes ModelScope thinking toggle from env when configured', async () => {
  process.env['MODELSCOPE_API_KEY'] = 'env-api-key';
  process.env['MODELSCOPE_API_URL'] = 'https://example.test/v1/chat/completions';
  process.env['MODELSCOPE_MODEL'] = 'Qwen/Qwen3-4B';
  process.env['MODELSCOPE_ENABLE_THINKING'] = 'false';
  delete process.env['MODELSCOPE_MAX_TOKENS'];
  delete process.env['MODELSCOPE_RESPONSE_FORMAT'];

  let requestedBody: unknown;

  globalThis.fetch = (async (_url, init) => {
    requestedBody = JSON.parse(String(init?.body));

    return new Response(JSON.stringify({
      choices: [{ message: { content: 'agent reply' } }],
    }), { status: 200 });
  }) as typeof fetch;

  await callLlmModel([{ role: 'user', content: 'analyze' }]);

  expect(requestedBody).toEqual({
    model: 'Qwen/Qwen3-4B',
    messages: [{ role: 'user', content: 'analyze' }],
    temperature: 0.2,
    max_tokens: 1024,
    enable_thinking: false,
  });
});

test('passes ModelScope response format and max tokens from env when configured', async () => {
  process.env['MODELSCOPE_API_KEY'] = 'env-api-key';
  process.env['MODELSCOPE_API_URL'] = 'https://example.test/v1/chat/completions';
  process.env['MODELSCOPE_MODEL'] = 'Qwen/Qwen3-14B';
  process.env['MODELSCOPE_MAX_TOKENS'] = '2048';
  process.env['MODELSCOPE_RESPONSE_FORMAT'] = 'json_object';
  delete process.env['MODELSCOPE_ENABLE_THINKING'];

  let requestedBody: unknown;

  globalThis.fetch = (async (_url, init) => {
    requestedBody = JSON.parse(String(init?.body));

    return new Response(JSON.stringify({
      choices: [{ message: { content: 'agent reply' } }],
    }), { status: 200 });
  }) as typeof fetch;

  await callLlmModel([{ role: 'user', content: 'analyze' }]);

  expect(requestedBody).toEqual({
    model: 'Qwen/Qwen3-14B',
    messages: [{ role: 'user', content: 'analyze' }],
    temperature: 0.2,
    max_tokens: 2048,
    response_format: { type: 'json_object' },
  });
});
