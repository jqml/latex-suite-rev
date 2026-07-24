import {
	constants,
	copyFile,
	cp,
	mkdir,
	readFile,
	realpath,
	rename,
	stat,
	writeFile,
} from "node:fs/promises";
import { createHash } from "node:crypto";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const OFFICIAL_ID = "obsidian-latex-suite";
const REV_ID = "latex-suite-rev";
const RELEASE_ASSETS = ["main.js", "manifest.json", "styles.css"];

const exists = async (path) => {
	try {
		await stat(path);
		return true;
	} catch {
		return false;
	}
};

const sha256 = async (path) => {
	const hash = createHash("sha256");
	hash.update(await readFile(path));
	return hash.digest("hex");
};

const assertInside = (parent, child) => {
	const relativePath = relative(resolve(parent), resolve(child));
	if (
		relativePath &&
		!relativePath.startsWith("..") &&
		!isAbsolute(relativePath)
	) return;
	throw new Error(`Refusing path outside vault: ${child}`);
};

const timestamp = () => new Date().toISOString().replaceAll(":", "-").replace(/\.\d{3}Z$/, "Z");

const copyFileAtomic = async (source, destination) => {
	await mkdir(dirname(destination), { recursive: true });
	const temporary = `${destination}.tmp-${process.pid}`;
	await copyFile(source, temporary, constants.COPYFILE_FICLONE);
	await rename(temporary, destination);
};

const readPluginList = async (path) => {
	if (!(await exists(path))) return [];
	const value = JSON.parse(await readFile(path, "utf8"));
	if (!Array.isArray(value) || !value.every((entry) => typeof entry === "string")) {
		throw new Error(`${path} must contain a JSON array of plugin IDs`);
	}
	return value;
};

const updatePluginList = (plugins) => {
	const next = [];
	let revAdded = false;
	for (const plugin of plugins) {
		if (plugin === OFFICIAL_ID || plugin === REV_ID) {
			if (!revAdded) {
				next.push(REV_ID);
				revAdded = true;
			}
			continue;
		}
		next.push(plugin);
	}
	if (!revAdded) next.push(REV_ID);
	return next;
};

const validateAssets = async (assetsPath) => {
	const hashes = {};
	for (const asset of RELEASE_ASSETS) {
		const path = join(assetsPath, asset);
		if (!(await exists(path))) throw new Error(`Missing release asset: ${path}`);
		hashes[asset] = await sha256(path);
	}
	const manifest = JSON.parse(await readFile(join(assetsPath, "manifest.json"), "utf8"));
	if (manifest.id !== REV_ID) {
		throw new Error(`Expected manifest id ${REV_ID}, received ${manifest.id}`);
	}
	return { hashes, manifest };
};

export const installToVault = async ({
	vaultPath,
	assetsPath = resolve(dirname(fileURLToPath(import.meta.url)), ".."),
	dryRun = false,
}) => {
	if (!vaultPath || !isAbsolute(vaultPath)) {
		throw new Error("An explicit absolute vault path is required");
	}
	const vault = await realpath(vaultPath);
	const obsidian = join(vault, ".obsidian");
	if (!(await exists(obsidian))) throw new Error(`Not an Obsidian vault: ${vault}`);

	const pluginsDirectory = join(obsidian, "plugins");
	const communityPluginsPath = join(obsidian, "community-plugins.json");
	const officialDirectory = join(pluginsDirectory, OFFICIAL_ID);
	const revDirectory = join(pluginsDirectory, REV_ID);
	const revExisted = await exists(revDirectory);
	const existingRevData = join(revDirectory, "data.json");
	const officialData = join(officialDirectory, "data.json");
	const { hashes: assetHashes, manifest } = await validateAssets(resolve(assetsPath));
	const currentPlugins = await readPluginList(communityPluginsPath);
	const nextPlugins = updatePluginList(currentPlugins);
	const backupDirectory = join(
		obsidian,
		"latex-suite-rev-backups",
		`${manifest.version}-${timestamp()}`,
	);
	assertInside(vault, backupDirectory);
	assertInside(vault, revDirectory);

	const report = {
		vault,
		version: manifest.version,
		dryRun,
		backupDirectory,
		assetHashes,
		communityPlugins: {
			before: currentPlugins,
			after: nextPlugins,
		},
		settings: {
			preservedExistingRev: revExisted && (await exists(existingRevData)),
			migratedFromOfficial:
				!revExisted && (await exists(officialData)),
		},
	};

	if (dryRun) return report;

	await mkdir(backupDirectory, { recursive: true });
	if (await exists(communityPluginsPath)) {
		await copyFile(
			communityPluginsPath,
			join(backupDirectory, "community-plugins.json"),
		);
	}
	if (revExisted) {
		await cp(revDirectory, join(backupDirectory, REV_ID), {
			recursive: true,
			errorOnExist: true,
		});
	}
	if (await exists(officialDirectory)) {
		const officialBackup = join(backupDirectory, OFFICIAL_ID);
		await mkdir(officialBackup, { recursive: true });
		for (const asset of [...RELEASE_ASSETS, "data.json"]) {
			const source = join(officialDirectory, asset);
			if (await exists(source)) await copyFile(source, join(officialBackup, asset));
		}
	}

	await mkdir(revDirectory, { recursive: true });
	for (const asset of RELEASE_ASSETS) {
		await copyFileAtomic(join(resolve(assetsPath), asset), join(revDirectory, asset));
	}
	if (!revExisted && (await exists(officialData))) {
		await copyFileAtomic(officialData, existingRevData);
	}
	await writeFile(communityPluginsPath, `${JSON.stringify(nextPlugins, null, 2)}\n`);

	report.installedHashes = {};
	for (const asset of RELEASE_ASSETS) {
		report.installedHashes[asset] = await sha256(join(revDirectory, asset));
	}
	if (await exists(existingRevData)) {
		report.settings.dataSha256 = await sha256(existingRevData);
	}
	return report;
};

const parseArguments = (argumentsList) => {
	const options = { dryRun: false };
	for (let index = 0; index < argumentsList.length; index += 1) {
		const argument = argumentsList[index];
		if (argument === "--dry-run") {
			options.dryRun = true;
		} else if (argument === "--vault") {
			options.vaultPath = argumentsList[++index];
		} else if (argument === "--assets") {
			options.assetsPath = argumentsList[++index];
		} else {
			throw new Error(`Unknown argument: ${argument}`);
		}
	}
	return options;
};

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
	try {
		const report = await installToVault(parseArguments(process.argv.slice(2)));
		console.log(JSON.stringify(report, null, 2));
	} catch (error) {
		console.error(error instanceof Error ? error.message : String(error));
		process.exitCode = 1;
	}
}
