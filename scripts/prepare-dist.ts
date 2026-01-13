import { readFileSync, writeFileSync } from "fs";
import { join } from "path";

const distDir = "dist";

const content = readFileSync(join(distDir, "index.js"), "utf-8");
const fixed = content.replace(/^#!.*\n/, "");
writeFileSync(join(distDir, "index.js"), fixed);

console.log("Prepared dist: removed shebang from index.js");
