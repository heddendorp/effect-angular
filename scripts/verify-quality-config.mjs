import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const workspaceRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const readJson = (path) => JSON.parse(readFileSync(join(workspaceRoot, path), 'utf8'));

const manifest = readJson('package.json');
const workspace = readJson('angular.json');
const scripts = manifest.scripts;
const devDependencies = manifest.devDependencies;

const vitestVersion = '4.1.10';
for (const dependency of ['vitest', '@vitest/browser-playwright', '@vitest/coverage-v8']) {
  assert.equal(
    devDependencies[dependency],
    vitestVersion,
    `${dependency} must stay aligned at the patched Vitest version`,
  );
}

for (const dependency of [
  '@eslint/js',
  'angular-eslint',
  'eslint',
  'prettier',
  'typescript-eslint',
]) {
  assert.match(
    devDependencies[dependency],
    /^\d+\.\d+\.\d+$/,
    `${dependency} must be pinned to an exact version`,
  );
}

assert.ok(!Object.hasOwn(scripts, 'start'), 'A library-only workspace must not expose ng serve');
assert.ok(!Object.hasOwn(scripts, 'watch'), 'Library watch scripts must name their target');
assert.match(scripts['watch:platform'], /build effect-platform-angular --watch/);
assert.match(scripts['watch:query'], /build effect-angular-query --watch/);
assert.match(scripts['pack:check'], /pack:verify/);
assert.match(scripts['pack:check'], /consumer:smoke/);
assert.equal(scripts['audit:ci'], 'bun audit --audit-level=high');

const expectedCoverageThresholds = {
  'effect-platform-angular': {
    statements: 90,
    branches: 75,
    functions: 90,
    lines: 90,
  },
  'effect-angular-query': {
    statements: 95,
    branches: 90,
    functions: 95,
    lines: 95,
  },
};

for (const [projectName, thresholds] of Object.entries(expectedCoverageThresholds)) {
  const coverageConfiguration =
    workspace.projects[projectName]?.architect?.test?.configurations?.coverage;

  assert.equal(coverageConfiguration?.coverage, true, `${projectName} must collect coverage`);
  assert.deepEqual(
    coverageConfiguration?.coverageThresholds,
    thresholds,
    `${projectName} coverage thresholds changed without updating the quality contract`,
  );
}

const prettierIgnore = readFileSync(join(workspaceRoot, '.prettierignore'), 'utf8');
const eslintConfig = readFileSync(join(workspaceRoot, 'eslint.config.mjs'), 'utf8');
assert.match(prettierIgnore, /^repos\/effect\/$/m, 'Prettier must ignore vendored Effect source');
assert.match(eslintConfig, /repos\/effect\/\*\*/, 'ESLint must ignore vendored Effect source');

console.log('Verified root quality configuration.');
