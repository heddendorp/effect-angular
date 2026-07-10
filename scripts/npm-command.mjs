import crossSpawn from 'cross-spawn';

/**
 * Creates a synchronous npm runner. `cross-spawn` resolves Windows command
 * shims and escapes their arguments without requiring callers to build a shell
 * command string.
 */
export const createNpmRunner = (spawnSync = crossSpawn.sync) =>
  function spawnNpmSync(npmArguments, options) {
    return spawnSync('npm', npmArguments, options);
  };

export const spawnNpmSync = createNpmRunner();
