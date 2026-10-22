// Fails a pull request whose description doesn't follow .github/pull_request_template.md:
// the required sections must be filled in, at least one type of change ticked and every
// checklist item ticked. Run by the "PR description" workflow; bots (Dependabot) are skipped.
//
// Local check: GITHUB_EVENT_PATH=event.json node .github/scripts/check-pr-description.mjs
import { readFileSync } from 'node:fs';

const REQUIRED_SECTIONS = ['What and why', 'Related issue', 'How was this tested'];

const { pull_request: pr } = JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH, 'utf8'));
if (pr.user?.type === 'Bot') {
  console.log(`Skipped: opened by ${pr.user.login}.`);
  process.exit(0);
}

// The template's hints are HTML comments; whatever is left is what the author wrote.
const body = (pr.body ?? '').replace(/<!--[\s\S]*?-->/g, '').replace(/\r\n/g, '\n');

/** "## Title" → the text below it, up to the next "## " heading. */
const sections = new Map();
for (const part of body.split(/^## /m).slice(1)) {
  const newline = part.indexOf('\n');
  const title = (newline === -1 ? part : part.slice(0, newline)).trim().toLowerCase();
  sections.set(title, newline === -1 ? '' : part.slice(newline + 1).trim());
}

/** Whether each "- [ ]" / "- [x]" box in a section is ticked. */
const boxes = (title) =>
  [...(sections.get(title.toLowerCase()) ?? '').matchAll(/^\s*[-*] \[([ xX])\]/gm)].map(
    (match) => match[1] !== ' '
  );

const problems = [];
for (const title of REQUIRED_SECTIONS) {
  const text = sections.get(title.toLowerCase());
  if (text === undefined) problems.push(`The section "## ${title}" is missing.`);
  else if (!text) problems.push(`The section "## ${title}" is empty.`);
}
if (!boxes('Type of change').some(Boolean)) {
  problems.push('Tick at least one box under "## Type of change".');
}
const checklist = boxes('Checklist');
if (checklist.length === 0) problems.push('The "## Checklist" section is missing.');
else if (!checklist.every(Boolean)) {
  const open = checklist.filter((ticked) => !ticked).length;
  problems.push(`Tick every item under "## Checklist" (${open} still open).`);
}

if (problems.length > 0) {
  for (const problem of problems) console.log(`::error title=PR description::${problem}`);
  console.log(
    '\nPlease fill in the description following .github/pull_request_template.md and save it; this check re-runs on every edit.'
  );
  process.exit(1);
}
console.log('The PR description follows the template.');
