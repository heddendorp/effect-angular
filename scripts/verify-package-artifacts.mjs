import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { spawnNpmSync } from './npm-command.mjs';

const workspaceRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const expectedLicense = await readFile(join(workspaceRoot, 'LICENSE'), 'utf8');
const packages = [
  {
    directory: 'effect-platform-angular',
    name: '@heddendorp/effect-platform-angular',
  },
  {
    directory: 'effect-angular-query',
    name: '@heddendorp/effect-angular-query',
  },
];

for (const packageDefinition of packages) {
  const packageDirectory = join(workspaceRoot, 'dist', packageDefinition.directory);
  const manifestPath = join(packageDirectory, 'package.json');
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));

  assert.equal(
    manifest.name,
    packageDefinition.name,
    `${manifestPath} must describe the expected package`,
  );
  assert.equal(manifest.license, 'MIT', `${packageDefinition.name} must declare the MIT license`);
  assert.equal(
    await readFile(join(packageDirectory, 'LICENSE'), 'utf8'),
    expectedLicense,
    `${packageDefinition.name} must contain the repository MIT license`,
  );

  const result = spawnNpmSync(['pack', '--dry-run', '--json'], {
    cwd: packageDirectory,
    encoding: 'utf8',
  });

  assert.equal(
    result.status,
    0,
    `npm pack failed for ${packageDefinition.name}: ${result.stderr || result.stdout}`,
  );

  const packResults = JSON.parse(result.stdout);
  assert.equal(
    packResults.length,
    1,
    `npm pack must return one result for ${packageDefinition.name}`,
  );
  assert.equal(packResults[0].name, packageDefinition.name);

  const packedFiles = new Set(packResults[0].files.map((file) => file.path));
  assert.ok(
    packedFiles.has('LICENSE'),
    `${packageDefinition.name} tarball must include the MIT LICENSE file`,
  );

  console.log(`Verified ${packageDefinition.name}: MIT metadata and LICENSE are packed.`);
}
