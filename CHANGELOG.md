# Changelog

## 0.2.0

- Add a section-based settings selector that keeps exactly one mounted settings section visible at a time.
- Present all section controls in a wrapped two-row navigator, reducing unnecessary settings-page scrolling.
- Preserve keyboard navigation and accessible section relationships without persisting navigation state.

## 0.1.3

- Correct native Live Preview list-marker padding leaking onto every token when inline math is the first content in a list item.
- Restore Obsidian’s semantic syntax colors for affected delimiters, variables, commands, punctuation, numbers, operators, strings, keywords, comments, and functions.
- Preserve native MathJax rendering, blockquote and list markers, selection, bracket matching, task lists, display math, and non-list math.
- Add regression coverage for unordered, ordered, nested, blockquote, trailing-text, task-list, display-math, escaped-dollar, and non-list structures.

## 0.1.2

- Replace raw data-URL snippet imports with temporary in-memory Blob modules that are always revoked.
- Restore the official `no-unsanitized/method` lint rule repository-wide and document the single intentional Blob import.
- Add focused regression coverage for module exports, fallback parsing, executable snippet values, cleanup, URL isolation, and the existing bar semantics.

## 0.1.1

- Harden inline-math delimiter classification across Markdown structures while rejecting content and hashtag nodes.
- Correct nested inline-math bounds, multi-cursor context handling, tab-stop history, and Vim cleanup.
- Replace mobile-incompatible regular-expression lookbehind and an internal settings suggester with mobile-safe equivalents.
- Prevent stale external-snippet validation and normalize watched vault paths.
- Harden the explicit-vault installer with symlink checks, atomic swaps, rollback, collision-safe backups, and strict dry-run validation.
- Update Obsidian API types and runtime dependencies, add official plugin-policy linting, and expand submission-readiness documentation.

## 0.1.0

- Fork Obsidian LaTeX Suite 1.11.5 as the independently maintained LaTeX Suite Rev distribution.
- Preserve inline-math context when CodeMirror math delimiter nodes carry list, heading, or other Markdown structural components.
- Add regression tests for native and structurally tagged inline/display math delimiters.
- Add explicit-vault deployment tooling with dry-run, backups, settings migration, and official-plugin rollback support.
