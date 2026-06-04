import dotenv from 'dotenv';
dotenv.config();

const MODELSCOPE_API_URL = 'https://api-inference.modelscope.cn/v1/chat/completions';
const MODEL_NAME = 'MiniMax/MiniMax-M2.5';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export async function callLlmModel(messages: ChatMessage[]): Promise<string> {
  const apiKey = process.env['MODELSCOPE_API_KEY'] || process.env['NVIDIA_API_KEY'];

  if (!apiKey) {
    throw new Error('API key is missing. Please set MODELSCOPE_API_KEY or NVIDIA_API_KEY environment variable.');
  }

  try {
    const response = await fetch(MODELSCOPE_API_URL, {
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
      throw new Error(`ModelScope API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json() as { choices: { message: { content: string } }[] };
    return data.choices[0]?.message.content || '';
  } catch (error) {
    console.error('Error calling ModelScope MiniMax model:', error);
    throw error;
  }
}

