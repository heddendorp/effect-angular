import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const workspaceRoot = resolve(fileURLToPath(new URL('..', import.meta.url)));
const temporaryDirectory = mkdtempSync(join(tmpdir(), 'effect-angular-consumer-'));
const tarballDirectory = join(temporaryDirectory, 'tarballs');
const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';

const readJson = (path) => JSON.parse(readFileSync(path, 'utf8'));

const installedVersion = (packageName) => {
  const packagePath = join(
    workspaceRoot,
    'node_modules',
    ...packageName.split('/'),
    'package.json',
  );
  return readJson(packagePath).version;
};

const run = (command, args, options = {}) =>
  execFileSync(command, args, {
    cwd: workspaceRoot,
    encoding: 'utf8',
    stdio: options.capture ? ['ignore', 'pipe', 'inherit'] : 'inherit',
    ...options,
  });

const pack = (distributionDirectory) => {
  const output = run(npmCommand, ['pack', '--json', '--pack-destination', tarballDirectory], {
    capture: true,
    cwd: distributionDirectory,
  });
  const result = JSON.parse(output);

  if (!Array.isArray(result) || result.length !== 1 || typeof result[0]?.filename !== 'string') {
    throw new Error(`Unexpected npm pack output for ${distributionDirectory}`);
  }

  return join(tarballDirectory, result[0].filename);
};

try {
  mkdirSync(tarballDirectory);

  const platformTarball = pack(join(workspaceRoot, 'dist', 'effect-platform-angular'));
  const queryTarball = pack(join(workspaceRoot, 'dist', 'effect-angular-query'));

  writeFileSync(
    join(temporaryDirectory, 'package.json'),
    `${JSON.stringify(
      {
        name: 'effect-angular-consumer-smoke-test',
        private: true,
        type: 'module',
        dependencies: {
          '@angular/common': installedVersion('@angular/common'),
          '@angular/compiler': installedVersion('@angular/compiler'),
          '@angular/core': installedVersion('@angular/core'),
          '@heddendorp/effect-angular-query': `file:${queryTarball}`,
          '@heddendorp/effect-platform-angular': `file:${platformTarball}`,
          '@tanstack/angular-query-experimental': installedVersion(
            '@tanstack/angular-query-experimental',
          ),
          effect: installedVersion('effect'),
          rxjs: installedVersion('rxjs'),
          tslib: installedVersion('tslib'),
        },
        devDependencies: {
          '@types/node': installedVersion('@types/node'),
          typescript: installedVersion('typescript'),
        },
      },
      null,
      2,
    )}\n`,
  );

  writeFileSync(
    join(temporaryDirectory, 'tsconfig.json'),
    // Effect 4 beta.97 currently has two internal declaration defects unrelated to these
    // libraries: missing SchemaErrorTypeId and appendPreResponseHandlerUnsafe declarations.
    // Keep public consumer usage checked while ng-packagr validates our generated declarations.
    `${JSON.stringify(
      {
        compilerOptions: {
          lib: ['ES2022', 'ESNext.Disposable', 'DOM'],
          module: 'NodeNext',
          moduleResolution: 'NodeNext',
          noEmit: true,
          skipLibCheck: true,
          strict: true,
          target: 'ES2022',
          types: ['node'],
          verbatimModuleSyntax: true,
        },
        files: ['consumer.ts'],
      },
      null,
      2,
    )}\n`,
  );

  writeFileSync(
    join(temporaryDirectory, 'consumer.ts'),
    `import type { EnvironmentProviders } from '@angular/core';
import { Effect } from 'effect';
import {
  EFFECT_HTTP_CLIENT,
  provideEffectHttpClient,
} from '@heddendorp/effect-platform-angular';
import {
  createRpcPathKey,
  createRpcQueryKey,
  type RpcQueryKey,
} from '@heddendorp/effect-angular-query';

const providers: EnvironmentProviders = provideEffectHttpClient();
const queryKey: RpcQueryKey<{ readonly id: string }> = createRpcQueryKey(['users', 'get'], {
  input: { id: '1' },
  type: 'query',
});
const pathKey = createRpcPathKey(['users']);
const program = Effect.succeed({ pathKey, queryKey });

void [EFFECT_HTTP_CLIENT, program, providers];
`,
  );

  writeFileSync(
    join(temporaryDirectory, 'smoke.mjs'),
    `import '@angular/compiler';
import {
  EFFECT_HTTP_CLIENT,
  provideEffectHttpClient,
} from '@heddendorp/effect-platform-angular';
import { createRpcQueryKey } from '@heddendorp/effect-angular-query';

const providers = provideEffectHttpClient();
const queryKey = createRpcQueryKey(['users', 'get'], {
  input: { id: '1' },
  type: 'query',
});

if (!EFFECT_HTTP_CLIENT || !providers || queryKey[0].join('.') !== 'users.get') {
  throw new Error('Packed libraries did not expose working public APIs');
}
`,
  );

  run(
    npmCommand,
    [
      'install',
      '--ignore-scripts',
      '--no-audit',
      '--no-fund',
      '--package-lock=false',
      '--strict-peer-deps',
    ],
    { cwd: temporaryDirectory },
  );
  run(process.execPath, ['node_modules/typescript/bin/tsc', '--project', 'tsconfig.json'], {
    cwd: temporaryDirectory,
  });
  run(process.execPath, ['smoke.mjs'], { cwd: temporaryDirectory });

  console.log('Packed-library consumer smoke test passed.');
} finally {
  if (process.env.KEEP_CONSUMER_SMOKE_TEMP === '1') {
    console.log(`Consumer smoke test directory retained at ${temporaryDirectory}`);
  } else {
    rmSync(temporaryDirectory, { force: true, recursive: true });
  }
}
