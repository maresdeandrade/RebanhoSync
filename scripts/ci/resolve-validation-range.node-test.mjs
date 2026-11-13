import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

const workflow = readFileSync(".github/workflows/antigravity-validate.yml", "utf8");
const resolver = workflow.match(/- name: Resolve validation range[\s\S]*?node --input-type=module <<'NODE'\r?\n([\s\S]*?)\r?\n\s+NODE/);
assert(resolver, "The workflow must contain the range resolver");
const script = resolver[1].replace(/^ {10}/gm, "");
const repo = mkdtempSync(path.join(tmpdir(), "rebanhosync-ci-range-"));
const git = (...args) => execFileSync("git", args, { cwd: repo, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
git("init", "--quiet");
git("-c", "user.name=Fixture", "-c", "user.email=fixture@example.invalid", "commit", "--allow-empty", "-m", "base", "--quiet");
const base = git("rev-parse", "HEAD");
git("-c", "user.name=Fixture", "-c", "user.email=fixture@example.invalid", "commit", "--allow-empty", "-m", "head", "--quiet");
const head = git("rev-parse", "HEAD");
const tree = git("rev-parse", "HEAD^{tree}");
const eventFile = path.join(repo, "event.json"), outputFile = path.join(repo, "output.txt");
const eventFor = (event, baseSha, headSha) => event === "pull_request"
  ? { pull_request: { base: { sha: baseSha }, head: { sha: headSha } } }
  : event === "merge_group" ? { merge_group: { base_sha: baseSha, head_sha: headSha } }
    : { inputs: { base_sha: baseSha } };
function run(event, baseSha, headSha) {
  writeFileSync(eventFile, JSON.stringify(eventFor(event, baseSha, headSha)));
  writeFileSync(outputFile, "");
  const result = spawnSync(process.execPath, ["--input-type=module", "-"], {
    cwd: repo, input: script, encoding: "utf8",
    env: { ...process.env, GITHUB_EVENT_NAME: event, GITHUB_EVENT_PATH: eventFile,
      GITHUB_SHA: headSha ?? "", GITHUB_OUTPUT: outputFile },
  });
  return { ...result, output: readFileSync(outputFile, "utf8") };
}

for (const event of ["pull_request", "merge_group", "workflow_dispatch"]) {
  test(`${event}: resolves the validated range`, () => {
    const result = run(event, base, head);
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.output, `base_sha=${base}\nhead_sha=${head}\n`);
  });
  for (const [name, from, to] of [
    ["missing base", "", head], ["missing head", base, ""],
    ["invalid base SHA", "not-a-sha", head], ["invalid head SHA", base, "not-a-sha"],
    ["unknown base commit", "f".repeat(40), head], ["unknown head commit", base, "f".repeat(40)],
    ["base is not a commit", tree, head], ["head is not a commit", base, tree],
    ["non-ancestor", head, base],
  ]) test(`${event}: rejects ${name}`, () => {
    const result = run(event, from, to);
    assert.notEqual(result.status, 0);
    assert.equal(result.output, "");
    if (name === "non-ancestor") assert.match(result.stderr, /base must be an ancestor/);
  });
}
test("rejects unsupported events", () => assert.notEqual(run("push", base, head).status, 0));
test("both diff gates use the resolver outputs", () => {
  const outputs = workflow.match(/steps\.range\.outputs\.(?:base_sha|head_sha)/g) ?? [];
  assert.equal(outputs.filter(value => value.endsWith("base_sha")).length, 3);
  assert.equal(outputs.filter(value => value.endsWith("head_sha")).length, 3);
});
