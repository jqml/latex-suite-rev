import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import defaultSnippets from "../src/default_snippets.js";
import { getMatrixLineIndent } from "../src/utils/matrix_line.ts";

test("bundled runtime source contains no regex lookbehind", async () => {
	for (const path of [
		"src/default_snippets.js",
		"src/features/matrix_shortcuts.ts",
	]) {
		const source = await readFile(path, "utf8");
		assert.equal(source.includes("(?<="), false, path);
		assert.equal(source.includes("(?<!"), false, path);
	}
});

test("text before dm is preserved without lookbehind", () => {
	const snippet = defaultSnippets.find(
		(candidate) =>
			candidate.priority === 1 &&
			candidate.trigger instanceof RegExp &&
			candidate.trigger.test("prefixdm"),
	);
	assert.ok(snippet);
	const match = snippet.trigger.exec("prefixdm");
	assert.ok(match);
	assert.equal(
		snippet.replacement.replace("[[0]]", match[1]),
		"prefix\n$$\n\t$0\n$$",
	);
});

test("list display-math snippet preserves its existing output", () => {
	const snippet = defaultSnippets.find(
		(candidate) => candidate.description === "Display math when in a list",
	);
	assert.ok(snippet);
	const match = snippet.trigger.exec("\n- itemdm");
	assert.ok(match);
	assert.equal(
		snippet.replacement(match),
		"- item\n  $$\n  \t$0\n  $$",
	);
});

test("matrix indentation is extracted without lookbehind", () => {
	assert.equal(getMatrixLineIndent("\\begin{matrix}  & "), "& ");
	assert.equal(getMatrixLineIndent("row \\\\  & & "), "& & ");
	assert.equal(getMatrixLineIndent("  & "), "& ");
});
