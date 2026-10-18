import { cp, mkdir, rm } from "node:fs/promises";
import { fileURLToPath } from "node:url";

// Only these files are public. Never publish the repository root or PHP config.
const root = new URL("../", import.meta.url);
const output = new URL("dist/", root);
await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
for (const path of ["index.html", "assets", "css", "data", "js"]) {
  await cp(new URL(path, root), new URL(path, output), { recursive: true });
}
console.log(`Public assets built in ${fileURLToPath(output)}`);
