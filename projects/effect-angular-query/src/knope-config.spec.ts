import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const rootFile = (name: string): string => join(process.cwd(), name);

describe('knope release configuration', () => {
  it('includes a root knope.toml with bot and workflow definitions', () => {
    expect(existsSync(rootFile('knope.toml'))).toBe(true);

    const config = readFileSync(rootFile('knope.toml'), 'utf8');

    expect(config).toContain('[github]');
    expect(config).toContain('[package]');
    expect(config).toContain('[bot.releases]');
    expect(config).toContain('name = "prepare-release"');
    expect(config).toContain('name = "release"');
  });

  it('defines release inputs and a changelog source', () => {
    const config = readFileSync(rootFile('knope.toml'), 'utf8');

    expect(existsSync(rootFile('CHANGELOG.md'))).toBe(true);
    expect(existsSync(rootFile('.changes/README.md'))).toBe(true);
    expect(config).toContain('node scripts/sync-jsr-versions.mjs');
    expect(config).toContain('[workflows.steps.body]');
  });
});
