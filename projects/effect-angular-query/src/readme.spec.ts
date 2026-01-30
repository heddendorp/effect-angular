import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const readReadme = (): string =>
  readFileSync(join(process.cwd(), 'projects', 'effect-angular-query', 'README.md'), 'utf8');

describe('effect-angular-query README', () => {
  it('documents setup and usage for the query helpers', () => {
    const readme = readReadme();
    expect(readme).toContain('Installation');
    expect(readme).toContain('provideEffectRpcQueryClient');
    expect(readme).toContain('injectQuery');
    expect(readme).toContain('Query key');
    expect(readme).toContain('Path helpers');
    expect(readme).toContain('Injectable helpers');
    expect(readme).toContain('Sharing RPC contracts');
  });
});
