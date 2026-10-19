// Bumps Stint's version everywhere it is stored and prints the new one.
// Usage: node scripts/bump-version.mjs patch|minor|major
import { readFileSync, writeFileSync } from "node:fs";

const part = process.argv[2];
if (!["patch", "minor", "major"].includes(part)) {
  console.error("Usage: node scripts/bump-version.mjs patch|minor|major");
  process.exit(1);
}

const current = JSON.parse(readFileSync("package.json", "utf8")).version;
let [major, minor, patch] = current.split(".").map(Number);
if (part === "major") [major, minor, patch] = [major + 1, 0, 0];
if (part === "minor") [minor, patch] = [minor + 1, 0];
if (part === "patch") patch += 1;
const next = `${major}.${minor}.${patch}`;

function edit(file, from, to) {
  const text = readFileSync(file, "utf8");
  if (!from.test(text)) throw new Error(`No version found in ${file}`);
  writeFileSync(file, text.replace(from, to));
}

const quoted = (v) => v.replaceAll(".", "\\.");
// The first "version" in package.json, package-lock.json (twice) and tauri.conf.json is Stint's own.
edit("package.json", new RegExp(`"version": "${quoted(current)}"`), `"version": "${next}"`);
edit("src-tauri/tauri.conf.json", new RegExp(`"version": "${quoted(current)}"`), `"version": "${next}"`);
edit("package-lock.json", new RegExp(`("name": "stint",\\s*"version": )"${quoted(current)}"`, "g"), `$1"${next}"`);
edit("src-tauri/Cargo.toml", new RegExp(`^version = "${quoted(current)}"`, "m"), `version = "${next}"`);
edit("src-tauri/Cargo.lock", new RegExp(`(name = "stint"\\nversion = )"${quoted(current)}"`), `$1"${next}"`);

console.log(next);
