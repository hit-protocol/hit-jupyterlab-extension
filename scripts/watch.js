/**
 * watch.js — Development watch script for hit-jupyterlab-extension.
 *
 * Mirrors the pattern from the official JupyterLab extension cookiecutter.
 * Watches TypeScript source files and rebuilds the labextension on change.
 *
 * Usage: npm run watch  (runs both watch:src and watch:labextension in parallel)
 */
const { execSync, spawn } = require("child_process");
const path = require("path");

const cwd = path.resolve(__dirname, "..");

console.log("[HIT Watch] Starting labextension watcher…");

// Run the labextension watcher as a child process
const watcher = spawn(
  "python",
  ["-m", "jupyterlab.labextensions", "watch", "."],
  { cwd, stdio: "inherit", shell: true }
);

watcher.on("close", (code) => {
  console.log(`[HIT Watch] Watcher exited with code ${code}`);
});

process.on("SIGINT", () => {
  watcher.kill("SIGINT");
  process.exit(0);
});
