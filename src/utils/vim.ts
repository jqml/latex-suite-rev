import type { Vim } from "./vim_types";

type WindowWithCodeMirrorAdapter = Window & {
	CodeMirrorAdapter?: {
		Vim?: Vim;
	};
};

/**
 * Obsidian does not currently expose its optional Vim adapter through the public
 * plugin API. Keep this compatibility access isolated so the rest of the plugin
 * does not depend on global app internals.
 */
export const getVimAdapter = (): Vim | null =>
	(window as WindowWithCodeMirrorAdapter).CodeMirrorAdapter?.Vim ?? null;
