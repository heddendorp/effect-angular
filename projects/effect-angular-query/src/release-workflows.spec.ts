import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const rootFile = (name: string): string => join(process.cwd(), name);

describe('release workflows', () => {
  it('defines GitHub Actions workflows for preparing and publishing releases', () => {
    const prepareReleasePath = rootFile('.github/workflows/prepare_release_pr.yml');
    const releasePath = rootFile('.github/workflows/release.yml');

    expect(existsSync(prepareReleasePath)).toBe(true);
    expect(existsSync(releasePath)).toBe(true);

    const prepareReleaseWorkflow = readFileSync(prepareReleasePath, 'utf8');
    const releaseWorkflow = readFileSync(releasePath, 'utf8');

    expect(prepareReleaseWorkflow).toContain('knope prepare-release --verbose');
    expect(prepareReleaseWorkflow).toContain('npx jsr publish --dry-run');
    expect(releaseWorkflow).toContain('knope release --verbose');
    expect(releaseWorkflow).toContain('npx jsr publish');
    expect(releaseWorkflow).toContain("knope/release");
    expect(releaseWorkflow).toContain('id-token: write');
  });
});
