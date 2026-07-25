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

test("recognizes structural components without depending on their order", () => {
	for (const structuralComponent of [
		"list-2",
		"list-3",
		"header-1",
		"header-3",
		"header-4",
		"header-5",
		"header-6",
		"quote",
		"callout",
		"table",
		"property",
		"task-list",
	]) {
		const open =
			`formatting_${structuralComponent}_formatting-math_keyword_math_formatting-math-begin`;
		const close =
			`math_formatting-math-end_${structuralComponent}_keyword_formatting-math_formatting`;
		assert.equal(isOpenMathNode(open), true, structuralComponent);
		assert.equal(isInlineMathOpenNode(open), true, structuralComponent);
		assert.equal(isCloseMathNode(close), true, structuralComponent);
	}
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

test("requires complete delimiter components instead of matching substrings", () => {
	for (const name of [
		"prefixformatting_formatting-math_formatting-math-begin_keyword_math",
		"formatting_formatting-math_prefix-formatting-math-begin_keyword_math",
		"formatting_formatting-math_formatting-math-begin_prefix-keyword_math",
		"formatting_formatting-math_formatting-math-begin_keyword_math-content",
	]) {
		assert.equal(isOpenMathNode(name), false);
		assert.equal(isCloseMathNode(name), false);
	}
});

test("rejects hashtag components regardless of component order", () => {
	for (const name of [
		`formatting_${nativeInlineOpen}_hashtag`,
		`formatting-math-begin_keyword_math_formatting_hashtag-end_formatting-math`,
		`meta_formatting-math-end_keyword_math_formatting_formatting-math`,
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
	assert.equal(
		isInlineMathOpenNode(`${nativeInlineOpen}_not-math-block`),
		true,
	);
});
