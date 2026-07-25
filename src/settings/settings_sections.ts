export interface SettingsSectionDefinition {
	id: string;
	label: string;
	heading: string;
	icon: string;
}

export const SETTINGS_SECTIONS: readonly SettingsSectionDefinition[] = [
	{
		id: "snippets",
		label: "Snippets",
		heading: "Snippets",
		icon: "ballpen",
	},
	{
		id: "conceal",
		label: "Conceal",
		heading: "Conceal",
		icon: "math-integral-x",
	},
	{
		id: "brackets",
		label: "Brackets",
		heading: "Highlight and color brackets",
		icon: "parentheses",
	},
	{
		id: "preview",
		label: "Preview",
		heading: "Math popup preview",
		icon: "superscript",
	},
	{
		id: "auto-fraction",
		label: "Auto-fraction",
		heading: "Auto-fraction",
		icon: "math-x-divide-y-2",
	},
	{
		id: "matrices",
		label: "Matrices",
		heading: "Matrix shortcuts",
		icon: "brackets-contain",
	},
	{
		id: "tabout",
		label: "Tabout",
		heading: "Tabout",
		icon: "tabout",
	},
	{
		id: "auto-enlarge",
		label: "Auto-enlarge",
		heading: "Auto-enlarge brackets",
		icon: "parentheses",
	},
	{
		id: "advanced",
		label: "Advanced",
		heading: "Advanced snippet settings",
		icon: "settings-2",
	},
];

export function getSettingsSection(
	id: string,
): SettingsSectionDefinition {
	const section = SETTINGS_SECTIONS.find((candidate) => candidate.id === id);
	if (!section) throw new Error(`Unknown settings section: ${id}`);
	return section;
}

export function getSettingsSectionElementId(id: string): string {
	return `latex-suite-rev-settings-section-${id}`;
}

export function getSettingsSectionSelection(
	activeSectionId: string,
): ReadonlyMap<string, boolean> {
	if (!SETTINGS_SECTIONS.some((section) => section.id === activeSectionId)) {
		throw new Error(`Unknown settings section: ${activeSectionId}`);
	}
	return new Map(
		SETTINGS_SECTIONS.map((section) => [
			section.id,
			section.id === activeSectionId,
		]),
	);
}
