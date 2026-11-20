import { readFile } from 'node:fs/promises';

const workspace = JSON.parse(await readFile('angular.json', 'utf8'));
console.log('## Test coverage\n');
console.log('| Library | Lines | Statements | Branches | Functions |');
console.log('| --- | ---: | ---: | ---: | ---: |');
for (const [name, project] of Object.entries(workspace.projects)) {
  if (!project.architect?.test?.configurations?.coverage) continue;
  try {
    const { total } = JSON.parse(await readFile(`coverage/${name}/coverage-summary.json`, 'utf8'));
    const cells = ['lines', 'statements', 'branches', 'functions'].map((metric) => {
      const { pct, covered, total: count } = total[metric];
      return `${pct}% (${covered}/${count})`;
    });
    console.log(`| ${name} | ${cells.join(' | ')} |`);
  } catch (error) {
    console.log(`| ${name} | Report unavailable | | | |`);
    console.error(error);
    process.exitCode = 1;
  }
}
