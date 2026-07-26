import { Range } from "@codemirror/state";
import { syntaxTree } from "@codemirror/language";
import {
	Decoration,
	EditorView,
	ViewPlugin,
	ViewUpdate,
} from "@codemirror/view";
import type { DecorationSet } from "@codemirror/view";

export const MATH_ONLY_LIST_LINE_CLASS =
	"latex-suite-rev-math-only-list-line";
export const STALE_LIST_MATH_LINE_CLASS =
	"latex-suite-rev-stale-list-math-line";

const LIST_LEADING_INLINE_MATH_LINE =
	/^(?:[ \t]*>[ \t]*)*[ \t]*(?:[-+*]|\d+[.)])[ \t]+\$(?!\$)(?:\\.|[^$\n])*\$(?!\$)(?:[ \t]+.*)?$/;
const STANDALONE_INLINE_MATH_LINE =
	/^[ \t]*\$(?!\$)(?:\\.|[^$\n])*\$(?!\$)[ \t]*$/;

export function isListLeadingInlineMathLine(text: string): boolean {
	return LIST_LEADING_INLINE_MATH_LINE.test(text);
}

export function isStandaloneInlineMathLine(text: string): boolean {
	return STANDALONE_INLINE_MATH_LINE.test(text);
}

export function hasLeakedListMathNodeNames(
	nodeNames: readonly string[],
): boolean {
	return nodeNames.some((name) => {
		const components = new Set(name.split("_").filter(Boolean));
		return components.has("math") && (
			components.has("formatting-list-ul") ||
			components.has("formatting-list-ol")
		);
	});
}

export function classifyMathLayoutLine(
	text: string,
	nodeNames: readonly string[],
): string | null {
	if (isListLeadingInlineMathLine(text)) return MATH_ONLY_LIST_LINE_CLASS;
	if (
		isStandaloneInlineMathLine(text) &&
		hasLeakedListMathNodeNames(nodeNames)
	) {
		return STALE_LIST_MATH_LINE_CLASS;
	}
	return null;
}

function buildDecorations(view: EditorView): DecorationSet {
	const decorations: Range<Decoration>[] = [];
	const visitedLines = new Set<number>();
	const tree = syntaxTree(view.state);

	for (const range of view.visibleRanges) {
		let line = view.state.doc.lineAt(range.from);
		while (line.from <= range.to) {
			if (!visitedLines.has(line.from)) {
				visitedLines.add(line.from);
				const nodeNames: string[] = [];
				tree.iterate({
					from: line.from,
					to: line.to,
					enter: (node) => {
						nodeNames.push(node.name);
					},
				});
				const lineClass = classifyMathLayoutLine(line.text, nodeNames);
				if (lineClass) {
					decorations.push(
						Decoration.line({
							attributes: { class: lineClass },
						}).range(line.from),
					);
				}
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
			if (
				update.docChanged ||
				update.viewportChanged ||
				syntaxTree(update.startState) !== syntaxTree(update.state)
			) {
				this.decorations = buildDecorations(update.view);
			}
		}
	},
	{
		decorations: (plugin) => plugin.decorations,
	},
);
