# Submission notes

LaTeX Suite Rev is an independently maintained distribution derived from Obsidian LaTeX Suite 1.11.5 under the upstream MIT license.

The initial compatibility patch replaces exact equality checks against composite CodeMirror math delimiter node names with semantic recognition of `formatting-math-begin` and `formatting-math-end` components. Inline and display modes remain distinguished through `math-block`.

Before any public directory submission:

1. Confirm the upstream attribution and distinct-plugin rationale remain prominent.
2. Confirm `id: latex-suite-rev`, release assets, and `versions.json`.
3. Test coexistence safeguards and document that the official plugin must be disabled.
4. Submit to the Obsidian Community Plugins directory only after separate maintainer approval.

No upstream pull request or Community Plugins directory submission is part of version 0.1.0.
