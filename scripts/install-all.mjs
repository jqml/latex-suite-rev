import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { installToVault } from "./install-to-vault.mjs";

const repository = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const argumentsList = process.argv.slice(2);
const dryRun = argumentsList.includes("--dry-run");
const assetsIndex = argumentsList.indexOf("--assets");
if (assetsIndex !== -1 && !argumentsList[assetsIndex + 1]) {
	throw new Error("--assets requires a path");
}
const assetsPath =
	assetsIndex === -1 ? repository : resolve(argumentsList[assetsIndex + 1]);
const unknown = argumentsList.filter(
	(argument, index) =>
		argument !== "--dry-run" &&
		argument !== "--assets" &&
		index !== assetsIndex + 1,
);
if (unknown.length) throw new Error(`Unknown argument: ${unknown.join(", ")}`);

const configPath = joinPath(repository, "vaults.local.json");
const config = JSON.parse(await readFile(configPath, "utf8"));
if (!Array.isArray(config.vaults) || !config.vaults.length) {
	throw new Error("vaults.local.json must contain a non-empty vaults array");
}
if (!config.vaults.every((vault) => typeof vault === "string" && vault.startsWith("/"))) {
	throw new Error("Every configured vault must be an explicit absolute path");
}

const reports = [];
for (const vaultPath of config.vaults) {
	reports.push(await installToVault({ vaultPath, assetsPath, dryRun }));
}
console.log(JSON.stringify(reports, null, 2));

function joinPath(...parts) {
	return resolve(...parts);
}
