// Prints the version of a pull request's test build.
// Usage: node scripts/test-version.mjs <pr> <build>
//
// A test build is the next patch with the PR and build number after it, such
// as 1.4.4-pr.49.120 while main is at 1.4.3: newer than the release it was
// built on, older than the release that ships it, and different on every push.
import { readFileSync } from "node:fs";

const [pr, build] = process.argv.slice(2).map(Number);
if (!Number.isInteger(pr) || !Number.isInteger(build)) {
  console.error("Usage: node scripts/test-version.mjs <pr> <build>");
  process.exit(1);
}

const [major, minor, patch] = JSON.parse(readFileSync("package.json", "utf8")).version.split(".").map(Number);
console.log(`${major}.${minor}.${patch + 1}-pr.${pr}.${build}`);
