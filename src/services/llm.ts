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

export async function callLlmModel(messages: ChatMessage[], options?: { responseFormat?: 'json_object' | 'text'; onChunk?: (chunk: string) => void }): Promise<string> {
  const apiKey = requiredEnv('MODELSCOPE_API_KEY');
  const apiUrl = requiredEnv('MODELSCOPE_API_URL');
  
  const envResponseFormat = optionalEnv('MODELSCOPE_RESPONSE_FORMAT');
  const responseFormat = options?.responseFormat || (envResponseFormat as 'json_object' | 'text' | undefined);

  const fallbackModels = [
    requiredEnv('MODELSCOPE_MODEL'),
    'meituan-longcat/LongCat-Flash-Lite',
    'deepseek-ai/DeepSeek-V3',
    'deepseek-ai/DeepSeek-V4-Pro',
    'deepseek-ai/DeepSeek-V4-Flash',
    'inclusionAI/Ring-2.6-1T',
    'ZhipuAI/GLM-4-Flash',
    'Qwen/Qwen2.5-7B-Instruct',
  ];

  const models = Array.from(new Set(fallbackModels));
  const enableThinking = optionalBooleanEnv('MODELSCOPE_ENABLE_THINKING');
  const maxTokens = optionalPositiveIntegerEnv('MODELSCOPE_MAX_TOKENS') ?? 1024;

  let lastError: Error | null = null;

  for (let modelIdx = 0; modelIdx < models.length; modelIdx++) {
    const model = models[modelIdx]!;
    const body: any = {
      model,
      messages,
      temperature: 0.2,
      max_tokens: maxTokens,
    };

    if (enableThinking === true) {
      body.enable_thinking = true;
    }

    if (responseFormat === 'json_object') {
      body.response_format = { type: 'json_object' };
    }

    // Streaming is only supported for the first model to simplify fallback logic
    const shouldStream = options?.onChunk && modelIdx === 0;
    if (shouldStream) {
      body.stream = true;
    }

    const maxRetries = 2;
    let modelSuccess = false;
    let responseContent = '';

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => {
        controller.abort();
      }, 90000);

      try {
        console.log(`[LLM] Calling API: ${apiUrl}, model: ${model}, stream: ${!!shouldStream}`);
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

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`API error ${response.status}: ${errorText}`);
        }

        if (shouldStream) {
          const reader = response.body?.getReader();
          if (!reader) throw new Error('Response body is null');
          const decoder = new TextDecoder();
          let buffer = '';
          
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';
            
            for (const line of lines) {
              const trimmedLine = line.trim();
              if (!trimmedLine || trimmedLine === 'data: [DONE]') continue;
              if (trimmedLine.startsWith('data: ')) {
                try {
                  const data = JSON.parse(trimmedLine.slice(6));
                  const content = data.choices?.[0]?.delta?.content || '';
                  if (content) {
                    responseContent += content;
                    options.onChunk!(content);
                  }
                } catch (e) {
                  console.error('[LLM] Error parsing stream chunk:', e);
                }
              }
            }
          }
        } else {
          const data = await response.json() as any;
          if (!data.choices || !data.choices[0] || !data.choices[0].message) {
            console.error('[LLM] Unexpected response shape:', JSON.stringify(data));
            throw new Error('Unexpected API response shape: missing choices[0].message');
          }
          responseContent = data.choices[0].message.content || '';
        }
        
        if (!responseContent && responseFormat === 'json_object') {
          throw new Error('LLM returned empty content for json_object request');
        }

        modelSuccess = true;
        break;
      } catch (error) {
        clearTimeout(timeoutId);
        lastError = error as Error;
        console.warn(`[LLM] Attempt ${attempt} for ${model} failed: ${lastError.message}`);
        if (attempt < maxRetries) await new Promise(r => setTimeout(r, 2000));
      }
    }

    if (modelSuccess) return responseContent;
  }

  throw lastError ?? new Error('LLM call failed');
}
