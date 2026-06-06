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
  const fallbackModels = [
    requiredEnv('MODELSCOPE_MODEL'),
    'deepseek-ai/DeepSeek-V4-Pro',
    'inclusionAI/Ring-2.6-1T',
    'deepseek-ai/DeepSeek-V4-Flash',
    'ZhipuAI/GLM-5.1',
    'ZhipuAI/GLM-5',
    'inclusionAI/Ling-2.6-1T',
    'stepfun-ai/Step-3.7-Flash',
    'moonshotai/Kimi-K2.6',
    'moonshotai/Kimi-K2.5',
    'Qwen/Qwen3.5-397B-A17B',
    'Shanghai_AI_Laboratory/Intern-S1-Pro',
    'Shanghai_AI_Laboratory/Intern-S2-Preview'
  ];

  // Remove duplicates just in case the env var matches one in the fallback list
  const models = Array.from(new Set(fallbackModels));

  const enableThinking = optionalBooleanEnv('MODELSCOPE_ENABLE_THINKING');
  const maxTokens = optionalPositiveIntegerEnv('MODELSCOPE_MAX_TOKENS') ?? 1024;
  const responseFormat = optionalEnv('MODELSCOPE_RESPONSE_FORMAT');

  let lastError: Error | null = null;

  for (const model of models) {
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

    if (enableThinking === true) {
      body.enable_thinking = true;
    }

    if (responseFormat) {
      if (responseFormat !== 'json_object') {
        throw new Error('MODELSCOPE_RESPONSE_FORMAT must be json_object');
      }
      body.response_format = { type: 'json_object' };
    }

    const maxRetries = 2; // Reduced retries per model so we can fall back faster
    let modelSuccess = false;
    let responseContent = '';

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => {
        controller.abort();
      }, 90000); // 90-second timeout

      try {
        console.log(`[LLM] Calling API: ${apiUrl}, model: ${model}, payload size: ${JSON.stringify(body).length} bytes`);
        const response = await fetch(apiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
          },
          body: JSON.stringify(body),
          signal: controller.signal,
        });
        clearTimeout(timeoutId);
        console.log(`[LLM] API response status: ${response.status} for model: ${model}`);

        if (response.status === 429) {
          const errorText = await response.text();
          console.warn(`[LLM] Quota exceeded or rate limited for model ${model} (429): ${errorText}. Falling back to next model.`);
          lastError = new Error(`ModelScope API error: 429 - ${errorText}`);
          break; // Break inner loop to move to the next model immediately
        }

        // Retry on 5xx (transient server errors)
        if (response.status >= 500) {
          const errorText = await response.text();
          lastError = new Error(`ModelScope API error: ${response.status} - ${errorText}`);
          if (attempt < maxRetries) {
            const delay = attempt * 2000;
            console.warn(`[LLM] Attempt ${attempt}/${maxRetries} for ${model} failed (${response.status}), retrying in ${delay}ms…`);
            await new Promise(r => setTimeout(r, delay));
            continue;
          }
          break; // Try next model
        }

        if (!response.ok) {
          const errorText = await response.text();
          lastError = new Error(`ModelScope API error: ${response.status} - ${errorText}`);
          console.warn(`[LLM] Request failed for model ${model} (${response.status}): ${errorText}`);
          break; // Fatal error for this model, try next model
        }

        const data = await response.json() as { choices?: { message?: { content?: string } }[] } | null;
        if (!data || !Array.isArray(data.choices) || data.choices.length === 0) {
          throw new Error(`ModelScope API returned unexpected response shape: ${JSON.stringify(data)}`);
        }
        
        responseContent = data.choices[0]?.message?.content || '';
        modelSuccess = true;
        break; // Success, break retry loop
      } catch (error) {
        clearTimeout(timeoutId);
        lastError = error as Error;
        const delay = attempt * 2000;
        console.warn(`[LLM] Attempt ${attempt}/${maxRetries} for ${model} failed due to: ${(error as Error).message || String(error)}, retrying in ${delay}ms…`);
        
        if (attempt < maxRetries) {
          await new Promise(r => setTimeout(r, delay));
        }
      }
    }

    if (modelSuccess) {
      return responseContent;
    }
    // If we reach here, this model failed completely, continue to next model in fallback array
  }

  throw lastError ?? new Error('LLM call failed after trying all fallback models');
}
