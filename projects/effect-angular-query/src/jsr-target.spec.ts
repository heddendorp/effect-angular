import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

type JsrConfig = {
  readonly name?: unknown;
  readonly version?: unknown;
  readonly exports?: unknown;
  readonly license?: unknown;
};

const rootFile = (name: string): string => join(process.cwd(), name);

const readJsrConfig = (path: string): JsrConfig =>
  JSON.parse(readFileSync(path, 'utf8')) as JsrConfig;

describe('JSR target configuration', () => {
  it('defines JSR manifests for both scoped packages', () => {
    const platformPath = rootFile('projects/effect-platform-angular/jsr.json');
    const queryPath = rootFile('projects/effect-angular-query/jsr.json');

    expect(existsSync(platformPath)).toBe(true);
    expect(existsSync(queryPath)).toBe(true);

    const platformConfig = readJsrConfig(platformPath);
    const queryConfig = readJsrConfig(queryPath);

    expect(platformConfig.name).toBe('@heddendorp/effect-platform-angular');
    expect(queryConfig.name).toBe('@heddendorp/effect-angular-query');
    expect(platformConfig.exports).toBe('./src/public-api.ts');
    expect(queryConfig.exports).toBe('./src/public-api.ts');
    expect(platformConfig.license).toBe('MIT');
    expect(queryConfig.license).toBe('MIT');
  });
});
