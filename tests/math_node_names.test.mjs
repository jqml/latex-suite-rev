import assert from "node:assert/strict";
import test from "node:test";

import {
	isCloseMathNode,
	isInlineMathOpenNode,
	isOpenMathNode,
} from "../src/utils/math_node_names.ts";

const nativeInlineOpen =
	"formatting_formatting-math_formatting-math-begin_keyword_math";
const nativeDisplayOpen =
	"formatting_formatting-math_formatting-math-begin_keyword_math_math-block";
const nativeClose =
	"formatting_formatting-math_formatting-math-end_keyword_math_math-";
const listInlineOpen =
	"formatting_formatting-math_formatting-math-begin_keyword_list-1_math_math-";
const listClose =
	"formatting_formatting-math_formatting-math-end_keyword_list-1_math_math-";
const headingInlineOpen =
	"formatting_formatting-math_formatting-math-begin_keyword_header-2_math_math-";
const headingClose =
	"formatting_formatting-math_formatting-math-end_keyword_header-2_math_math-";

test("recognizes native inline math delimiters", () => {
	assert.equal(isOpenMathNode(nativeInlineOpen), true);
	assert.equal(isInlineMathOpenNode(nativeInlineOpen), true);
	assert.equal(isCloseMathNode(nativeClose), true);
});

test("recognizes native display math delimiters", () => {
	assert.equal(isOpenMathNode(nativeDisplayOpen), true);
	assert.equal(isInlineMathOpenNode(nativeDisplayOpen), false);
	assert.equal(isCloseMathNode(nativeClose), true);
});

test("recognizes list-tagged inline opening and closing delimiters", () => {
	assert.equal(isOpenMathNode(listInlineOpen), true);
	assert.equal(isInlineMathOpenNode(listInlineOpen), true);
	assert.equal(isCloseMathNode(listClose), true);
});

test("recognizes heading-tagged inline opening and closing delimiters", () => {
	assert.equal(isOpenMathNode(headingInlineOpen), true);
	assert.equal(isInlineMathOpenNode(headingInlineOpen), true);
	assert.equal(isCloseMathNode(headingClose), true);
});

test("classifies the delimiters from the captured failing list transaction", () => {
	const capturedFailure = {
		document: "\nNot working:\n$ss$\n- xx\n$ssba$\n",
		cursor: 29,
		contentNode: "list-1_math_variable-2",
		openNode: listInlineOpen,
		closeNode: listClose,
	};

	assert.equal(capturedFailure.document[capturedFailure.cursor], "$");
	assert.equal(isOpenMathNode(capturedFailure.openNode), true);
	assert.equal(isInlineMathOpenNode(capturedFailure.openNode), true);
	assert.equal(isCloseMathNode(capturedFailure.closeNode), true);
	assert.equal(isOpenMathNode(capturedFailure.contentNode), false);
	assert.equal(isCloseMathNode(capturedFailure.contentNode), false);
});

test("rejects ordinary content nodes", () => {
	for (const name of ["list-1_math_variable-2", "math_variable-2", "Document"]) {
		assert.equal(isOpenMathNode(name), false);
		assert.equal(isCloseMathNode(name), false);
	}
});

test("rejects hashtag nodes", () => {
	const hashtag =
		"hashtag_hashtag-end_meta_tag_formatting_formatting-math_formatting-math-begin_keyword_math";
	assert.equal(isOpenMathNode(hashtag), false);
	assert.equal(isCloseMathNode(hashtag), false);
});

test("rejects unrelated formatting nodes", () => {
	for (const name of [
		"formatting_formatting-strong_strong",
		"formatting_formatting-em_formatting-em-end_em",
		"formatting_formatting-code_inline-code",
	]) {
		assert.equal(isOpenMathNode(name), false);
		assert.equal(isCloseMathNode(name), false);
	}
});

test("keeps inline and display classification independent", () => {
	for (const name of [nativeInlineOpen, listInlineOpen, headingInlineOpen]) {
		assert.equal(isInlineMathOpenNode(name), true);
	}
	assert.equal(isInlineMathOpenNode(nativeDisplayOpen), false);
});
