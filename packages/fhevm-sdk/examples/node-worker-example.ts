/**
 * Node.js Worker Example
 * Demonstrates using FHE Worker in Node.js environment
 */

import { FheWorker, createFhevmClient, encryptWithWorker, createInstance } from '@fhevm-sdk';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function nodeWorkerExample() {
  console.log('=== Node.js Worker Example ===\n');

  // 1. Create FHEVM client
  const client = createFhevmClient({
    network: 'https://eth.llamarpc.com',
    chainId: 1,
    debug: true
  });

  // 2. Create instance
  const instance = await createInstance(client);

  // 3. Use Worker for encryption
  console.log('Creating Worker...');
  const worker = new FheWorker({
    workerPath: path.join(__dirname, '../src/workers/fhe-worker.node.js'),
    debug: true
  });

  console.log('Initializing Worker...');
  await worker.init();
  console.log('✅ Worker initialized!\n');

  // 4. Encrypt values
  console.log('Encrypting value 42...');
  const ciphertext = await worker.encrypt(42, {
    type: 'uint64',
    contractAddress: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
    userAddress: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb'
  });
  console.log('✅ Encrypted:', Array.from(ciphertext).slice(0, 10).join(', '), '...\n');

  // 5. Batch encryption with encryptWithWorker
  console.log('Batch encrypting with encryptWithWorker...');
  const batchResult = await encryptWithWorker(client, {
    instance,
    contractAddress: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
    userAddress: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
    workerConfig: {
      workerPath: path.join(__dirname, '../src/workers/fhe-worker.node.js'),
      debug: true
    },
    values: [
      { type: 'uint64', value: 42 },
      { type: 'uint32', value: 100 },
      { type: 'bool', value: true }
    ]
  });
  console.log('✅ Batch encrypted:', batchResult.handles.length, 'handles\n');

  // 6. Cleanup
  worker.terminate();
  console.log('Worker terminated');
}

// Run example
nodeWorkerExample().catch(console.error);

