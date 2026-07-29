import { spawn } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";

const filesToRestore = ["tsconfig.json", "next-env.d.ts"];

const originals = new Map(
  await Promise.all(
    filesToRestore.map(async (file) => [file, await readFile(file, "utf8")])
  )
);

const child = spawn("next", ["build"], {
  env: {
    ...process.env,
    NEXT_DIST_DIR: ".next-verify"
  },
  shell: true,
  stdio: "inherit"
});

const exitCode = await new Promise((resolve) => {
  child.on("exit", (code) => resolve(code ?? 1));
  child.on("error", () => resolve(1));
});

await Promise.all(
  [...originals].map(([file, content]) => writeFile(file, content, "utf8"))
);

process.exit(exitCode);
