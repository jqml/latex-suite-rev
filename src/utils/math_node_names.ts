const REQUIRED_BASE_COMPONENTS = [
	"formatting",
	"formatting-math",
	"keyword",
] as const;

const splitComponents = (name: string): Set<string> =>
	new Set(name.split("_").filter(Boolean));

const isMathDelimiter = (name: string, endpoint: string): boolean => {
	const components = splitComponents(name);
	if (
		components.has("hashtag") ||
		components.has("hashtag-end") ||
		components.has("meta")
	) {
		return false;
	}

	return (
		REQUIRED_BASE_COMPONENTS.every((component) => components.has(component)) &&
		components.has(endpoint) &&
		components.has("math")
	);
};

export const isOpenMathNode = (name: string): boolean =>
	isMathDelimiter(name, "formatting-math-begin");

export const isCloseMathNode = (name: string): boolean =>
	isMathDelimiter(name, "formatting-math-end");

export const isInlineMathOpenNode = (name: string): boolean =>
	isOpenMathNode(name) && !splitComponents(name).has("math-block");
