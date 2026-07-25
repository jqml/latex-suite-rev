export interface TextBounds {
	inner_start: number;
	inner_end: number;
	outer_start: number;
	outer_end: number;
}

/**
 * Finds an inline equation nested inside an existing equation's text content.
 * All returned positions remain absolute document offsets.
 */
export const findNestedInlineMathBounds = (
	outerText: string,
	outerBounds: TextBounds,
	absolutePosition: number,
): TextBounds => {
	const relativePosition = absolutePosition - outerBounds.inner_start;
	if (relativePosition < 0 || relativePosition > outerText.length) {
		return outerBounds;
	}

	// Preserve string length while preventing escaped dollars from acting as delimiters.
	const searchableText = outerText.replaceAll("\\$", "\\R");
	const left = searchableText.lastIndexOf("$", relativePosition - 1);
	const right = searchableText.indexOf("$", relativePosition);
	if (left === -1 || right === -1) return outerBounds;

	const offset = outerBounds.inner_start;
	return {
		inner_start: offset + left + 1,
		inner_end: offset + right,
		outer_start: offset + left,
		outer_end: offset + right + 1,
	};
};
