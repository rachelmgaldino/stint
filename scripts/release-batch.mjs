// Works out what a release run should ship: every PR merged since the latest
// version tag, up to the given commit. Prints the bump (patch, minor, major) or
// "none" when there is nothing to release, and logs the batch to stderr.
// Usage: node scripts/release-batch.mjs <commit>
import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";

const NO_RELEASE = "no release";

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

function run(command, args) {
  return execFileSync(command, args, { encoding: "utf8" }).trim();
}

function batchFor(commit) {
  const tag = run("git", ["tag", "--list", "v*", "--sort=-v:refname"]).split("\n")[0];
  const range = tag ? `${tag}..${commit}` : commit;
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
  const prs = merged
    .filter((pr) => pr.mergeCommit && commits.has(pr.mergeCommit.oid))
    .map((pr) => ({ number: pr.number, labels: pr.labels.map((label) => label.name) }));

  return { tag, prs };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const commit = process.argv[2];
  if (!commit) {
    console.error("Usage: node scripts/release-batch.mjs <commit>");
    process.exit(1);
  }

  const { tag, prs } = batchFor(commit);
  const bump = pickBump(prs);
  const listed = prs.map((pr) => `#${pr.number}${pr.labels.includes(NO_RELEASE) ? ` (${NO_RELEASE})` : ""}`);
  console.error(`PRs since ${tag || "the first commit"}: ${listed.join(", ") || "none"}`);
  console.error(`Bump: ${bump}`);
  console.log(bump);
}
