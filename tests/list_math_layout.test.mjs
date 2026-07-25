import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
	MATH_ONLY_LIST_LINE_CLASS,
	isListLeadingInlineMathLine,
} from "../src/editor_extensions/list_math_layout.ts";

test("classifies supported list-leading inline-math structures", () => {
	for (const line of [
		"- $s\\overline{s}$",
		"- $s\\overline{s}$ text after",
		"  - $s\\overline{s}$",
		"    * $x$",
		"1. $s\\overline{s}$",
		"2) $x$",
		"> - $s\\overline{s}$",
		"> - $s\\overline{s}$ text after",
		">   1. $x$",
		">> - $s\\overline{s}$",
	]) {
		assert.equal(isListLeadingInlineMathLine(line), true, line);
	}
});

test("does not classify text-leading, task, display, escaped, or non-list lines", () => {
	for (const line of [
		"- text $s\\overline{s}$",
		"- [ ] $s\\overline{s}$",
		"> - [ ] $s\\overline{s}$",
		"- $$s\\overline{s}$$",
		"- \\$s\\overline{s}\\$",
		"$s\\overline{s}$",
		"# $s\\overline{s}$",
		"Rapid expansion target $s\\overline{s}$",
	]) {
		assert.equal(isListLeadingInlineMathLine(line), false, line);
	}
});

test("layout correction is a plugin-owned line decoration", async () => {
	const source = await readFile(
		"src/editor_extensions/list_math_layout.ts",
		"utf8",
	);
	assert.equal(MATH_ONLY_LIST_LINE_CLASS, "latex-suite-rev-math-only-list-line");
	assert.match(source, /Decoration\.line\(/);
	assert.doesNotMatch(source, /Decoration\.(?:replace|widget)\(/);
	assert.doesNotMatch(source, /\.dispatch\(/);
});

test("CSS restores native semantic math colors under the owned line class", async () => {
	const css = await readFile("styles.css", "utf8");
	const expectedSelectors = [
		".cm-line.latex-suite-rev-math-only-list-line .cm-math.cm-formatting-list-ul",
		".cm-line.latex-suite-rev-math-only-list-line .cm-math.cm-formatting-list-ol",
	];
	for (const selector of expectedSelectors) assert.match(css, new RegExp(selector.replaceAll(".", "\\.")));

	const paddingRule = css.match(
		/\.cm-line\.latex-suite-rev-math-only-list-line[\s\S]*?\{([\s\S]*?)\}/,
	);
	assert.ok(paddingRule);
	assert.match(paddingRule[1], /padding-inline-start:\s*0/);
	assert.doesNotMatch(paddingRule[1], /(?:color|opacity|font|margin|display|gap|spacing)\s*:/);

	const semanticMappings = new Map([
		["cm-comment", "--code-comment"],
		["cm-meta", "--code-comment"],
		["cm-tag", "--code-tag"],
		["cm-punctuation", "--code-punctuation"],
		["cm-bracket", "--code-punctuation"],
		["cm-hr", "--code-punctuation"],
		["cm-number", "--code-value"],
		["cm-qualifier", "--code-string"],
		["cm-string", "--code-string"],
		["cm-string-2", "--code-string"],
		["cm-operator", "--code-operator"],
		["cm-link", "--code-property"],
		["cm-variable", "--code-property"],
		["cm-variable-2", "--code-property"],
		["cm-variable-3", "--code-property"],
		["cm-builtin", "--code-function"],
		["cm-property", "--code-function"],
		["cm-attribute", "--code-function"],
		["cm-type", "--code-function"],
		["cm-keyword", "--code-keyword"],
		["cm-formatting-math", "--text-accent"],
	]);
	for (const [tokenClass, variable] of semanticMappings) {
		const tokenRule = new RegExp(
			`\\.cm-line\\.latex-suite-rev-math-only-list-line \\.cm-math\\.${tokenClass}[\\s\\S]*?\\{[\\s\\S]*?color:\\s*var\\(${variable}\\)`,
		);
		assert.match(css, tokenRule, `${tokenClass} should use ${variable}`);
	}

	const scopedColorBlocks = [
		...css.matchAll(
			/\.cm-line\.latex-suite-rev-math-only-list-line[\s\S]*?\{([\s\S]*?color:[\s\S]*?)\}/g,
		),
	].map((match) => match[1]).join("\n");
	assert.doesNotMatch(
		scopedColorBlocks,
		/(?:opacity|font|margin|padding|display|gap|spacing)\s*:/,
	);
	assert.doesNotMatch(scopedColorBlocks, /var\(--text-normal\)/);
	assert.doesNotMatch(css, /(?:^|,)\s*\.cm-math\s*\{/m);
	assert.doesNotMatch(`${paddingRule[1]}\n${scopedColorBlocks}`, /!important/);
	assert.doesNotMatch(scopedColorBlocks, /MathJax|mjx-container|::selection/);
});

test("scoped correction leaves native quote/list markers and unrelated structures alone", async () => {
	const css = await readFile("styles.css", "utf8");
	assert.doesNotMatch(
		css,
		/\.latex-suite-rev-math-only-list-line[^{]*(?:cm-formatting-quote|cm-formatting-list)(?!-(?:ul|ol))/,
	);
	assert.doesNotMatch(
		css,
		/\.latex-suite-rev-math-only-list-line[^{]*(?:HyperMD-quote|HyperMD-list-line|HyperMD-task-line)/,
	);
	assert.doesNotMatch(css, /(?:^|,)\s*(?:\.cm-line|\.cm-math|\.HyperMD-quote|\.HyperMD-list-line)\s*\{/m);
});
