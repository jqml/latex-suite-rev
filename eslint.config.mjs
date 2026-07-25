import js from "@eslint/js";
import obsidianmd from "eslint-plugin-obsidianmd";
import globals from "globals";
import tsParser from "@typescript-eslint/parser";
import { defineConfig, globalIgnores } from "eslint/config";

export default defineConfig([
	globalIgnores([
		"node_modules",
		"main.js",
		"src/default_snippet_variables.js",
		"src/default_snippets.js",
		"src/utils/vim_types.d.ts",
	]),
	{
		files: ["**/*.mjs", "tests/**/*.js"],
		...js.configs.recommended,
		languageOptions: {
			globals: globals.node,
		},
	},
	...obsidianmd.configs.recommended,
	{
		files: ["src/**/*.ts"],
		languageOptions: {
			globals: globals.browser,
			parser: tsParser,
			parserOptions: {
				projectService: true,
				tsconfigRootDir: import.meta.dirname,
			},
		},
		rules: {
			// The upstream CodeMirror integration crosses Obsidian's bundled
			// CodeMirror types and package types, producing false unsafe-* results.
			"@typescript-eslint/no-unsafe-argument": "off",
			"@typescript-eslint/no-unsafe-assignment": "off",
			"@typescript-eslint/no-unsafe-call": "off",
			"@typescript-eslint/no-unsafe-member-access": "off",
			"@typescript-eslint/no-unsafe-return": "off",
			"@typescript-eslint/no-unnecessary-type-assertion": "off",
			"@typescript-eslint/no-explicit-any": "off",
			"@typescript-eslint/no-deprecated": "off",

			// Existing parser errors are strings consumed directly by Notices.
			"@typescript-eslint/only-throw-error": "off",

			// User-authored snippet modules are intentionally imported from an
			// in-memory data URL after schema validation.
			"no-unsanitized/method": "off",

			// Imperative settings retain compatibility with Obsidian 1.4.10.
			"obsidianmd/settings-tab/prefer-setting-definitions": "off",

			// This rule currently produces false positives for mathematical terms.
			"obsidianmd/ui/sentence-case": "off",
		},
	},
	{
		files: ["**/*.mjs", "tests/**/*.js"],
		rules: {
			"no-console": "off",
			"obsidianmd/hardcoded-config-path": "off",
			"obsidianmd/no-nodejs-modules": "off",
			"obsidianmd/regex-lookbehind": "off",
			"obsidianmd/rule-custom-message": "off",
		},
	},
]);
