# Changelog

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
