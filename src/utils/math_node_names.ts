const MATH_BEGIN_MARKER =
	"formatting_formatting-math_formatting-math-begin_keyword_";
const MATH_END_MARKER =
	"formatting_formatting-math_formatting-math-end_keyword_";
const HASHTAG_NODE_PREFIX = "hashtag_hashtag-end_meta_tag";

const isMathDelimiter = (name: string, marker: string): boolean =>
	name.includes(marker) &&
	name.includes("math") &&
	!name.startsWith(HASHTAG_NODE_PREFIX);

export const isOpenMathNode = (name: string): boolean =>
	isMathDelimiter(name, MATH_BEGIN_MARKER);

export const isCloseMathNode = (name: string): boolean =>
	isMathDelimiter(name, MATH_END_MARKER);

export const isInlineMathOpenNode = (name: string): boolean =>
	isOpenMathNode(name) && !name.includes("math-block");
