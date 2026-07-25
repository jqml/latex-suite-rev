import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import test from "node:test";

test("Obsidian command IDs do not repeat a plugin identifier", async () => {
	const source = await readFile("src/features/editor_commands.ts", "utf8");
	assert.doesNotMatch(source, /id:\s*["'](?:latex-suite|latex-suite-rev)-/);
});

test("runtime source avoids global app and Node or Electron imports", async () => {
	const paths = [
		"src/main.ts",
		"src/settings/settings_tab.ts",
		"src/features/editor_commands.ts",
	];
	const source = (
		await Promise.all(paths.map((path) => readFile(path, "utf8")))
	).join("\n");
	assert.doesNotMatch(source, /\bapp\?*\.isVimEnabled/);
	assert.doesNotMatch(source, /from\s+["'](?:node:|fs|path|electron)/);
});

test("opening settings cannot mutate the shared CodeMirror extension list", async () => {
	const source = await readFile("src/settings/settings_tab.ts", "utf8");
	assert.doesNotMatch(source, /const extensions = basicSetup\s*;/);
	assert.doesNotMatch(source, /basicSetup\.push\(/);
	assert.match(source, /const extensions = \[\.\.\.basicSetup, change\]/);
});

test("point tabstops grow and redo uses independent tabstop groups", async () => {
	const [tabstop, history, management] = await Promise.all([
		readFile("src/snippets/tabstop.ts", "utf8"),
		readFile("src/snippets/codemirror/history.ts", "utf8"),
		readFile("src/snippets/snippet_management.ts", "utf8"),
	]);
	assert.match(tabstop, /Decoration\.prototype\.range\.call/);
	assert.match(tabstop, /\bcopy\(\)/);
	assert.match(history, /group\.copy\(\)/);
	assert.match(management, /group\.copy\(\)/);
});

test("each multiple-cursor range is evaluated in its own editor mode", async () => {
	const [context, runner] = await Promise.all([
		readFile("src/utils/context.ts", "utf8"),
		readFile("src/features/run_snippets.ts", "utf8"),
	]);
	assert.match(context, /getModeAt\(pos: number\): Mode/);
	assert.match(runner, /const mode = ctx\.getModeAt\(to\)/);
	assert.match(runner, /snippetShouldRunInMode\(snippet\.options, mode\)/);
	assert.doesNotMatch(
		runner,
		/snippetShouldRunInMode\(snippet\.options, ctx\.mode\)/,
	);
	assert.match(context, /getInnerEquationBounds\(this\.view, pos\)/);
	assert.doesNotMatch(context, /getInnerEquationBounds\(this\.view\);/);
});

test("plugin unload removes optional global Vim mappings", async () => {
	const source = await readFile("src/main.ts", "utf8");
	assert.match(source, /onunload\(\)/);
	assert.match(source, /vimObject\.unmap\(command\.key, command\.context\)/);
});

test("settings and dark-theme CSS remain scoped to plugin-owned elements", async () => {
	const css = await readFile("styles.css", "utf8");
	assert.doesNotMatch(css, /^\.setting-item\.hidden\s*\{/m);
	assert.match(css, /\.latex-suite-settings \.setting-item\.hidden\s*\{/);
	for (const color of [0, 1, 2]) {
		assert.match(
			css,
			new RegExp(
				`\\.theme-dark span\\.latex-suite-snippet-placeholder-${color} span`,
			),
		);
	}
});

test("the Blob-module import uses one justified local lint suppression", async () => {
	const [eslintConfig, sourcePaths] = await Promise.all([
		readFile("eslint.config.mjs", "utf8"),
		readdir("src", { recursive: true }),
	]);
	const sourceTree = (
		await Promise.all(
			sourcePaths
				.filter((sourcePath) => sourcePath.endsWith(".ts"))
				.map((sourcePath) => readFile(`src/${sourcePath}`, "utf8")),
		)
	).join("\n");
	assert.doesNotMatch(
		eslintConfig,
		/["']no-unsanitized\/method["']\s*:\s*["']off["']/,
	);
	const suppressions = sourceTree.match(
		/eslint-disable-next-line no-unsanitized\/method[^\n]*/g,
	) ?? [];
	assert.equal(suppressions.length, 1);
	assert.match(suppressions[0], /--\s+\S/);
	assert.match(suppressions[0], /in-memory Blob/);
	assert.match(suppressions[0], /no network or filesystem URL is accepted/);
	assert.match(suppressions[0], /intentional documented/);
});
