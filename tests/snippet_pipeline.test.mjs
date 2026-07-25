import assert from "node:assert/strict";
import test from "node:test";

import { Options } from "../src/snippets/options.ts";
import { expandRegexReplacement } from "../src/snippets/regex_replacement.ts";
import { sortSnippets } from "../src/snippets/sort.ts";
import { applyVisualSelection } from "../src/snippets/visual_replacement.ts";

test("mode flags separate text, inline, display, and code contexts", () => {
	const math = Options.fromSource("mA").mode;
	assert.equal(math.inlineMath, true);
	assert.equal(math.blockMath, true);
	assert.equal(math.text, false);
	assert.equal(math.codeMath, false);

	const text = Options.fromSource("t").mode;
	assert.equal(text.text, true);
	assert.equal(text.inMath(), false);

	const code = Options.fromSource("c", undefined).mode;
	assert.equal(code.code, true);
	assert.equal(code.inMath(), false);
});

test("bar candidates preserve the configured one-letter capture semantics", () => {
	const regex = {
		trigger: /(?:([a-zA-Z])bar)$/,
		replacement: "\\overline{[[0]]}",
		priority: 0,
	};
	const bare = {
		trigger: "bar",
		replacement: "\\overline{$0}$1",
		priority: 0,
	};

	const match = regex.trigger.exec("ssbar");
	assert.ok(match);
	assert.equal(match.index, 1);
	assert.equal(
		expandRegexReplacement(regex.replacement, match),
		"\\overline{s}",
	);
	assert.equal("ssbar".slice(0, match.index) + "\\overline{s}", "s\\overline{s}");
	assert.deepEqual(sortSnippets([bare, regex]), [regex, bare]);
});

test("automatic and manual snippet options remain independent", () => {
	assert.equal(Options.fromSource("mA", undefined).automatic, true);
	assert.equal(Options.fromSource("m", undefined).automatic, false);
});

test("visual snippets replace every selection placeholder", () => {
	assert.equal(
		applyVisualSelection(
			"${VISUAL}+${VISUAL}",
			"${VISUAL}",
			"x",
		),
		"x+x",
	);
});
