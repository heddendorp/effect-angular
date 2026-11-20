import { appendFile, readFile } from 'node:fs/promises';

const workspace = JSON.parse(await readFile('angular.json', 'utf8'));
const rows = [
  '## Test coverage',
  '',
  '| Library | Lines | Statements | Branches | Functions |',
  '| --- | ---: | ---: | ---: | ---: |',
];
for (const [name, project] of Object.entries(workspace.projects)) {
  if (!project.architect?.test?.configurations?.coverage) continue;
  try {
    const { total } = JSON.parse(await readFile(`coverage/${name}/coverage-summary.json`, 'utf8'));
    const cells = ['lines', 'statements', 'branches', 'functions'].map((metric) => {
      const { pct, covered, total: count } = total[metric];
      return `${pct}% (${covered}/${count})`;
    });
    rows.push(`| ${name} | ${cells.join(' | ')} |`);
    console.log(
      `::notice file=angular.json,title=Coverage for ${name}::${cells[0]} lines, ${cells[1]} statements, ${cells[2]} branches, ${cells[3]} functions`,
    );
  } catch (error) {
    rows.push(`| ${name} | Report unavailable | | | |`);
    console.error(error);
    process.exitCode = 1;
  }
}

await appendFile(process.env.GITHUB_STEP_SUMMARY, rows.join('\n') + '\n');
