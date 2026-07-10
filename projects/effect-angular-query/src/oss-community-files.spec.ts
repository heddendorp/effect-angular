import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const rootFile = (name: string): string => join(process.cwd(), name);
const readRootFile = (name: string): string => readFileSync(rootFile(name), 'utf8');
type JsonRecord = Record<string, unknown>;

const isRecord = (value: unknown): value is JsonRecord =>
  typeof value === 'object' && value !== null;

const readJsonRecord = (path: string): JsonRecord => {
  const parsed: unknown = JSON.parse(readRootFile(path));
  if (!isRecord(parsed)) {
    throw new Error(`${path} must contain a JSON object`);
  }

  return parsed;
};

const packages = [
  {
    directory: 'effect-platform-angular',
    name: '@heddendorp/effect-platform-angular',
  },
  {
    directory: 'effect-angular-query',
    name: '@heddendorp/effect-angular-query',
  },
] as const;

describe('OSS community and health files', () => {
  it('includes required root files for open-source collaboration', () => {
    expect(existsSync(rootFile('LICENSE'))).toBe(true);
    expect(existsSync(rootFile('CODE_OF_CONDUCT.md'))).toBe(true);
    expect(existsSync(rootFile('CONTRIBUTING.md'))).toBe(true);
    expect(existsSync(rootFile('SECURITY.md'))).toBe(true);
  });

  it('uses an MIT license and a repository-native private reporting channel', () => {
    const license = readRootFile('LICENSE');
    const contributing = readRootFile('CONTRIBUTING.md');
    const codeOfConduct = readRootFile('CODE_OF_CONDUCT.md');
    const security = readRootFile('SECURITY.md');
    const privateReportUrl = 'https://github.com/heddendorp/effect-angular/security/advisories/new';

    expect(license).toContain('MIT License');
    expect(contributing).toContain('Reporting Bugs');
    expect(contributing).toContain('Open a GitHub issue');
    expect(codeOfConduct).toContain(privateReportUrl);
    expect(security).toContain(privateReportUrl);
    expect(security).toContain('Latest published version');
    expect(codeOfConduct).not.toContain('security@effect-angular.dev');
  });

  it('keeps package license metadata and copied license assets in sync', () => {
    const rootLicense = readRootFile('LICENSE');

    for (const packageDefinition of packages) {
      const packageRoot = `projects/${packageDefinition.directory}`;
      const manifest = readJsonRecord(`${packageRoot}/package.json`);
      const ngPackage = readJsonRecord(`${packageRoot}/ng-package.json`);

      expect(manifest['name']).toBe(packageDefinition.name);
      expect(manifest['license']).toBe('MIT');
      expect(ngPackage['assets']).toContain('LICENSE');
      expect(readRootFile(`${packageRoot}/LICENSE`)).toBe(rootLicense);
    }
  });

  it('uses only active changesets and Knope-managed package changelogs', () => {
    const changesetGuide = readRootFile('CHANGESETS.md');
    const knopeConfig = readRootFile('knope.toml');

    expect(existsSync(rootFile('release-smoke-test.md'))).toBe(false);
    expect(existsSync(rootFile('CHANGELOG.md'))).toBe(false);
    expect(changesetGuide).toContain('not release inputs and will be ignored by Knope');

    for (const packageDefinition of packages) {
      const packageRoot = `projects/${packageDefinition.directory}`;
      const manifest = readJsonRecord(`${packageRoot}/package.json`);
      const version = manifest['version'];

      expect(typeof version).toBe('string');
      expect(knopeConfig).toContain(`changelog = "${packageRoot}/CHANGELOG.md"`);
      expect(readRootFile(`${packageRoot}/CHANGELOG.md`)).toContain(`## ${String(version)} (`);
    }
  });

  it('preserves package manifest formatting when Knope bumps versions', () => {
    const knopeConfig = readRootFile('knope.toml');
    const versionPattern = String.raw`(?m)^  "version": "(?<version>\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?)"`;

    for (const packageDefinition of packages) {
      const manifestPath = `projects/${packageDefinition.directory}/package.json`;
      const regexVersionedFile = `{ path = "${manifestPath}", regex = '${versionPattern}' }`;

      expect(knopeConfig).toContain(regexVersionedFile);
      expect(knopeConfig).not.toContain(`versioned_files = ["${manifestPath}"]`);
      expect(readRootFile(manifestPath).endsWith('\n')).toBe(true);
    }
  });
});
