export const expandRegexReplacement = (
	replacement: string,
	result: RegExpExecArray,
): string =>
	result.slice(1).reduce(
		(current, capture, index) =>
			current.replaceAll(`[[${index}]]`, capture ?? ""),
		replacement,
	);
