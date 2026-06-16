"use strict";

const fs = require("node:fs");
const path = require("node:path");

const outDir = path.resolve(__dirname, "..", "out");
fs.rmSync(outDir, { recursive: true, force: true });
