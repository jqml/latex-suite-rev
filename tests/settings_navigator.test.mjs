import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
	getSettingsSection,
	getSettingsSectionElementId,
	getSettingsSectionSelection,
	SETTINGS_SECTIONS,
} from "../src/settings/settings_sections.ts";

test("registers each existing settings section once with a stable unique ID", () => {
	assert.deepEqual(
		SETTINGS_SECTIONS.map(({ id, label, heading }) => ({
			id,
			label,
			heading,
		})),
		[
			{ id: "snippets", label: "Snippets", heading: "Snippets" },
			{ id: "conceal", label: "Conceal", heading: "Conceal" },
			{
				id: "brackets",
				label: "Brackets",
				heading: "Highlight and color brackets",
			},
			{
				id: "preview",
				label: "Preview",
				heading: "Math popup preview",
			},
			{
				id: "auto-fraction",
				label: "Auto-fraction",
				heading: "Auto-fraction",
			},
			{
				id: "matrices",
				label: "Matrices",
				heading: "Matrix shortcuts",
			},
			{ id: "tabout", label: "Tabout", heading: "Tabout" },
			{
				id: "auto-enlarge",
				label: "Auto-enlarge",
				heading: "Auto-enlarge brackets",
			},
			{
				id: "advanced",
				label: "Advanced",
				heading: "Advanced snippet settings",
			},
		],
	);

	const ids = SETTINGS_SECTIONS.map((section) => section.id);
	const elementIds = ids.map(getSettingsSectionElementId);
	assert.equal(new Set(ids).size, ids.length);
	assert.equal(new Set(elementIds).size, elementIds.length);
	for (const section of SETTINGS_SECTIONS) {
		assert.equal(getSettingsSection(section.id), section);
		assert.equal(
			getSettingsSectionElementId(section.id),
			`latex-suite-rev-settings-section-${section.id}`,
		);
	}
});

test("selection model exposes exactly one visible section", () => {
	for (const selected of SETTINGS_SECTIONS) {
		const states = getSettingsSectionSelection(selected.id);
		assert.equal(states.size, SETTINGS_SECTIONS.length);
		assert.deepEqual(
			[...states].filter(([, active]) => active).map(([id]) => id),
			[selected.id],
		);
	}
	assert.throws(
		() => getSettingsSectionSelection("missing"),
		/Unknown settings section/,
	);
});

test("navigator switches mounted section wrappers without rebuilding controls", async () => {
	const source = await readFile("src/settings/settings_tab.ts", "utf8");
	for (const section of SETTINGS_SECTIONS) {
		assert.match(
			source,
			new RegExp(`getSettingsSection\\("${section.id}"\\)`),
		);
	}
	assert.match(source, /createEl\("section"/);
	assert.match(source, /settingsSectionEls\.set\(section\.id, sectionEl\)/);
	assert.match(source, /sectionEl\.hidden = !active/);
	assert.match(source, /sectionEl\.setAttribute\("aria-hidden", String\(!active\)\)/);
	assert.doesNotMatch(
		source,
		/activateSettingsSection[\s\S]*?containerEl\.empty\(\)/,
	);
	assert.doesNotMatch(source, /querySelector(All)?\([^)]*setting-item-heading/);
});

test("native buttons retain keyboard activation and accessible section state", async () => {
	const source = await readFile("src/settings/settings_tab.ts", "utf8");
	assert.match(source, /createEl\("button"/);
	assert.match(source, /type:\s*"button"/);
	assert.match(source, /"aria-controls": getSettingsSectionElementId/);
	assert.match(source, /addEventListener\("click"/);
	assert.match(source, /activateSettingsSection\(section\.id\)/);
	assert.match(source, /setAttribute\("aria-current", "page"\)/);
	assert.doesNotMatch(source, /addEventListener\("key(?:down|up|press)"/);
});

test("settings-tab cleanup removes temporary selector resources", async () => {
	const source = await readFile("src/settings/settings_tab.ts", "utf8");
	assert.match(source, /hide\(\)[\s\S]*?destroySettingsNavigator\(\)/);
	assert.match(source, /removeEventListener\("click"/);
	assert.match(source, /settingsNavEl\?\.remove\(\)/);
	assert.match(source, /settingsNavButtons\.clear\(\)/);
	assert.match(source, /settingsSectionEls\.clear\(\)/);
});

test("selector has no scroll-spy or smooth-scroll implementation", async () => {
	const source = await readFile("src/settings/settings_tab.ts", "utf8");
	assert.doesNotMatch(source, /scrollIntoView|behavior:\s*"smooth"/);
	assert.doesNotMatch(source, /addEventListener\("scroll"/);
	assert.doesNotMatch(source, /ResizeObserver|requestAnimationFrame/);
	assert.doesNotMatch(source, /getBoundingClientRect|scroll-margin/);
	assert.doesNotMatch(
		source,
		/settingsNavScroll|settingsNavTarget|scheduleSettingsNavigator/,
	);
});

test("selector state is temporary and absent from persisted settings", async () => {
	const [tabSource, settingsSource] = await Promise.all([
		readFile("src/settings/settings_tab.ts", "utf8"),
		readFile("src/settings/settings.ts", "utf8"),
	]);
	assert.doesNotMatch(settingsSource, /settingsNav|navigator|activeSection/i);
	assert.doesNotMatch(
		tabSource,
		/plugin\.settings\.(?:settingsNav|navigator|activeSection)/,
	);
});

test("navigator wraps without horizontal overflow and uses scoped theme styling", async () => {
	const css = await readFile("styles.css", "utf8");
	assert.match(
		css,
		/\.latex-suite-settings\s*\{[\s\S]*?padding-block-start:\s*var\(--size-4-8\)/,
	);
	assert.match(
		css,
		/\.latex-suite-settings \.latex-suite-rev-settings-nav\s*\{[\s\S]*?border-bottom:\s*1px solid var\(--background-modifier-border\)/,
	);
	assert.doesNotMatch(
		css,
		/\.setting-item\.setting-item-heading:has\(\.latex-suite-settings-icon\)\s*\{[\s\S]*?border-bottom:/,
	);
	assert.match(
		css,
		/\.latex-suite-settings \.latex-suite-rev-settings-nav-track\s*\{[\s\S]*?display:\s*flex;[\s\S]*?flex-wrap:\s*wrap/,
	);
	assert.doesNotMatch(css, /overflow-x:\s*(?:auto|scroll)/);
	assert.doesNotMatch(css, /white-space:\s*nowrap/);
	assert.doesNotMatch(css, /scroll-margin|--latex-suite-rev-settings-nav-height/);

	const navigatorCss = css
		.split("\n")
		.filter((line) => line.includes("latex-suite-rev-settings-"))
		.join("\n");
	assert.doesNotMatch(
		navigatorCss,
		/position:\s*fixed|!important|#[0-9a-f]{3,8}|rgba?\(/i,
	);
	assert.doesNotMatch(
		navigatorCss,
		/(?:^|,)\s*(?:\.setting-item|\.cm-line|\.cm-math)(?:[\s,{]|$)/m,
	);
});
