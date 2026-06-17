const cp = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const packagePath = path.join(root, "package.json");
const configPath = path.join(root, "default-config.json");
const packageRaw = fs.readFileSync(packagePath, "utf8");
const configRaw = fs.readFileSync(configPath, "utf8");

try {
  const packageJson = JSON.parse(packageRaw);
  const configJson = JSON.parse(configRaw);
  packageJson.displayName = "Easy Mail Dev";
  packageJson.description = "Development build of Easy Mail with gpt-5-mini as the default model.";
  configJson.modelFamily = "gpt-5-mini";
  fs.writeFileSync(packagePath, `${JSON.stringify(packageJson, null, 2)}\n`, "utf8");
  fs.writeFileSync(configPath, `${JSON.stringify(configJson, null, 2)}\n`, "utf8");
  cp.execSync("npm run compile", { cwd: root, stdio: "inherit", shell: true });
  cp.execSync("npx vsce package --out releases/easy-mail-dev-0.1.0.vsix", { cwd: root, stdio: "inherit", shell: true });
} finally {
  fs.writeFileSync(packagePath, packageRaw, "utf8");
  fs.writeFileSync(configPath, configRaw, "utf8");
}
