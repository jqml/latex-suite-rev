export const applyVisualSelection = (
	replacement: string,
	placeholder: string,
	selection: string,
): string => replacement.replaceAll(placeholder, selection);
