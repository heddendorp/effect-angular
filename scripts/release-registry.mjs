import { readFile } from 'node:fs/promises';
import { setTimeout as delay } from 'node:timers/promises';
import { pathToFileURL } from 'node:url';

export async function registryVersion(name, selector, fetchMetadata = globalThis.fetch) {
  const url = new URL(
    `/${encodeURIComponent(name)}/${encodeURIComponent(selector)}`,
    'https://registry.npmjs.org',
  );
  const response = await fetchMetadata(url, {
    cache: 'no-store',
    signal: globalThis.AbortSignal.timeout(10_000),
  });
  if (response.status === 404) return undefined;
  if (!response.ok)
    throw new Error(`npm registry returned HTTP ${response.status} for ${name}@${selector}`);
  const manifest = await response.json();
  if (
    manifest.name !== name ||
    typeof manifest.version !== 'string' ||
    (selector !== 'latest' && manifest.version !== selector)
  ) {
    throw new Error(`Unexpected registry metadata for ${name}@${selector}`);
  }
  return manifest.version;
}

export async function verifyLatest({ name, version }, lookup = registryVersion, pause = delay) {
  for (let attempt = 1; attempt <= 40; attempt++) {
    try {
      const [published, latest] = await Promise.all([
        lookup(name, version),
        lookup(name, 'latest'),
      ]);
      if (published === version && latest === version) {
        console.log(`Verified ${name}@${version} as latest`);
        return;
      }
      throw new Error(
        `Published version: ${published ?? 'missing'}, latest: ${latest ?? 'missing'}`,
      );
    } catch (error) {
      if (attempt === 40) throw new Error(`Could not verify ${name}@${version}`, { cause: error });
      console.error(`Waiting for ${name}@${version}: ${error.message}`);
      await pause(10_000);
    }
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [, , command, ...directories] = process.argv;
  const manifests = await Promise.all(
    directories.map(async (directory) =>
      JSON.parse(await readFile(`${directory}/package.json`, 'utf8')),
    ),
  );
  if (command === 'check' && manifests.length === 1) {
    const { name, version } = manifests[0];
    console.log(`publish=${(await registryVersion(name, version)) === undefined}`);
  } else if (command === 'verify' && manifests.length > 0) {
    await Promise.all(manifests.map((manifest) => verifyLatest(manifest)));
  } else {
    throw new Error('Expected check <package directory> or verify <package directories...>');
  }
}
