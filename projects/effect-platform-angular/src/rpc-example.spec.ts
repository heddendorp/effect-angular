import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const readmePath = resolve(process.cwd(), 'projects', 'effect-platform-angular', 'README.md');

describe('Effect RPC documentation example', () => {
  it('documents the HTTP protocol setup for the adapter', () => {
    const readme = readFileSync(readmePath, 'utf8');
    // Keep key lines stable so the example stays accurate for new developers.
    const requiredSnippets = [
      '## Effect RPC (minimal example)',
      "RpcClient.layerProtocolHttp({ url: '/rpc' })",
      'RpcSerialization.layerJson',
      'EFFECT_HTTP_CLIENT',
      '// RPC example: HTTP protocol',
    ];

    for (const snippet of requiredSnippets) {
      expect(readme).toContain(snippet);
    }
  });
});
