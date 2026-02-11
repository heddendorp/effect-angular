import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const readReadme = (): string =>
  readFileSync(join(process.cwd(), 'projects', 'effect-angular-query', 'README.md'), 'utf8');

describe('effect-angular-query README', () => {
  it('documents setup and usage for the unified RPC client helpers', () => {
    const readme = readReadme();
    expect(readme).toContain('Installation');
    expect(readme).toContain('createEffectRpcAngularClient');
    expect(readme).toContain('injectQuery');
    expect(readme).toContain('injectMutation');
    expect(readme).toContain('Query key');
    expect(readme).toContain('mutationOptions');
    expect(readme).toContain('Path helpers');
    expect(readme).toContain('injectable client');
    expect(readme).toContain('Sharing RPC contracts');
  });
});
