export const SUPPORTED_FOLDER_MODULE_EXTENSIONS = new Set(["js", "mjs"]);

export interface ExternalFileLoadFailure {
	kind: "snippet" | "variable";
	path: string;
	error: unknown;
}

export function isSupportedFolderModule(path: string): boolean {
	const extension = path.split(".").pop()?.toLowerCase();
	return extension !== undefined &&
		SUPPORTED_FOLDER_MODULE_EXTENSIONS.has(extension);
}

function errorMessage(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}

export function externalFileFailureSignature(
	failures: readonly ExternalFileLoadFailure[],
): string {
	return failures
		.map(({ kind, path, error }) => `${kind}:${path}:${errorMessage(error)}`)
		.sort()
		.join("\n");
}

export class ExternalFileFailureNoticeTracker {
	private previousSignature: string | null = null;

	shouldNotify(failures: readonly ExternalFileLoadFailure[]): boolean {
		if (failures.length === 0) {
			this.previousSignature = null;
			return false;
		}

		const signature = externalFileFailureSignature(failures);
		if (signature === this.previousSignature) return false;
		this.previousSignature = signature;
		return true;
	}
}

export function summarizeExternalFileFailures(
	failures: readonly ExternalFileLoadFailure[],
	maxExamples = 3,
): string {
	const examples = failures
		.slice(0, maxExamples)
		.map(({ path }) => path.split("/").pop() ?? path);
	const remaining = failures.length - examples.length;
	const exampleText = examples.length > 0
		? ` Examples: ${examples.join(", ")}${remaining > 0 ? `, and ${remaining} more` : ""}.`
		: "";

	return `Failed to parse ${failures.length} configured snippet module${failures.length === 1 ? "" : "s"}.${exampleText} See the developer console for details.`;
}
