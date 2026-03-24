import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const LIZARD_VERSION = "1.21.2";
const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const bundledVenvPath = join(repoRoot, ".tmp-quality", "lizard-venv");
const bundledPythonPath =
  process.platform === "win32"
    ? join(bundledVenvPath, "Scripts", "python.exe")
    : join(bundledVenvPath, "bin", "python");
const bundledLizardPath =
  process.platform === "win32"
    ? join(bundledVenvPath, "Scripts", "lizard.exe")
    : join(bundledVenvPath, "bin", "lizard");

const thresholdArgs = [
  "-C",
  "8",
  "-L",
  "40",
  "-a",
  "3",
  "-x",
  "src/entities/run/model/samples.ts",
  "-x",
  "src-tauri/src/test_support.rs",
  "-x",
  "**/*.stories.*",
  "-x",
  "**/*.story.*",
  "-x",
  "**/__snapshots__/**",
  "-x",
  "**/__fixtures__/**",
  "-x",
  "**/generated/**",
  "src",
  "src-tauri/src",
];

function readExecutableCandidates() {
  return [
    process.env.LIZARD_BIN ? { command: process.env.LIZARD_BIN, args: [] } : null,
    { command: "lizard", args: [] },
    existsSync(bundledLizardPath)
      ? { command: bundledLizardPath, args: [] }
      : readBundledLizardCandidate(),
  ].filter(Boolean);
}

function readBundledLizardCandidate() {
  const bundledCommand = ensureBundledLizard();
  return bundledCommand ? { command: bundledCommand, args: [] } : null;
}

function ensureBundledLizard() {
  mkdirSync(join(repoRoot, ".tmp-quality"), { recursive: true });
  for (const pythonCommand of ["python3", "python", "py"]) {
    if (!canRunCommand(pythonCommand, ["--version"])) {
      continue;
    }

    if (!runOrContinue(pythonCommand, ["-m", "venv", bundledVenvPath])) {
      continue;
    }
    if (
      !runOrContinue(bundledPythonPath, [
        "-m",
        "pip",
        "install",
        `lizard==${LIZARD_VERSION}`,
      ])
    ) {
      continue;
    }
    if (existsSync(bundledLizardPath)) {
      return bundledLizardPath;
    }
  }

  return null;
}

function canRunCommand(command, args) {
  const result = spawnSync(command, args, {
    cwd: repoRoot,
    stdio: "ignore",
  });
  return !result.error || result.error.code !== "ENOENT";
}

function runOrContinue(command, args) {
  const result = spawnSync(command, args, {
    cwd: repoRoot,
    stdio: "inherit",
  });
  return (result.status ?? 1) === 0;
}

for (const candidate of readExecutableCandidates()) {
  const result = spawnSync(candidate.command, [...candidate.args, ...thresholdArgs], {
    cwd: repoRoot,
    stdio: "inherit",
  });

  if (result.error && result.error.code === "ENOENT") {
    continue;
  }

  process.exit(result.status ?? 1);
}

console.error(
  [
    "Unable to find lizard.",
    "Install Python 3 or set LIZARD_BIN to the executable path.",
  ].join(" "),
);
process.exit(1);
