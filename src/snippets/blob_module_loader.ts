type LoadedModule = Record<string, unknown>;
export type ModuleSourceLoader = (
	source: string,
	diagnosticIdentifier: string,
) => Promise<LoadedModule>;

export interface BlobModuleEnvironment {
	createObjectURL(blob: Blob): string;
	revokeObjectURL(objectUrl: string): void;
	importObjectURL(objectUrl: string): Promise<LoadedModule>;
}

const browserBlobModuleEnvironment: BlobModuleEnvironment = {
	createObjectURL: (blob) => URL.createObjectURL(blob),
	revokeObjectURL: (objectUrl) => URL.revokeObjectURL(objectUrl),
	importObjectURL: async (objectUrl) => {
		// eslint-disable-next-line no-unsanitized/method -- objectUrl is generated internally from an in-memory Blob of the user's explicitly configured local snippet text; no network or filesystem URL is accepted, and dynamic module evaluation is an intentional documented LaTeX Suite snippet feature.
		return import(objectUrl) as Promise<LoadedModule>;
	},
};

export async function importBlobModule(
	source: string,
	diagnosticIdentifier: string,
	environment: BlobModuleEnvironment = browserBlobModuleEnvironment,
): Promise<LoadedModule> {
	const safeIdentifier = diagnosticIdentifier.replace(/[\r\n]/g, " ");
	const sourceWithSourceURL =
		`${source}\n//# sourceURL=latex-suite-rev:${safeIdentifier}`;
	const blob = new Blob([sourceWithSourceURL], { type: "text/javascript" });
	const objectUrl = environment.createObjectURL(blob);
	try {
		return await environment.importObjectURL(objectUrl);
	} finally {
		environment.revokeObjectURL(objectUrl);
	}
}

export async function importSnippetSource(
	source: string,
	diagnosticIdentifier: string,
	loadModule: ModuleSourceLoader = importBlobModule,
): Promise<unknown> {
	let explicitModule: LoadedModule | null = null;
	try {
		explicitModule = await loadModule(source, diagnosticIdentifier);
		if ("default" in explicitModule) return explicitModule.default;
	} catch {
		// A standalone object or array is handled by the fallback below.
	}

	try {
		const fallbackModule = await loadModule(
			`export default ${source}`,
			`${diagnosticIdentifier}:fallback`,
		);
		if (!("default" in fallbackModule)) {
			throw new Error("Fallback module has no default export");
		}
		return fallbackModule.default;
	} catch {
		if (explicitModule) {
			throw new Error(
				`No default export provided for ${diagnosticIdentifier}`,
			);
		}
		throw new Error(`Invalid module source for ${diagnosticIdentifier}`);
	}
}
