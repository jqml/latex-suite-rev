import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
	ExternalFileFailureNoticeTracker,
	isSupportedFolderModule,
	summarizeExternalFileFailures,
} from "../src/settings/external_file_loading.ts";

test("folder scans accept only supported JavaScript modules", () => {
	for (const path of [
		"snippets/basic.js",
		"snippets/basic.JS",
		"snippets/nested/basic.mjs",
	]) {
		assert.equal(isSupportedFolderModule(path), true, path);
	}

	for (const path of [
		"snippets/image.png",
		"snippets/document.pdf",
		"snippets/note.md",
		"snippets/module.cjs",
		"snippets/no-extension",
	]) {
		assert.equal(isSupportedFolderModule(path), false, path);
	}
});

test("one scan produces one concise aggregated failure message", () => {
	const failures = [
		{ kind: "snippet", path: "snippets/a.js", error: new Error("a") },
		{ kind: "snippet", path: "snippets/b.js", error: new Error("b") },
		{ kind: "variable", path: "snippets/c.js", error: new Error("c") },
		{ kind: "snippet", path: "snippets/d.js", error: new Error("d") },
	];
	const message = summarizeExternalFileFailures(failures);

	assert.match(message, /Failed to parse 4 configured snippet modules/);
	assert.match(message, /a\.js, b\.js, c\.js, and 1 more/);
	assert.match(message, /developer console/);
	assert.doesNotMatch(message, /\bError:/);
});

test("identical failures are deduplicated until a successful reload", () => {
	const tracker = new ExternalFileFailureNoticeTracker();
	const failures = [
		{ kind: "snippet", path: "snippets/broken.js", error: new Error("bad") },
	];

	assert.equal(tracker.shouldNotify(failures), true);
	assert.equal(tracker.shouldNotify(failures), false);
	assert.equal(
		tracker.shouldNotify([
			{ kind: "snippet", path: "snippets/broken.js", error: new Error("bad") },
		]),
		false,
	);
	assert.equal(tracker.shouldNotify([]), false);
	assert.equal(tracker.shouldNotify(failures), true);
});

test("watchers filter unsupported folder files and debounce bursts", async () => {
	const source = await readFile("src/settings/file_watch.ts", "utf8");

	assert.match(source, /isSupportedFolderModule\(file\.path\)/);
	assert.match(source, /new WeakMap<LatexSuitePlugin, \(\) => void>\(\)/);
	assert.match(source, /debounce\(async \(\) => \{/);
	assert.match(source, /\}, 500, true\)/);
	assert.match(
		source,
		/if \(fileOrFolder instanceof TFile\) \{[\s\S]*?\} else if \(fileOrFolder instanceof TFolder\) \{/,
	);
	assert.doesNotMatch(source, /new Notice\(/);
});

test("file failures are reported once per scan, not once per file", async () => {
	const source = await readFile("src/main.ts", "utf8");

	assert.match(source, /const failures: ExternalFileLoadFailure\[\] = \[\]/);
	assert.match(source, /showExternalFileFailureNotice\(failures\)/);
	assert.match(source, /summarizeExternalFileFailures\(failures\)/);
});
