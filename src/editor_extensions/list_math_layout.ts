import { Range } from "@codemirror/state";
import {
	Decoration,
	EditorView,
	ViewPlugin,
	ViewUpdate,
} from "@codemirror/view";
import type { DecorationSet } from "@codemirror/view";

export const MATH_ONLY_LIST_LINE_CLASS =
	"latex-suite-rev-math-only-list-line";

const LIST_LEADING_INLINE_MATH_LINE =
	/^(?:[ \t]*>[ \t]*)*[ \t]*(?:[-+*]|\d+[.)])[ \t]+\$(?!\$)(?:\\.|[^$\n])*\$(?!\$)(?:[ \t]+.*)?$/;

export function isListLeadingInlineMathLine(text: string): boolean {
	return LIST_LEADING_INLINE_MATH_LINE.test(text);
}

function buildDecorations(view: EditorView): DecorationSet {
	const decorations: Range<Decoration>[] = [];
	const visitedLines = new Set<number>();

	for (const range of view.visibleRanges) {
		let line = view.state.doc.lineAt(range.from);
		while (line.from <= range.to) {
			if (
				!visitedLines.has(line.from) &&
				isListLeadingInlineMathLine(line.text)
			) {
				visitedLines.add(line.from);
				decorations.push(
					Decoration.line({
						attributes: { class: MATH_ONLY_LIST_LINE_CLASS },
					}).range(line.from),
				);
			}
			if (line.to >= view.state.doc.length || line.to >= range.to) break;
			line = view.state.doc.lineAt(line.to + 1);
		}
	}

	return Decoration.set(decorations, true);
}

export const listMathLayoutPlugin = ViewPlugin.fromClass(
	class {
		decorations: DecorationSet;

		constructor(view: EditorView) {
			this.decorations = buildDecorations(view);
		}

		update(update: ViewUpdate) {
			if (update.docChanged || update.viewportChanged) {
				this.decorations = buildDecorations(update.view);
			}
		}
	},
	{
		decorations: (plugin) => plugin.decorations,
	},
);
