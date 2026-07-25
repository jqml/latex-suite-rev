export const getMatrixLineIndent = (line: string): string => {
	const match = line.match(/(?:\\begin{[^}]*}|\\\\|^)((?:\s|&)+)/);
	return match?.[1].trimStart() ?? "";
};
