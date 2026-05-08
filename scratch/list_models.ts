import { listModels } from '../src/ollama-client.js';

async function main() {
  console.log('Fetching available models...');
  const models = await listModels();
  console.log('Available models:', JSON.stringify(models, null, 2));
}

main().catch(console.error);
