import assert from 'node:assert/strict';
import test from 'node:test';
import { evaluateStackFence } from '../dist/agent/stack-fence.js';

test('fence denies react-dom/client edit that slipped through dogfood', () => {
  const denied = evaluateStackFence(
    {
      tool: 'file_edit',
      args: {
        path: 'src/rankedGallery.ts',
        old_string: "import { ranked, type WinMap } from './wins';",
        new_string:
          "import { ranked, type WinMap } from './wins';\nimport { createRoot } from 'react-dom/client';\n",
      },
    },
    'vanilla-three',
  );
  assert.equal(denied?.decision, 'deny');
});

test('fence denies package.json react dependency injection', () => {
  const denied = evaluateStackFence(
    {
      tool: 'file_write',
      args: {
        path: 'package.json',
        content: JSON.stringify({
          dependencies: { three: '^0.185.1', react: '^19.1.0', 'react-dom': '^19.1.0' },
        }),
      },
    },
    'vanilla-three',
  );
  assert.equal(denied?.decision, 'deny');
});

test('fence denies @react-three shell install', () => {
  const denied = evaluateStackFence(
    {
      tool: 'shell',
      args: { command: 'npm install react react-dom @react-three/xr' },
    },
    'vanilla-three',
  );
  assert.equal(denied?.decision, 'deny');
});
