import OpenAI from 'openai';
import { config } from './config.js';

export const ollama = new OpenAI({
  baseURL: config.OLLAMA_BASE_URL,
  apiKey: config.OLLAMA_API_KEY,
  timeout: 120000, // 2 minute timeout
  maxRetries: 2,
});

export const MODEL = config.OLLAMA_MODEL;
export const CONTEXT_WINDOW = config.CONTEXT_WINDOW;
