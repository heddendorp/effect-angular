import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { createNpmRunner } from './npm-command.mjs';

describe('createNpmRunner', () => {
  it('passes npm arguments to cross-spawn without joining them', () => {
    const calls = [];
    const runNpm = createNpmRunner((command, arguments_, options) => {
      calls.push({ command, arguments: arguments_, options });
      return { status: 0 };
    });
    const npmArguments = [
      'pack',
      '--pack-destination',
      String.raw`C:\work directory\artifacts & logs`,
    ];
    const options = { cwd: String.raw`C:\workspace with spaces` };

    assert.deepEqual(runNpm(npmArguments, options), { status: 0 });
    assert.deepEqual(calls, [{ command: 'npm', arguments: npmArguments, options }]);
  });
});
