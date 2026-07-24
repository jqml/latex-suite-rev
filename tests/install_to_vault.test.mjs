import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import test from "node:test";

import { installToVault } from "../scripts/install-to-vault.mjs";

const writeJson = (path, value) =>
	writeFile(path, `${JSON.stringify(value, null, 2)}\n`);

const createAssets = async (root) => {
	const assets = join(root, "assets");
	await mkdir(assets);
	await writeFile(join(assets, "main.js"), "console.log('rev');\n");
	await writeJson(join(assets, "manifest.json"), {
		id: "latex-suite-rev",
		name: "LaTeX Suite Rev",
		version: "0.1.0",
	});
	await writeFile(join(assets, "styles.css"), ".rev {}\n");
	return assets;
};

const createVault = async () => {
	const root = await mkdtemp(join(tmpdir(), "latex-suite-rev-test-"));
	const vault = join(root, "vault");
	const obsidian = join(vault, ".obsidian");
	const official = join(obsidian, "plugins", "obsidian-latex-suite");
	await mkdir(official, { recursive: true });
	await writeFile(join(official, "main.js"), "console.log('official');\n");
	await writeJson(join(official, "manifest.json"), { id: "obsidian-latex-suite" });
	await writeFile(join(official, "styles.css"), ".official {}\n");
	await writeFile(join(official, "data.json"), "{\"secret\":\"preserve\"}\n");
	await writeJson(join(obsidian, "community-plugins.json"), [
		"first-plugin",
		"obsidian-latex-suite",
		"last-plugin",
	]);
	return { root, vault, obsidian, official };
};

test("dry-run validates without changing the vault", async (t) => {
	const fixture = await createVault();
	t.after(() => rm(fixture.root, { recursive: true, force: true }));
	const assets = await createAssets(fixture.root);
	const before = await readFile(
		join(fixture.obsidian, "community-plugins.json"),
		"utf8",
	);
	const report = await installToVault({
		vaultPath: fixture.vault,
		assetsPath: assets,
		dryRun: true,
	});
	assert.equal(report.dryRun, true);
	assert.equal(report.settings.migratedFromOfficial, true);
	assert.equal(
		await readFile(join(fixture.obsidian, "community-plugins.json"), "utf8"),
		before,
	);
});

test("first install migrates settings, preserves order, and retains official files", async (t) => {
	const fixture = await createVault();
	t.after(() => rm(fixture.root, { recursive: true, force: true }));
	const assets = await createAssets(fixture.root);
	const report = await installToVault({
		vaultPath: fixture.vault,
		assetsPath: assets,
	});
	const rev = join(fixture.obsidian, "plugins", "latex-suite-rev");
	assert.deepEqual(
		JSON.parse(
			await readFile(join(fixture.obsidian, "community-plugins.json"), "utf8"),
		),
		["first-plugin", "latex-suite-rev", "last-plugin"],
	);
	assert.equal(
		await readFile(join(rev, "data.json"), "utf8"),
		"{\"secret\":\"preserve\"}\n",
	);
	assert.equal(
		await readFile(join(fixture.official, "main.js"), "utf8"),
		"console.log('official');\n",
	);
	assert.equal(report.settings.migratedFromOfficial, true);
});

test("reinstall preserves existing Rev settings", async (t) => {
	const fixture = await createVault();
	t.after(() => rm(fixture.root, { recursive: true, force: true }));
	const assets = await createAssets(fixture.root);
	const rev = join(fixture.obsidian, "plugins", "latex-suite-rev");
	await mkdir(rev, { recursive: true });
	await writeFile(join(rev, "data.json"), "{\"rev\":\"keep\"}\n");
	await installToVault({ vaultPath: fixture.vault, assetsPath: assets });
	assert.equal(
		await readFile(join(rev, "data.json"), "utf8"),
		"{\"rev\":\"keep\"}\n",
	);
});
