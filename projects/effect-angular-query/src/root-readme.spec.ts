import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const readRootReadme = (): string => readFileSync(join(process.cwd(), 'README.md'), 'utf8');

describe('root README', () => {
  it('documents workspace packages and Bun quickstart commands', () => {
    const readme = readRootReadme();

    expect(readme).toContain('## Quickstart');
    expect(readme).toContain('bun install');
    expect(readme).toContain('bun run build');
    expect(readme).toContain('## Packages');
    expect(readme).toContain('effect-platform-angular');
    expect(readme).toContain('effect-angular-query');
  });
});
