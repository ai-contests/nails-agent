import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(__dirname, '../..');

function loadRootEnv(): void {
  const envPath = resolve(PROJECT_ROOT, '.env');
  if (!existsSync(envPath)) return;

  const lines = readFileSync(envPath, 'utf8').split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIndex = trimmed.indexOf('=');
    if (eqIndex <= 0) continue;

    const key = trimmed.slice(0, eqIndex).trim();
    const rawValue = trimmed.slice(eqIndex + 1).trim();
    const value = rawValue.replace(/^(['"])(.*)\1$/, '$2');
    process.env[key] ??= value;
  }
}

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set`);
  return value;
}

function optionalEnv(name: string): string | undefined {
  const value = process.env[name];
  if (!value) return undefined;
  return value.replace(/^(['"])(.*)\1$/, '$2').trim();
}

function optionalBooleanEnv(name: string): boolean | undefined {
  const value = optionalEnv(name);
  if (!value) return undefined;

  const normalized = value.toLowerCase();
  if (['true', '1', 'yes', 'on'].includes(normalized)) return true;
  if (['false', '0', 'no', 'off'].includes(normalized)) return false;

  throw new Error(`${name} must be true or false`);
}

function optionalPositiveIntegerEnv(name: string): number | undefined {
  const value = optionalEnv(name);
  if (!value) return undefined;

  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${name} must be a positive integer`);
  }

  return parsed;
}

loadRootEnv();

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export async function callLlmModel(messages: ChatMessage[]): Promise<string> {
  const apiKey = requiredEnv('MODELSCOPE_API_KEY');
  const apiUrl = requiredEnv('MODELSCOPE_API_URL');
  const model = requiredEnv('MODELSCOPE_MODEL');
  const enableThinking = optionalBooleanEnv('MODELSCOPE_ENABLE_THINKING');
  const maxTokens = optionalPositiveIntegerEnv('MODELSCOPE_MAX_TOKENS') ?? 1024;
  const responseFormat = optionalEnv('MODELSCOPE_RESPONSE_FORMAT');

  const body: {
    model: string;
    messages: ChatMessage[];
    temperature: number;
    max_tokens: number;
    enable_thinking?: boolean;
    response_format?: { type: 'json_object' };
  } = {
    model,
    messages,
    temperature: 0.2,
    max_tokens: maxTokens,
  };

  // enable_thinking is only supported by certain models (e.g. Qwen3 with thinking mode).
  // MiniMax and other models silently return choices:null when this field is present.
  // Only add it when explicitly true.
  if (enableThinking === true) {
    body.enable_thinking = true;
  }

  if (responseFormat) {
    if (responseFormat !== 'json_object') {
      throw new Error('MODELSCOPE_RESPONSE_FORMAT must be json_object');
    }
    body.response_format = { type: 'json_object' };
  }

  const maxRetries = 3;
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify(body),
      });

      // Retry on 5xx (transient server errors)
      if (response.status >= 500) {
        const errorText = await response.text();
        lastError = new Error(`ModelScope API error: ${response.status} - ${errorText}`);
        if (attempt < maxRetries) {
          const delay = attempt * 2000;
          console.warn(`[LLM] Attempt ${attempt}/${maxRetries} failed (${response.status}), retrying in ${delay}ms…`);
          await new Promise(r => setTimeout(r, delay));
          continue;
        }
        throw lastError;
      }

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`ModelScope API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json() as { choices?: { message?: { content?: string } }[] } | null;
      if (!data || !Array.isArray(data.choices) || data.choices.length === 0) {
        throw new Error(`ModelScope API returned unexpected response shape: ${JSON.stringify(data)}`);
      }
      return data.choices[0]?.message?.content || '';
    } catch (error) {
      if (attempt === maxRetries) {
        console.error('Error calling ModelScope LLM model:', error);
        throw error;
      }
      lastError = error as Error;
    }
  }

  throw lastError ?? new Error('LLM call failed after retries');
}
