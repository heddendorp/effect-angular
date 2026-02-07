import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const rootFile = (name: string): string => join(process.cwd(), name);

describe('OSS community and health files', () => {
  it('includes required root files for open-source collaboration', () => {
    expect(existsSync(rootFile('LICENSE'))).toBe(true);
    expect(existsSync(rootFile('CODE_OF_CONDUCT.md'))).toBe(true);
    expect(existsSync(rootFile('CONTRIBUTING.md'))).toBe(true);
  });

  it('uses an MIT license and documents reporting expectations', () => {
    const license = readFileSync(rootFile('LICENSE'), 'utf8');
    const contributing = readFileSync(rootFile('CONTRIBUTING.md'), 'utf8');

    expect(license).toContain('MIT License');
    expect(contributing).toContain('Reporting Bugs');
    expect(contributing).toContain('Open a GitHub issue');
  });
});
