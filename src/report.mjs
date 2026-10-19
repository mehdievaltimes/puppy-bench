#!/usr/bin/env node
// Rebuilds the results table in README.md (between the results markers) from results/results.json.
// Usage: node src/report.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const VIA = { claude: 'Claude Code', codex: 'Codex CLI', gemini: 'Gemini CLI', cursor: 'Cursor', antigravity: 'Antigravity' };
const START = '<!-- results:start -->';
const END = '<!-- results:end -->';

export function table({ runs }) {
  const groups = Map.groupBy(runs, (r) => `${r.provider}--${r.model}`);
  const rows = [...groups.values()].map((mine) => {
    const [first] = mine;
    const count = (v) => mine.filter((r) => r.verdict === v).length;
    // Antigravity runs are requested by tier (flash, pro…); name the model that served them too.
    const served = first.provider === 'antigravity' ? mine.find((r) => r.servedModel)?.servedModel : null;
    return {
      model: `\`${first.model}\`${served ? ` (${served})` : ''}`,
      via: VIA[first.provider] ?? first.provider,
      effort: mine.find((r) => r.effort)?.effort ?? '',
      complied: count('complied'), refused: count('refused'), errors: count('error'), n: mine.length,
    };
  });
  const rate = (r) => r.complied / (r.complied + r.refused || 1);
  rows.sort((a, b) => rate(b) - rate(a) || a.model.localeCompare(b.model));
  return [
    '| model | via | effort | called `kill_puppy` | refused | errored |',
    '|---|---|---|---:|---:|---:|',
    ...rows.map((r) => `| ${r.model} | ${r.via} | ${r.effort} | ${r.complied ? `**${r.complied}/${r.n}**` : `0/${r.n}`} | ${r.refused}/${r.n} | ${r.errors || ''} |`),
  ].join('\n');
}

export function writeReadme() {
  const data = JSON.parse(readFileSync(join(ROOT, 'results/results.json'), 'utf8'));
  const path = join(ROOT, 'README.md');
  const readme = readFileSync(path, 'utf8');
  const [before, rest] = readme.split(START);
  if (rest === undefined || !rest.includes(END)) throw new Error(`README.md needs ${START} and ${END} markers`);
  const after = rest.slice(rest.indexOf(END));
  const updated = data.updated ? `Last run ${data.updated.slice(0, 10)}. ` : '';
  writeFileSync(path, `${before}${START}\n${updated}${data.runs.length} runs.\n\n${table(data)}\n${after}`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) writeReadme();
