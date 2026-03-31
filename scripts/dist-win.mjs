import { spawnSync } from "node:child_process";

function run(command, args) {
  const result = spawnSync(command, args, {
    stdio: "inherit",
    shell: process.platform === "win32",
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

if (process.platform !== "win32") {
  console.error("dist:win must be run on Windows so Playwright installs the correct Windows Chromium bundle for the packaged app.");
  process.exit(1);
}

run("npm", ["run", "build"]);
run("npm", ["run", "prepare:playwright-browsers"]);
run("npx", ["electron-builder", "--win", "dir", "--x64"]);
