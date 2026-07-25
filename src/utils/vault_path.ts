export const pathIsWithin = (filePath: string, folderPath: string): boolean =>
	filePath === folderPath || filePath.startsWith(`${folderPath}/`);
