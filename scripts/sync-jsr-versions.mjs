import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const packageDirs = ['projects/effect-platform-angular', 'projects/effect-angular-query'];

for (const packageDir of packageDirs) {
  const packagePath = join(packageDir, 'package.json');
  const jsrPath = join(packageDir, 'jsr.json');

  const packageJson = JSON.parse(readFileSync(packagePath, 'utf8'));
  const jsrJson = JSON.parse(readFileSync(jsrPath, 'utf8'));

  if (typeof packageJson.version !== 'string' || packageJson.version.length === 0) {
    throw new Error(`Missing package version in ${packagePath}`);
  }

  jsrJson.version = packageJson.version;
  writeFileSync(jsrPath, `${JSON.stringify(jsrJson, null, 2)}\n`, 'utf8');
}
