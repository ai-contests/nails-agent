import dotenv from 'dotenv';
dotenv.config();

const NVIDIA_API_URL = 'https://integrate.api.nvidia.com/v1/chat/completions';
const MODEL_NAME = 'nvidia/llama-3.1-nemotron-nano-8b-v1';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export async function callLlamaModel(messages: ChatMessage[]): Promise<string> {
  const apiKey = process.env['NVIDIA_API_KEY'];
  if (!apiKey) {
    console.warn('NVIDIA_API_KEY is not set. Falling back to mock response.');
    return 'Mock Response: NVIDIA API key is missing. Please set NVIDIA_API_KEY in .env.';
  }

  try {
    const response = await fetch(NVIDIA_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: MODEL_NAME,
        messages,
        temperature: 0.2,
        max_tokens: 1024,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`NVIDIA API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json() as { choices: { message: { content: string } }[] };
    return data.choices[0]?.message.content || '';
  } catch (error) {
    console.error('Error calling NVIDIA Llama model:', error);
    throw error;
  }
}

