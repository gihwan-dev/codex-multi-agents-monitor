import { spawnSync } from "node:child_process";

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
const commandCandidates = [
  process.env.LIZARD_BIN
    ? { command: process.env.LIZARD_BIN, args: [] }
    : null,
  { command: "lizard", args: [] },
  { command: "python3", args: ["-m", "lizard"] },
  { command: "python", args: ["-m", "lizard"] },
  { command: "py", args: ["-m", "lizard"] },
].filter(Boolean);

for (const candidate of commandCandidates) {
  const result = spawnSync(candidate.command, [...candidate.args, ...thresholdArgs], {
    cwd: process.cwd(),
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
    "Install it with `python3 -m pip install lizard` or set LIZARD_BIN to the executable path.",
  ].join(" "),
);
process.exit(1);
