// Works out what a release run should ship: every PR merged since the highest
// published version, up to the given commit. A version that was tagged but never
// published doesn't count, so its PRs go out with the next run. Prints two
// GITHUB_OUTPUT lines, bump=<patch, minor, major or none> and previous=<base tag,
// empty if there is none>, and logs the batch to stderr. Any failure prints a
// ::error:: annotation to stderr, exits non-zero and prints nothing to stdout.
// Usage: node scripts/release-batch.mjs <commit> <pr-number>
import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";

const NO_RELEASE = "no release";
const VERSION_TAG = /^v\d+\.\d+\.\d+$/;

// Takes [{ labels: ["minor", ...] }, ...]. The highest label wins, a PR with no
// label is a patch, and a "no release" PR counts for nothing, whatever else it has.
export function pickBump(prs) {
  const released = prs.filter((pr) => !pr.labels.includes(NO_RELEASE));
  if (released.length === 0) return "none";
  const labels = released.flatMap((pr) => pr.labels);
  if (labels.includes("major")) return "major";
  if (labels.includes("minor")) return "minor";
  return "patch";
}

// Takes the raw `gh pr list` JSON and a Set of commit shas, and returns the PRs
// merged in those commits as [{ number, labels: ["minor", ...] }, ...]. The run's
// own PR must be in the list with a merge commit, or the run can't tell whether it
// should release; it may fall outside the commits, if an earlier batch shipped it.
export function selectBatch(merged, commits, ownNumber) {
  const own = merged.find((pr) => pr.number === ownNumber);
  if (!own) {
    throw new Error(`PR #${ownNumber} was not found in the merged list, so its release can't be decided.`);
  }
  if (!own.mergeCommit) {
    throw new Error(`PR #${ownNumber} has no merge commit, so its release can't be decided.`);
  }

  return merged
    .filter((pr) => pr.mergeCommit && commits.has(pr.mergeCommit.oid))
    .map((pr) => ({ number: pr.number, labels: pr.labels.map((label) => label.name) }));
}

// Takes an array of tags and returns the highest vX.Y.Z one, compared number by
// number (v1.7.10 beats v1.7.9), or "" if there is none. Anything else is ignored.
export function highestVersion(tags) {
  const parts = (tag) => tag.slice(1).split(".").map(Number);
  const compare = (a, b) => {
    const [x, y] = [parts(a), parts(b)];
    return x[0] - y[0] || x[1] - y[1] || x[2] - y[2];
  };
  return tags.filter((tag) => VERSION_TAG.test(tag)).sort(compare).at(-1) ?? "";
}

function run(command, args) {
  return execFileSync(command, args, { encoding: "utf8" }).trim();
}

function batchFor(commit, ownNumber) {
  // Test PR builds are pre-releases, so they are left out. The list runs newest
  // created first, so an old version published late could be at the top: the base
  // is the highest version, not the first one listed.
  const releases = JSON.parse(
    run("gh", [
      "release", "list",
      "--exclude-pre-releases",
      "--exclude-drafts",
      "--limit", "20",
      "--json", "tagName",
    ]),
  );
  const base = highestVersion(releases.map((release) => release.tagName));
  const range = base ? `${base}..${commit}` : commit;
  const commits = new Set(run("git", ["rev-list", range]).split("\n"));

  // Not --search: its index lags behind a merge that just happened. For every
  // merge method, mergeCommit is the commit that landed on main.
  const merged = JSON.parse(
    run("gh", [
      "pr", "list",
      "--state", "merged",
      "--base", "main",
      "--limit", "200",
      "--json", "number,labels,mergeCommit",
    ]),
  );

  return { base, prs: selectBatch(merged, commits, ownNumber) };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [commit, prNumber] = process.argv.slice(2);
  if (!commit || !prNumber) {
    console.error("Usage: node scripts/release-batch.mjs <commit> <pr-number>");
    process.exit(1);
  }

  try {
    const { base, prs } = batchFor(commit, Number(prNumber));
    const bump = pickBump(prs);
    const listed = prs.map((pr) => `#${pr.number}${pr.labels.includes(NO_RELEASE) ? ` (${NO_RELEASE})` : ""}`);
    console.error(`PRs since ${base || "the first commit"}: ${listed.join(", ") || "none"}`);
    console.error(`Bump: ${bump}`);
    console.log(`bump=${bump}\nprevious=${base}`);
  } catch (error) {
    // stderr, because stdout goes into GITHUB_OUTPUT. %0A keeps a multi-line gh
    // error in one annotation.
    console.error(`::error::${error.message.trim().replace(/\r?\n/g, "%0A")}`);
    process.exit(1);
  }
}
