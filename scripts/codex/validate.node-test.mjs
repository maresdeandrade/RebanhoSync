import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const validator = fileURLToPath(new URL('./validate.ps1', import.meta.url));
const shell = process.platform === 'win32' ? 'powershell.exe' : 'pwsh';
const quote = (s) => `'${s.replaceAll("'", "''")}'`;

// Real Git/index/filesystem and validator; replace only costly project checks.
function fixture(t, changes = ['src/feature.ts']) {
  const root = mkdtempSync(join(tmpdir(), 'rebanho-validate-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const git = (...args) => {
    const result = spawnSync('git', args, { cwd: root, encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
    return result.stdout;
  };
  const put = (path, content = 'export const value = 1;\n') => {
    mkdirSync(resolve(root, path, '..'), { recursive: true });
    writeFileSync(join(root, path), content);
  };
  git('init', '--quiet');
  put('package.json', '{}');
  put('pnpm-lock.yaml', 'lockfileVersion: 9\n');
  put('checks/regression.test.ts');
  // Keep fixture infrastructure outside the patch, without creating commits.
  writeFileSync(join(root, '.git/info/exclude'), '/package.json\n/pnpm-lock.yaml\n/checks/\n');
  changes.forEach((path) => put(path));
  const run = (args = '-Profile focused', fail = 0) => {
    const command = `function global:pnpm { Add-Content -LiteralPath ${quote(join(root, '.git/checks.log'))} -Value ($args -join ' '); $global:LASTEXITCODE = ${fail} }; & ${quote(validator)} ${args}; exit $LASTEXITCODE`;
    const result = spawnSync(shell, ['-NoProfile', '-NonInteractive', '-Command', command], {
      cwd: root, encoding: 'utf8', timeout: 30000,
    });
    assert.ifError(result.error);
    const output = result.stdout + result.stderr;
    let checks = '';
    try { checks = readFileSync(join(root, '.git/checks.log'), 'utf8'); } catch { /* no checks */ }
    return { code: result.status, output, checks };
  };
  return { run, git, put, root };
}

test('focused without checks cannot report success', (t) => {
  const r = fixture(t).run();
  assert.notEqual(r.code, 0, r.output);
  assert.doesNotMatch(r.output, /Validation OK/);
});

for (const args of ['-Profile focused -LintPaths src/feature.ts', '-Profile standard -IncludeBuild', '-Profile standard -LintPaths src/feature.ts']) {
  test(`behavior with only structural checks is partial: ${args}`, (t) => {
    const r = fixture(t).run(args);
    assert.equal(r.code, 2, r.output);
    assert.match(r.output, /Validation PARTIAL/);
  });
}

for (const profile of ['focused', 'standard']) {
  test(`${profile} runs requested functional tests`, (t) => {
    const r = fixture(t).run(`-Profile ${profile} -TestPaths checks/regression.test.ts`);
    assert.equal(r.code, 0, r.output);
    assert.match(r.checks, /test (?:-- )?checks\/regression.test.ts/);
    assert.match(r.output, /Validation OK/);
  });
  test(`${profile} propagates failed tests`, (t) => {
    const r = fixture(t).run(`-Profile ${profile} -TestPaths checks/regression.test.ts`, 7);
    assert.notEqual(r.code, 0, r.output);
    assert.doesNotMatch(r.output, /Validation OK/);
  });
}

test('an empty patch cannot validate an unexamined commit', (t) => {
  const r = fixture(t, []).run('-Profile focused -TestPaths checks/regression.test.ts');
  assert.notEqual(r.code, 0, r.output);
  assert.match(r.output, /Validation NONE/);
  assert.equal(r.checks, '');
});

test('a caller-supplied path cannot manufacture a patch in a clean tree', (t) => {
  const r = fixture(t, []).run('-Profile focused -TouchedPaths src/feature.ts -TestPaths checks/regression.test.ts');
  assert.equal(r.code, 2, r.output);
  assert.match(r.output, /Validation NONE/);
  assert.equal(r.checks, '');
});

test('omitted scope stays partial even when requested tests pass', (t) => {
  const r = fixture(t, ['src/feature.ts', 'AGENTS.md']).run('-Profile focused -TouchedPaths AGENTS.md -TestPaths checks/regression.test.ts');
  assert.equal(r.code, 2, r.output);
  assert.match(r.output, /src\/feature.ts/);
  assert.match(r.output, /Validation PARTIAL/);
});

test('complete declared scope can pass', (t) => {
  const r = fixture(t).run('-Profile focused -TouchedPaths src/feature.ts -TestPaths checks/regression.test.ts');
  assert.equal(r.code, 0, r.output);
});

for (const stage of [false, true]) {
  test(`partial declared scope cannot hide ${stage ? 'staged' : 'untracked'} runtime`, (t) => {
    const f = fixture(t, ['AGENTS.md', 'src/feature.ts']);
    if (stage) f.git('add', 'src/feature.ts');
    const r = f.run('-Profile docs -TouchedPaths AGENTS.md');
    assert.notEqual(r.code, 0, r.output);
    assert.match(r.output, /src\/feature.ts/);
    assert.equal(r.checks, '');
  });
}

test('unstaged changes and staged deletions remain visible', (t) => {
  const f = fixture(t, ['src/feature.ts']);
  f.git('add', 'src/feature.ts');
  // Only this disposable fixture gets a synthetic HEAD; the user's Git is untouched.
  f.git('update-ref', 'HEAD', f.git('-c', 'user.name=Fixture', '-c', 'user.email=fixture@invalid', 'commit-tree', f.git('write-tree').trim(), '-m', 'fixture').trim());
  f.put('src/feature.ts', 'export const value = 2;\n');
  let r = f.run('-Profile docs -TouchedPaths AGENTS.md');
  assert.notEqual(r.code, 0, r.output);
  assert.match(r.output, /src\/feature.ts/);
  f.git('rm', '-f', 'src/feature.ts');
  r = f.run('-Profile docs');
  assert.notEqual(r.code, 0, r.output);
  assert.match(r.output, /src\/feature.ts/);
});

test('docs accepts only documentary changes and runs existing governance', (t) => {
  const r = fixture(t, ['AGENTS.md', '.agents/rules/sample.md']).run('-Profile docs');
  assert.equal(r.code, 0, r.output);
  assert.match(r.checks, /run gates:docs/);
  assert.match(r.output, /Validation OK/);
});

test('documentary changes cannot get OK from a possibly ignored eslint target', (t) => {
  const r = fixture(t, ['AGENTS.md']).run('-Profile focused -LintPaths AGENTS.md');
  assert.notEqual(r.code, 0, r.output);
  assert.equal(r.checks, '');
});

for (const path of ['scripts/run.ps1', '.agents/hooks.json', 'src/readme.md', 'pnpm-lock.yaml']) {
  test(`docs rejects non-documentary scope: ${path}`, (t) => {
    const f = fixture(t, [path]);
    if (path === 'pnpm-lock.yaml') f.git('add', '-f', path);
    const r = f.run('-Profile docs');
    assert.notEqual(r.code, 0, r.output);
    assert.equal(r.checks, '');
  });
}

for (const args of ['-Profile focused -IncludeBuild', '-Profile full', '-Profile full -ConfirmFull -IncludeBuild', '-Profile focused -ConfirmFull', '-Profile standard', '-Profile docs -IncludeBuild', '-Profile focused -TestPaths missing.test.ts', '-Profile focused -TestPaths ../escape.test.ts']) {
  test(`rejects invalid request: ${args}`, (t) => {
    const r = fixture(t).run(args);
    assert.notEqual(r.code, 0, r.output);
    assert.doesNotMatch(r.output, /Validation OK/);
    assert.equal(r.checks, '');
  });
}

test('full requires confirmation and keeps its fixed command contract', (t) => {
  const r = fixture(t).run('-Profile full -ConfirmFull');
  assert.equal(r.code, 0, r.output);
  assert.deepEqual(r.checks.trim().split(/\r?\n/), ['run lint', 'test', 'run build']);
});

test('docs propagates governance failure', (t) => {
  const r = fixture(t, ['AGENTS.md']).run('-Profile docs', 9);
  assert.notEqual(r.code, 0, r.output);
  assert.doesNotMatch(r.output, /Validation OK/);
});

test('full stops on failure without running later checks', (t) => {
  const r = fixture(t).run('-Profile full -ConfirmFull', 8);
  assert.notEqual(r.code, 0, r.output);
  assert.equal(r.checks.trim(), 'run lint');
  assert.doesNotMatch(r.output, /Validation OK/);
});
