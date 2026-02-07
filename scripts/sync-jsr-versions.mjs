const packageDirs = ['projects/effect-platform-angular', 'projects/effect-angular-query'];

for (const packageDir of packageDirs) {
  const packagePath = `${packageDir}/package.json`;
  const jsrPath = `${packageDir}/jsr.json`;

  const packageJson = await Bun.file(packagePath).json();
  const jsrJson = await Bun.file(jsrPath).json();

  if (typeof packageJson.version !== 'string' || packageJson.version.length === 0) {
    throw new Error(`Missing package version in ${packagePath}`);
  }

  jsrJson.version = packageJson.version;
  await Bun.write(jsrPath, `${JSON.stringify(jsrJson, null, 2)}\n`);
}
