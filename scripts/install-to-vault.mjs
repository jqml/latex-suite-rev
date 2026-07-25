import {
	constants,
	copyFile,
	cp,
	lstat,
	mkdir,
	readFile,
	realpath,
	rename,
	rm,
	stat,
	writeFile,
} from "node:fs/promises";
import { createHash } from "node:crypto";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
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

const pathType = async (path) => {
	try {
		return await lstat(path);
	} catch (error) {
		if (error?.code === "ENOENT") return null;
		throw error;
	}
};

const sha256 = async (path) => {
	const hash = createHash("sha256");
	hash.update(await readFile(path));
	return hash.digest("hex");
};

const assertNoSymlinks = async (root, target) => {
	const relativePath = relative(resolve(root), resolve(target));
	if (relativePath.startsWith("..") || isAbsolute(relativePath)) {
		throw new Error(`Refusing path outside vault: ${target}`);
	}
	let current = resolve(root);
	for (const component of relativePath.split(sep).filter(Boolean)) {
		current = join(current, component);
		const type = await pathType(current);
		if (!type) break;
		if (type.isSymbolicLink()) {
			throw new Error(`Refusing symbolic link in managed path: ${current}`);
		}
	}
};

const assertRegularFile = async (path) => {
	const type = await pathType(path);
	if (!type?.isFile() || type.isSymbolicLink()) {
		throw new Error(`Expected a regular file, not a symbolic link: ${path}`);
	}
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
	try {
		await copyFile(source, temporary, constants.COPYFILE_FICLONE);
		await rename(temporary, destination);
	} finally {
		await rm(temporary, { recursive: true, force: true });
	}
};

const writeFileAtomic = async (destination, contents) => {
	await mkdir(dirname(destination), { recursive: true });
	const temporary = `${destination}.tmp-${process.pid}`;
	try {
		await writeFile(temporary, contents, { flag: "wx" });
		await rename(temporary, destination);
	} finally {
		await rm(temporary, { recursive: true, force: true });
	}
};

const readPluginList = async (path) => {
	if (!(await exists(path))) return { plugins: [], source: null };
	await assertRegularFile(path);
	const source = await readFile(path, "utf8");
	const value = JSON.parse(source);
	if (!Array.isArray(value) || !value.every((entry) => typeof entry === "string")) {
		throw new Error(`${path} must contain a JSON array of plugin IDs`);
	}
	return { plugins: value, source };
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
		await assertRegularFile(path);
		hashes[asset] = await sha256(path);
	}
	const manifest = JSON.parse(await readFile(join(assetsPath, "manifest.json"), "utf8"));
	if (manifest.id !== REV_ID) {
		throw new Error(`Expected manifest id ${REV_ID}, received ${manifest.id}`);
	}
	return { hashes, manifest };
};

const chooseBackupDirectory = async (obsidian, version) => {
	const root = join(obsidian, "latex-suite-rev-backups");
	const base = `${version}-${timestamp()}`;
	for (let suffix = 0; suffix < 1000; suffix += 1) {
		const name = suffix === 0 ? base : `${base}-${suffix}`;
		const candidate = join(root, name);
		if (!(await exists(candidate))) return candidate;
	}
	throw new Error("Could not allocate a unique backup directory");
};

const collectKnownHashes = async (paths) => {
	const hashes = {};
	for (const [name, path] of Object.entries(paths)) {
		if (!(await exists(path))) continue;
		await assertRegularFile(path);
		hashes[name] = await sha256(path);
	}
	return hashes;
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
	await assertNoSymlinks(vault, obsidian);

	const pluginsDirectory = join(obsidian, "plugins");
	const communityPluginsPath = join(obsidian, "community-plugins.json");
	const officialDirectory = join(pluginsDirectory, OFFICIAL_ID);
	const revDirectory = join(pluginsDirectory, REV_ID);
	const rollbackDirectory = join(pluginsDirectory, `.${REV_ID}.rollback`);
	const revExisted = await exists(revDirectory);
	const existingRevData = join(revDirectory, "data.json");
	const officialData = join(officialDirectory, "data.json");
	const resolvedAssets = await realpath(resolve(assetsPath));
	const { hashes: assetHashes, manifest } = await validateAssets(resolvedAssets);
	const { plugins: currentPlugins, source: currentPluginSource } =
		await readPluginList(communityPluginsPath);
	const nextPlugins = updatePluginList(currentPlugins);
	const backupDirectory = await chooseBackupDirectory(obsidian, manifest.version);
	assertInside(vault, backupDirectory);
	assertInside(vault, revDirectory);
	assertInside(vault, rollbackDirectory);
	await assertNoSymlinks(vault, pluginsDirectory);
	await assertNoSymlinks(vault, revDirectory);
	await assertNoSymlinks(vault, officialDirectory);
	await assertNoSymlinks(vault, communityPluginsPath);
	if (await exists(rollbackDirectory)) {
		throw new Error(
			`Interrupted installation marker exists; inspect before retrying: ${rollbackDirectory}`,
		);
	}
	if (revExisted) {
		await assertNoSymlinks(revDirectory, existingRevData);
	}
	if (await exists(officialDirectory)) {
		await assertNoSymlinks(officialDirectory, officialData);
	}

	const sourceHashes = await collectKnownHashes({
		"community-plugins.json": communityPluginsPath,
		...Object.fromEntries(
			RELEASE_ASSETS.map((asset) => [
				`${REV_ID}/${asset}`,
				join(revDirectory, asset),
			]),
		),
		[`${REV_ID}/data.json`]: existingRevData,
		...Object.fromEntries(
			RELEASE_ASSETS.map((asset) => [
				`${OFFICIAL_ID}/${asset}`,
				join(officialDirectory, asset),
			]),
		),
		[`${OFFICIAL_ID}/data.json`]: officialData,
	});

	const report = {
		vault,
		version: manifest.version,
		dryRun,
		backupDirectory,
		assetHashes,
		sourceHashes,
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
			dereference: false,
		});
	}
	if (await exists(officialDirectory)) {
		const officialBackup = join(backupDirectory, OFFICIAL_ID);
		await mkdir(officialBackup, { recursive: true });
		for (const asset of [...RELEASE_ASSETS, "data.json"]) {
			const source = join(officialDirectory, asset);
			if (await exists(source)) {
				await assertRegularFile(source);
				await copyFile(source, join(officialBackup, asset));
			}
		}
	}

	await mkdir(pluginsDirectory, { recursive: true });
	const stageDirectory = join(
		pluginsDirectory,
		`.${REV_ID}.stage-${process.pid}-${Date.now()}`,
	);
	assertInside(vault, stageDirectory);
	let oldRevMoved = false;
	let newRevInstalled = false;
	let pluginListWritten = false;
	try {
		await mkdir(stageDirectory, { recursive: false });
		for (const asset of RELEASE_ASSETS) {
			await copyFileAtomic(
				join(resolvedAssets, asset),
				join(stageDirectory, asset),
			);
		}
		if (revExisted && (await exists(existingRevData))) {
			await assertRegularFile(existingRevData);
			await copyFileAtomic(existingRevData, join(stageDirectory, "data.json"));
		} else if (!revExisted && (await exists(officialData))) {
			await assertRegularFile(officialData);
			await copyFileAtomic(officialData, join(stageDirectory, "data.json"));
		}

		if (revExisted) {
			await rename(revDirectory, rollbackDirectory);
			oldRevMoved = true;
		}
		await rename(stageDirectory, revDirectory);
		newRevInstalled = true;
		await writeFileAtomic(
			communityPluginsPath,
			`${JSON.stringify(nextPlugins, null, 2)}\n`,
		);
		pluginListWritten = true;
	} catch (error) {
		if (pluginListWritten) {
			if (currentPluginSource === null) {
				await rm(communityPluginsPath, { force: true });
			} else {
				await writeFileAtomic(
					communityPluginsPath,
					currentPluginSource,
				);
			}
		}
		if (newRevInstalled) {
			await rm(revDirectory, { recursive: true, force: true });
		}
		if (oldRevMoved) {
			await rename(rollbackDirectory, revDirectory);
		}
		throw error;
	} finally {
		await rm(stageDirectory, { recursive: true, force: true });
	}
	if (oldRevMoved) {
		await rm(rollbackDirectory, { recursive: true, force: true });
	}

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
