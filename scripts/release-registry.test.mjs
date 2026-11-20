import assert from 'node:assert/strict';
import test from 'node:test';
import { registryVersion, verifyLatest } from './release-registry.mjs';

test('only an explicit 404 marks a version as unpublished', async () => {
  const check = (status) =>
    registryVersion('@scope/lib', '1.2.0', async () => new globalThis.Response(null, { status }));
  assert.equal(await check(404), undefined);
  await assert.rejects(check(503), /503/);
  await assert.rejects(
    registryVersion('@scope/lib', '1.2.0', async () => {
      throw new Error('offline');
    }),
    /offline/,
  );
});

test('waits for both the published manifest and latest tag', async () => {
  let attempt = 0;
  await verifyLatest(
    { name: '@scope/lib', version: '1.2.0' },
    async (_, selector) => {
      if (selector === 'latest') return attempt === 0 ? '1.1.0' : '1.2.0';
      return attempt === 1 ? undefined : '1.2.0';
    },
    async () => {
      attempt++;
    },
  );
  assert.equal(attempt, 2);
});
