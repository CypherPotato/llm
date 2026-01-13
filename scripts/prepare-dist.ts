import { readFileSync, writeFileSync } from "fs";
import { join } from "path";

const distDir = "dist";
const shebang = "#!/usr/bin/env bun\n";

let content = readFileSync(join(distDir, "index.js"), "utf-8");
content = content.replace(/^#!.*\n/, "");
writeFileSync(join(distDir, "index.js"), shebang + content);

console.log("Prepared dist: added bun shebang to index.js");
