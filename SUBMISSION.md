# Community Plugins submission notes

LaTeX Suite Rev is a maintained fork of Obsidian LaTeX Suite 1.11.5 under the upstream MIT license. JQML maintains the Rev distribution and did not author the original plugin.

## Approval boundary

Do not submit this repository to the Obsidian Community Plugins directory until artisticat1 provides explicit written approval in a publicly verifiable location. Obsidian's current developer policy does not permit an active fork without that approval. The upstream repository was active during the 0.1.1 audit, so the abandoned-project exception does not apply.

Record the approval URL here before submission:

```text
Upstream fork approval: PENDING
```

## Reviewer questions and prepared responses

### Why is this a separate plugin instead of a contribution to upstream?

The Rev distribution makes a verified compatibility fix available from a separately versioned release while preserving clear upstream attribution. The fix recognizes semantic CodeMirror math delimiter components when Obsidian inserts list, heading, or other Markdown structure components into composite node names. A focused, PR-ready patch should also be offered upstream; the separate directory listing will be requested only with the upstream author's public approval.

### Is this original work by JQML?

No. The README and MIT license preserve artisticat1's authorship and copyright. JQML maintains the distribution, packaging, deployment tooling, compatibility patch, and Rev-specific regression tests.

### Can users enable both plugins?

No. Both plugins register equivalent commands and editor extensions. The README warns users not to enable both, and the deployment tool disables the official plugin entry while retaining its folder for rollback.

### Does it use undocumented Obsidian APIs?

The core editor extension uses CodeMirror 6 packages exposed by Obsidian. Two inherited optional integrations remain review-sensitive: editor commands access the underlying CodeMirror view through `editor.cm`, and Vim mappings use the guarded `window.CodeMirrorAdapter.Vim` adapter because no public Vim mapping API exists. Both degrade safely when absent, but they should be disclosed to reviewers and replaced if a public API becomes available.

### Is it mobile compatible?

The shipped runtime imports no Node.js or Electron modules. Bundled regex lookbehind was removed for older iOS JavaScript engines. The manifest remains mobile-compatible, but a physical iOS and Android smoke test is required before submission.

### Does it use the network or collect data?

No. The runtime has no network requests, telemetry, advertising, or updater. User-authored snippet modules are loaded from plugin settings or configured files inside the vault.

### How is upstream kept in sync?

Each release records its upstream base. Upstream releases and security fixes are reviewed before Rev releases; compatibility patches remain isolated and regression-tested. Rev does not claim that unreleased upstream-main changes are stable.

## Final checklist

1. Obtain and record public upstream fork approval.
2. Complete physical iOS and Android smoke tests.
3. Reconfirm the guarded internal CodeMirror and Vim access with reviewers.
4. Verify the default-branch manifest, README, `LICENSE`, and `versions.json`.
5. Verify the matching release contains exactly `main.js`, `manifest.json`, and `styles.css`.
6. Submit through community.obsidian.md only after explicit user approval.

No upstream pull request or Community Plugins directory submission is authorized by this audit.
