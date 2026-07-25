import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
	importBlobModule,
	importSnippetSource,
} from "../src/snippets/blob_module_loader.ts";

const createModuleHarness = () => {
	const blobs = new Map();
	const revoked = [];
	let nextId = 0;
	const importedUrls = [];

	const environment = {
		createObjectURL(blob) {
			const objectUrl = `blob:latex-suite-rev-test/${nextId++}`;
			blobs.set(objectUrl, blob);
			return objectUrl;
		},
		revokeObjectURL(objectUrl) {
			revoked.push(objectUrl);
			blobs.delete(objectUrl);
		},
		async importObjectURL(objectUrl) {
			importedUrls.push(objectUrl);
			assert.match(objectUrl, /^blob:latex-suite-rev-test\//);
			const blob = blobs.get(objectUrl);
			assert.ok(blob);
			assert.equal(blob.type, "text/javascript");
			const source = await blob.text();
			assert.match(source, /\/\/# sourceURL=latex-suite-rev:/);
			return { default: source };
		},
	};

	return {
		environment,
		importedUrls,
		revoked,
		loadModule: (source, identifier) =>
			importBlobModule(source, identifier, environment),
	};
};

test("loads an explicit default export with RegExp and function values", async () => {
	const expected = [{
		trigger: /([a-zA-Z])bar/,
		replacement: (match) => `\\overline{${match[1]}}`,
		options: "rmA",
	}];
	const explicitSource = "export default configuredSnippets";
	const value = await importSnippetSource(
		explicitSource,
		"explicit-snippets",
		async (source) => {
			assert.equal(source, explicitSource);
			return { default: expected };
		},
	);

	assert.ok(Array.isArray(value));
	assert.ok(value[0].trigger instanceof RegExp);
	assert.equal(value[0].trigger.source, "([a-zA-Z])bar");
	assert.equal(typeof value[0].replacement, "function");
	assert.equal(value[0].replacement(["ssbar", "s"]), "\\overline{s}");
});

test("preserves the fallback that prepends export default", async () => {
	const source =
		`[{ trigger: "bar", replacement: "\\\\overline{$0}$1", options: "mA" }]`;
	const calls = [];
	const value = await importSnippetSource(
		source,
		"fallback-snippets",
		async (moduleSource, identifier) => {
			calls.push({ moduleSource, identifier });
			if (moduleSource === source) throw new SyntaxError("Missing export");
			return {
				default: [{
					trigger: "bar",
					replacement: "\\overline{$0}$1",
					options: "mA",
				}],
			};
		},
	);

	assert.deepEqual(value, [
		{
			trigger: "bar",
			replacement: "\\overline{$0}$1",
			options: "mA",
		},
	]);
	assert.deepEqual(calls, [
		{ moduleSource: source, identifier: "fallback-snippets" },
		{
			moduleSource: `export default ${source}`,
			identifier: "fallback-snippets:fallback",
		},
	]);
});

test("invalid module source rejects with an Error", async () => {
	await assert.rejects(
		importSnippetSource(
			"export default [",
			"invalid-snippets",
			async () => {
				throw new SyntaxError("Invalid source");
			},
		),
		(error) =>
			error instanceof Error &&
			error.message === "Invalid module source for invalid-snippets",
	);
});

test("a valid module without a default export rejects with an Error", async () => {
	await assert.rejects(
		importSnippetSource(
			"export const snippets = [];",
			"missing-default",
			async (source) => {
				if (source.startsWith("export default ")) {
					throw new SyntaxError("Invalid fallback source");
				}
				return { snippets: [] };
			},
		),
		(error) =>
			error instanceof Error &&
			error.message === "No default export provided for missing-default",
	);
});

test("object URLs are revoked after successful imports", async () => {
	const harness = createModuleHarness();
	const loaded = await importBlobModule(
		"export default 42",
		"successful-import",
		harness.environment,
	);
	assert.match(
		loaded.default,
		/^export default 42\n\/\/# sourceURL=latex-suite-rev:successful-import$/,
	);
	assert.deepEqual(harness.revoked, harness.importedUrls);
});

test("object URLs are revoked after failed imports", async () => {
	const revoked = [];
	const objectUrl = "blob:latex-suite-rev-test/failure";
	await assert.rejects(
		importBlobModule("invalid source", "failed-import", {
			createObjectURL: () => objectUrl,
			revokeObjectURL: (url) => revoked.push(url),
			importObjectURL: async () => {
				throw new SyntaxError("Invalid source");
			},
		}),
		SyntaxError,
	);
	assert.deepEqual(revoked, [objectUrl]);
});

test("runtime loader accepts source text only and contains no network or filesystem loader", async () => {
	const source = await readFile(
		"src/snippets/blob_module_loader.ts",
		"utf8",
	);
	assert.doesNotMatch(
		source,
		/\b(?:fetch|requestUrl|XMLHttpRequest|WebSocket|eval|Function)\s*\(/,
	);
	assert.doesNotMatch(source, /(?:node:fs|electron|data:text|file:\/\/)/);

	await assert.rejects(
		importSnippetSource(
			"https://example.com/snippets.js",
			"url-shaped-source",
			async () => {
				throw new SyntaxError("URL-shaped text is not module source");
			},
		),
		Error,
	);
});
