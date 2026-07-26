import LatexSuitePlugin from "../main";
import { Vault, TFile, TFolder, TAbstractFile, debounce, normalizePath } from "obsidian";
import { Snippet } from "../snippets/snippets";
import { parseSnippets, parseSnippetVariables, type SnippetVariables } from "../snippets/parse";
import { sortSnippets } from "src/snippets/sort";
import { difference, intersection } from "src/utils/prototype_utils";
import { pathIsWithin } from "src/utils/vault_path";
import {
	type ExternalFileLoadFailure,
	isSupportedFolderModule,
} from "./external_file_loading";

function isInFolder(file: TFile, dir: TFolder) {
	let cur = file.parent;
	let cnt = 0;

	while (cur && (!cur.isRoot()) && (cnt < 100)) {

		if (cur.path === dir.path) return true;

		cur = cur.parent;
		cnt++;
	}

	return false;
}

function fileIsInFolder(plugin: LatexSuitePlugin, folderPath: string, file: TFile) {
	const snippetDir = plugin.app.vault.getAbstractFileByPath(normalizePath(folderPath));
	const isFolder = snippetDir instanceof TFolder;

	return (isFolder && isInFolder(file, snippetDir));
}

const refreshers = new WeakMap<LatexSuitePlugin, () => void>();

function refreshFromFiles(plugin: LatexSuitePlugin) {
	let refresh = refreshers.get(plugin);
	if (!refresh) {
		refresh = debounce(async () => {
			if (!(plugin.settings.loadSnippetVariablesFromFile || plugin.settings.loadSnippetsFromFile)) {
				return;
			}

			await plugin.processSettings(false, true);
		}, 500, true);
		refreshers.set(plugin, refresh);
	}
	refresh();
}

function isConfiguredFileOrSupportedFolderFile(
	plugin: LatexSuitePlugin,
	enabled: boolean,
	configuredPath: string,
	file: TFile,
): boolean {
	if (!enabled) return false;
	if (file.path === configuredPath) return true;
	return isSupportedFolderModule(file.path) &&
		fileIsInFolder(plugin, configuredPath, file);
}

export const onFileChange = async (plugin: LatexSuitePlugin, file: TAbstractFile) => {
	if (!(file instanceof TFile)) return;

	if (isConfiguredFileOrSupportedFolderFile(
		plugin,
		plugin.settings.loadSnippetVariablesFromFile,
		plugin.settings.snippetVariablesFileLocation,
		file,
	) || isConfiguredFileOrSupportedFolderFile(
		plugin,
		plugin.settings.loadSnippetsFromFile,
		plugin.settings.snippetsFileLocation,
		file,
	)
	) {
		refreshFromFiles(plugin);
	}
}

export const onFileCreate = (plugin: LatexSuitePlugin, file: TAbstractFile) => {
	if (!(file instanceof TFile)) return;

	if (isSupportedFolderModule(file.path) && (
		plugin.settings.loadSnippetVariablesFromFile &&
			fileIsInFolder(plugin, plugin.settings.snippetVariablesFileLocation, file)
		|| plugin.settings.loadSnippetsFromFile &&
			fileIsInFolder(plugin, plugin.settings.snippetsFileLocation, file)
	)
	) {
		refreshFromFiles(plugin);
	}
}

export const onFileDelete = (plugin: LatexSuitePlugin, file: TAbstractFile) => {
	if (!(file instanceof TFile)) return;

	const snippetVariablesDir = plugin.app.vault.getAbstractFileByPath(
		normalizePath(plugin.settings.snippetVariablesFileLocation),
	);
	const snippetDir = plugin.app.vault.getAbstractFileByPath(
		normalizePath(plugin.settings.snippetsFileLocation),
	);

	if (isSupportedFolderModule(file.path) && (
		plugin.settings.loadSnippetVariablesFromFile &&
			snippetVariablesDir instanceof TFolder &&
			pathIsWithin(file.path, snippetVariablesDir.path)
		|| plugin.settings.loadSnippetsFromFile &&
			snippetDir instanceof TFolder &&
			pathIsWithin(file.path, snippetDir.path)
	)
	) {
		refreshFromFiles(plugin);
	}
}

function* generateFilesWithin(
	fileOrFolder: TAbstractFile,
	isFolderScan = false,
): Generator<TFile> {
	if (fileOrFolder instanceof TFile) {
		if (!isFolderScan || isSupportedFolderModule(fileOrFolder.path)) {
			yield fileOrFolder;
		}
	} else if (fileOrFolder instanceof TFolder) {
		for (const child of fileOrFolder.children) {
			yield* generateFilesWithin(child, true);
		}
	}
}

function getFilesWithin(vault: Vault, path: string): Set<TFile> {
	const fileOrFolder = vault.getAbstractFileByPath(normalizePath(path));
	if (!fileOrFolder) {
		console.warn(`Could not find file or folder at path ${path}`);
		return new Set<TFile>();
	}
	const files = generateFilesWithin(fileOrFolder);
	return new Set(files);
}

interface FileSets {
	definitelyVariableFiles: Set<TFile>;
	definitelySnippetFiles: Set<TFile>;
	snippetOrVariableFiles: Set<TFile>;
}

export function getFileSets(plugin: LatexSuitePlugin): FileSets {
	const variablesFolder =
		plugin.settings.loadSnippetVariablesFromFile
		? getFilesWithin(plugin.app.vault, plugin.settings.snippetVariablesFileLocation)
		: new Set<TFile>();

	const snippetsFolder =
		plugin.settings.loadSnippetsFromFile
		? getFilesWithin(plugin.app.vault, plugin.settings.snippetsFileLocation)
			: new Set<TFile>();

	const definitelyVariableFiles = difference(variablesFolder, snippetsFolder);
	const definitelySnippetFiles = difference(snippetsFolder, variablesFolder);
	const snippetOrVariableFiles = intersection(variablesFolder, snippetsFolder);

	return {definitelyVariableFiles, definitelySnippetFiles, snippetOrVariableFiles};
}

export async function getVariablesFromFiles(
	plugin: LatexSuitePlugin,
	files: FileSets,
	failures: ExternalFileLoadFailure[],
) {
	const snippetVariables: SnippetVariables = {};

	for (const file of files.definitelyVariableFiles) {
		try {
			const content = await plugin.app.vault.cachedRead(file);
			Object.assign(snippetVariables, await parseSnippetVariables(content));
		} catch (e) {
			failures.push({ kind: "variable", path: file.path, error: e });
			console.error(`Failed to parse variable file ${file.path}:`, e);
			files.definitelyVariableFiles.delete(file);
		}
	}

	return snippetVariables;
}

export async function tryGetVariablesFromUnknownFiles(
	plugin: LatexSuitePlugin,
	files: FileSets,
	failures: ExternalFileLoadFailure[],
) {
	const snippetVariables: SnippetVariables = {};

	for (const file of files.snippetOrVariableFiles) {
		let content: string;
		try {
			content = await plugin.app.vault.cachedRead(file);
		} catch (readError) {
			failures.push({
				kind: "snippet",
				path: file.path,
				error: readError,
			});
			console.error(`Failed to read configured module ${file.path}:`, readError);
			files.snippetOrVariableFiles.delete(file);
			continue;
		}

		try {
			Object.assign(snippetVariables, await parseSnippetVariables(content));
			files.definitelyVariableFiles.add(file);
		} catch {
			// No error here, we just assume this is a snippets file.
			// If it's not, then an error will be raised later, while parsing it.
			files.definitelySnippetFiles.add(file);
		}
		files.snippetOrVariableFiles.delete(file);
	}

	return snippetVariables;
}

export async function getSnippetsFromFiles(
	plugin: LatexSuitePlugin,
	files: FileSets,
	snippetVariables: SnippetVariables,
	failures: ExternalFileLoadFailure[],
) {
	const snippets: Snippet[] = [];

	for (const file of files.definitelySnippetFiles) {
		try {
			const content = await plugin.app.vault.cachedRead(file);
			snippets.push(...await parseSnippets(content, snippetVariables));
		} catch (e) {
			failures.push({ kind: "snippet", path: file.path, error: e });
			console.error(`Failed to parse snippet file ${file.path}:`, e);
			files.definitelySnippetFiles.delete(file);
		}
	}

	return sortSnippets(snippets);
}
