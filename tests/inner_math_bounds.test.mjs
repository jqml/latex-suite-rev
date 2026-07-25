import assert from "node:assert/strict";
import test from "node:test";

import { findNestedInlineMathBounds } from "../src/utils/inner_math_bounds.ts";

const outer = {
	inner_start: 100,
	inner_end: 130,
	outer_start: 98,
	outer_end: 132,
};

test("nested inline bounds remain absolute when the outer equation is offset", () => {
	const text = String.raw`\text{before $x+1$ after}`;
	assert.deepEqual(findNestedInlineMathBounds(text, outer, 115), {
		inner_start: 114,
		inner_end: 117,
		outer_start: 113,
		outer_end: 118,
	});
});

test("escaped dollars are not treated as nested delimiters", () => {
	const text = String.raw`\text{cost \$5 and more}`;
	assert.deepEqual(findNestedInlineMathBounds(text, outer, 115), outer);
});

test("positions outside the outer text preserve the outer bounds", () => {
	assert.deepEqual(findNestedInlineMathBounds("$x$", outer, 99), outer);
	assert.deepEqual(findNestedInlineMathBounds("$x$", outer, 104), outer);
});
