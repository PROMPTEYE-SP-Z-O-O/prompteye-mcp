/**
 * Packs the server into a .mcpb bundle Claude Desktop can install in one click.
 *
 * Everything is staged into build/bundle first so the archive holds exactly what
 * is meant to ship — the compiled server, the widget, the manifest and the
 * production dependencies — and nothing else.
 */
import { execFileSync } from "child_process";
import fs from "fs";
import path from "path";

const root = process.cwd();
const buildDir = path.join(root, "build");
const stage = path.join(buildDir, "bundle");

const run = (command, args, cwd = root) =>
  execFileSync(command, args, { cwd, stdio: "inherit", shell: process.platform === "win32" });

fs.rmSync(buildDir, { recursive: true, force: true });
fs.mkdirSync(stage, { recursive: true });

for (const entry of ["manifest.json", "package.json", "package-lock.json", "README.md", "LICENSE"]) {
  const from = path.join(root, entry);
  if (fs.existsSync(from)) fs.copyFileSync(from, path.join(stage, entry));
}

for (const dir of ["dist", "public"]) {
  const from = path.join(root, dir);
  if (!fs.existsSync(from)) throw new Error(`Missing ${dir}/ — run \`npm run build\` first.`);
  fs.cpSync(from, path.join(stage, dir), { recursive: true });
}

// The user's machine installs nothing, so the runtime dependencies ship inside.
run("npm", ["ci", "--omit=dev", "--ignore-scripts"], stage);

/*
 * server.js finds the widget at ../public relative to its own directory. If the
 * staged layout ever stops matching that, the server falls back to a placeholder
 * and the widget silently disappears — so assert the exact path it will resolve.
 */
const widget = path.resolve(path.join(stage, "dist"), "../public/widget-shell.html");
if (!fs.existsSync(widget)) {
  throw new Error(`The widget is not where the server will look for it: ${widget}`);
}

const output = path.join(buildDir, "prompteye-mcp.mcpb");
run("npx", ["--yes", "@anthropic-ai/mcpb", "pack", stage, output]);

console.log(`\nBundled → ${path.relative(root, output)}`);
