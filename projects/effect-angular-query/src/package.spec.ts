import packageJson from '../package.json';

type JsonRecord = Record<string, unknown>;
type PeerDependencies = Record<string, string>;

const isRecord = (value: unknown): value is JsonRecord =>
  typeof value === 'object' && value !== null;

const readPeerDependencies = (): PeerDependencies => {
  const parsed: unknown = packageJson;

  if (!isRecord(parsed)) {
    return {};
  }

  const peerDependencies = parsed['peerDependencies'];
  if (!isRecord(peerDependencies)) {
    return {};
  }

  const result: PeerDependencies = {};
  for (const [key, value] of Object.entries(peerDependencies)) {
    if (typeof value === 'string') {
      result[key] = value;
    }
  }

  return result;
};

describe('effect-angular-query package metadata', () => {
  it('declares required peer dependencies for the integration', () => {
    expect(readPeerDependencies()).toMatchObject({
      '@angular/common': expect.any(String),
      '@angular/core': expect.any(String),
      '@effect/rpc': expect.any(String),
      '@tanstack/angular-query-experimental': expect.any(String),
      effect: expect.any(String),
    });
  });
});
