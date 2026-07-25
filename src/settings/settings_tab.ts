import { EditorState, Extension } from "@codemirror/state";
import { EditorView, ViewUpdate } from "@codemirror/view";
import { App, ButtonComponent, ExtraButtonComponent, Modal, Notice, Platform, PluginSettingTab, Setting, debounce, setIcon } from "obsidian";
import { parseKeyName, parseSnippetVariables, parseSnippets } from "src/snippets/parse";
import { DEFAULT_SNIPPETS } from "src/utils/default_snippets";
import LatexSuitePlugin from "../main";
import { DEFAULT_SETTINGS, LatexSuiteCMKeymapSettings } from "./settings";
import { FileSuggest } from "./ui/file_suggest";
import { basicSetup } from "./ui/snippets_editor/extensions";
import { getVimSelectModeCommand, vimCommand, getVimVisualModeCommand, getVimEditorCommands, getVimRunMatrixEnterCommand } from "src/features/editor_commands";
import { getVimAdapter } from "src/utils/vim";
import {
	getSettingsSection,
	getSettingsSectionElementId,
	getSettingsSectionSelection,
	SETTINGS_SECTIONS,
	SettingsSectionDefinition,
} from "./settings_sections";


export class LatexSuiteSettingTab extends PluginSettingTab {
	plugin: LatexSuitePlugin;
	snippetsEditor: EditorView;
	snippetsFileLocEl: HTMLElement;
	snippetVariablesFileLocEl: HTMLElement;
	private readonly settingsSectionEls = new Map<string, HTMLElement>();
	private readonly settingsNavButtons = new Map<string, HTMLButtonElement>();
	private settingsNavEl?: HTMLElement;
	private settingsNavCleanup: (() => void)[] = [];

	constructor(app: App, plugin: LatexSuitePlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	hide() {
		this.snippetsEditor?.destroy();
		this.destroySettingsNavigator();
	}

	addHeading(
		containerEl: HTMLElement,
		section: SettingsSectionDefinition,
	) {
		const heading = new Setting(containerEl)
			.setName(section.heading)
			.setHeading();

		const parentEl = heading.settingEl;
		const iconEl = parentEl.createDiv();
		setIcon(iconEl, section.icon);
		iconEl.addClass("latex-suite-settings-icon");

		parentEl.prepend(iconEl);
		return parentEl;
	}

	private createSettingsSection(
		section: SettingsSectionDefinition,
	): HTMLElement {
		const sectionEl = this.containerEl.createEl("section", {
			cls: "latex-suite-rev-settings-section",
			attr: {
				id: getSettingsSectionElementId(section.id),
				"aria-labelledby": `latex-suite-rev-settings-nav-${section.id}`,
				"aria-hidden": "true",
			},
		});
		sectionEl.hidden = true;
		this.settingsSectionEls.set(section.id, sectionEl);
		this.addHeading(sectionEl, section);
		return sectionEl;
	}

	display(): void {
		const { containerEl } = this;
		this.destroySettingsNavigator();
		containerEl.empty();
		containerEl.addClass("latex-suite-settings");
		this.settingsSectionEls.clear();
		this.createSettingsNavigator();

		this.displaySnippetSettings();
		this.displayConcealSettings();
		this.displayColorHighlightBracketsSettings();
		this.displayPopupPreviewSettings();
		this.displayAutofractionSettings();
		this.displayMatrixShortcutsSettings();
		this.displayTaboutSettings();
		this.displayAutoEnlargeBracketsSettings();
		this.displayAdvancedSnippetSettings();
		this.activateSettingsSection(SETTINGS_SECTIONS[0].id);
	}

	private createSettingsNavigator(): void {
		const navEl = this.containerEl.createEl("nav", {
			cls: "latex-suite-rev-settings-nav",
			attr: { "aria-label": "Settings sections" },
		});
		const trackEl = navEl.createDiv(
			"latex-suite-rev-settings-nav-track",
		);

		this.settingsNavEl = navEl;
		this.settingsNavButtons.clear();

		for (const section of SETTINGS_SECTIONS) {
			const buttonEl = trackEl.createEl("button", {
				cls: "latex-suite-rev-settings-nav-item",
				attr: {
					id: `latex-suite-rev-settings-nav-${section.id}`,
					type: "button",
					"aria-controls": getSettingsSectionElementId(section.id),
				},
			});
			const iconEl = buttonEl.createSpan({
				cls: "latex-suite-rev-settings-nav-icon",
			});
			setIcon(iconEl, section.icon);
			buttonEl.createSpan({
				cls: "latex-suite-rev-settings-nav-label",
				text: section.label,
			});

			const activate = () => this.activateSettingsSection(section.id);
			buttonEl.addEventListener("click", activate);
			this.settingsNavCleanup.push(() =>
				buttonEl.removeEventListener("click", activate)
			);
			this.settingsNavButtons.set(section.id, buttonEl);
		}
	}

	private activateSettingsSection(sectionId: string): void {
		if (!this.settingsSectionEls.has(sectionId)) return;
		for (const [id, active] of getSettingsSectionSelection(sectionId)) {
			const section = getSettingsSection(id);
			const sectionEl = this.settingsSectionEls.get(section.id);
			if (!sectionEl) {
				throw new Error(`Settings section was not registered: ${section.id}`);
			}
			sectionEl.hidden = !active;
			sectionEl.setAttribute("aria-hidden", String(!active));

			const buttonEl = this.settingsNavButtons.get(section.id);
			if (!buttonEl) continue;
			buttonEl.classList.toggle("is-active", active);
			if (active) buttonEl.setAttribute("aria-current", "page");
			else buttonEl.removeAttribute("aria-current");
		}
		this.containerEl.scrollTop = 0;
	}

	private destroySettingsNavigator(): void {
		for (const cleanup of this.settingsNavCleanup.splice(0)) cleanup();
		this.settingsNavEl?.remove();
		this.settingsNavEl = undefined;
		this.settingsNavButtons.clear();
		this.settingsSectionEls.clear();
	}

	private displaySnippetSettings() {
		const containerEl = this.createSettingsSection(
			getSettingsSection("snippets"),
		);

		new Setting(containerEl)
			.setName("Enabled")
			.setDesc("Whether snippets are enabled.")
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.snippetsEnabled)
				.onChange(async (value) => {
					this.plugin.settings.snippetsEnabled = value;
					await this.plugin.saveSettings();
				}));


		const snippetsSetting = new Setting(containerEl)
			.setName("Snippets")
			.setDesc("Enter snippets here.  Remember to add a comma after each snippet, and escape all backslashes with an extra \\. Lines starting with \"//\" will be treated as comments and ignored.")
			.setClass("snippets-text-area");


		this.createSnippetsEditor(snippetsSetting);


		new Setting(containerEl)
			.setName("Load snippets from file or folder")
			.setDesc("Whether to load snippets from a specified file, or from all files within a folder (instead of from the plugin settings).")
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.loadSnippetsFromFile)
				.onChange(async (value) => {
					this.plugin.settings.loadSnippetsFromFile = value;

					snippetsSetting.settingEl.toggleClass("hidden", value);
					if (this.snippetsFileLocEl != undefined)
						this.snippetsFileLocEl.toggleClass("hidden", !value);

					await this.plugin.saveSettings();
				}));


		const snippetsFileLocDesc = new DocumentFragment();
		snippetsFileLocDesc.createDiv({}, div => {
			div.appendText("The file or folder to load snippets from. The file or folder must be within your vault, and not within a hidden folder (such as ");
			div.createEl("code", { text: `${this.app.vault.configDir}/` });
			div.appendText(").");
		});

		const snippetsFileLoc = new Setting(containerEl)
			.setName("Snippets file or folder location")
			.setDesc(snippetsFileLocDesc);

		let inputEl;
		snippetsFileLoc.addSearch(component => {
			component
				.setPlaceholder(DEFAULT_SETTINGS.snippetsFileLocation)
				.setValue(this.plugin.settings.snippetsFileLocation)
				.onChange(debounce(async (value) => {
					this.plugin.settings.snippetsFileLocation = value;
					await this.plugin.saveSettings(true);
				}, 500, true));

			inputEl = component.inputEl;
			inputEl.addClass("latex-suite-location-input-el");
			new FileSuggest(this.app, inputEl);
		});

		this.snippetsFileLocEl = snippetsFileLoc.settingEl;


		// Hide settings that are not relevant when "loadSnippetsFromFile" is set to true/false
		const loadSnippetsFromFile = this.plugin.settings.loadSnippetsFromFile;
		snippetsSetting.settingEl.toggleClass("hidden", loadSnippetsFromFile);
		this.snippetsFileLocEl.toggleClass("hidden", !loadSnippetsFromFile);


		this.createTriggerSetting(containerEl, "non-auto snippets", "snippetsTrigger");
		this.createTriggerSetting(containerEl, "next tabstop", "snippetNextTabstopTrigger")
		this.createTriggerSetting(containerEl, "previous tabstop", "snippetPreviousTabstopTrigger")
	}

	private displayConcealSettings() {
		const containerEl = this.createSettingsSection(
			getSettingsSection("conceal"),
		);

		const fragment = new DocumentFragment();
		fragment.createDiv({}, div => div.setText("Make equations more readable by hiding LaTeX syntax and instead displaying it in a pretty format."));
		fragment.createDiv({}, div => {
			div.appendText("For example, ");
			div.createEl("code", { text: "\\dot{x}^{2} + \\dot{y}^{2}" });
			div.appendText(" displays as ẋ² + ẏ², and ");
			div.createEl("code", { text: "\\sqrt{ 1-\\beta^{2} }" });
			div.appendText(" displays as √{ 1-β² }.");
		});
		fragment.createDiv({}, div => div.setText("LaTeX beneath the cursor will be revealed."));
		fragment.createEl("br");
		fragment.createDiv({}, div => div.setText("Disabled by default to not confuse new users. However, I recommend turning this on once you are comfortable with the plugin!"));

		new Setting(containerEl)
			.setName("Enabled")
			.setDesc(fragment)
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.concealEnabled)
				.onChange(async (value) => {
					this.plugin.settings.concealEnabled = value;
					await this.plugin.saveSettings();
				})
			);

		const fragment2 = new DocumentFragment();
		fragment2.createDiv({}, div => div.setText("How long to delay the reveal of LaTeX for, in milliseconds, when the cursor moves over LaTeX. Defaults to 0 (LaTeX under the cursor is revealed immediately)."));
		fragment2.createEl("br");
		fragment2.createDiv({}, div => div.setText("Can be set to a positive number, e.g. 300, to delay the reveal of LaTeX, making it much easier to navigate equations using arrow keys."));
		fragment2.createEl("br");
		fragment2.createDiv({}, div => div.setText("Must be an integer ≥ 0."));

		new Setting(containerEl)
			.setName("Reveal delay (ms)")
			.setDesc(fragment2)
			.addText(text => text
				.setPlaceholder(String(DEFAULT_SETTINGS.concealRevealTimeout))
				.setValue(String(this.plugin.settings.concealRevealTimeout))
				.onChange(value => {
					// Make sure the value is a non-negative integer
					const ok = /^\d+$/.test(value);
					if (ok) {
						this.plugin.settings.concealRevealTimeout = Number(value);
						void this.plugin.saveSettings();
					}
				})
			);

	}

	private displayColorHighlightBracketsSettings() {
		const containerEl = this.createSettingsSection(
			getSettingsSection("brackets"),
		);

		new Setting(containerEl)
			.setName("Color paired brackets")
			.setDesc("Whether to colorize matching brackets.")
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.colorPairedBracketsEnabled)
				.onChange(async (value) => {
					this.plugin.settings.colorPairedBracketsEnabled = value;
					await this.plugin.saveSettings();
				}));
		new Setting(containerEl)
			.setName("Highlight matching bracket beneath cursor")
			.setDesc("When the cursor is adjacent to a bracket, highlight the matching bracket.")
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.highlightCursorBracketsEnabled)
				.onChange(async (value) => {
					this.plugin.settings.highlightCursorBracketsEnabled = value;
					await this.plugin.saveSettings();
				}));
	}

	private displayPopupPreviewSettings() {
		const containerEl = this.createSettingsSection(
			getSettingsSection("preview"),
		);

		const popup_fragment = createFragment();
		const popup_line1 = createDiv();
		popup_line1.setText("When inside an equation, show a popup preview window of the rendered math.");
		const popup_space = createEl("br");
		const popup_line2 = createDiv();
		popup_line2.setText("The popup preview will be shown for all inline math equations, as well as for block math equations in Source mode.");
		popup_fragment.append(popup_line1, popup_space, popup_line2);

		const mathPreviewSetting = new Setting(containerEl)
			.setName("Enabled")
			.setDesc(popup_fragment)

		const positionSetting = new Setting(containerEl)
			.setName("Position")
			.setDesc("Where to display the popup preview relative to the equation source.")
			.addDropdown((dropdown) => dropdown
				.addOption("Above", "Above")
				.addOption("Below", "Below")
				.setValue(this.plugin.settings.mathPreviewPositionIsAbove ? "Above" : "Below")
				.onChange(async (value) => {
					this.plugin.settings.mathPreviewPositionIsAbove = (value === "Above");
					await this.plugin.saveSettings();
				})
			);
		const cursorSetting = new Setting(containerEl)
			.setName("Cursor symbol")
			.setDesc(`The symbol to use as the cursor in the popup preview such as ${DEFAULT_SETTINGS.mathPreviewCursor}. Leave it blank to turn it off.`)
			.addText(text => {
				text
					.setPlaceholder(DEFAULT_SETTINGS.mathPreviewCursor)
					.setValue(this.plugin.settings.mathPreviewCursor)
					.onChange(async (value) => {
						this.plugin.settings.mathPreviewCursor = value;
						await this.plugin.saveSettings();
					});

				const datalist = containerEl.createEl("datalist", {attr: { id: "math-preview-cursor-list" }});
				["▶", "┃", "|", "\\_", "{\\mid}", "{\\triangle}"].forEach(s => datalist.createEl("option", { value: s }));
				text.inputEl.setAttribute("list", "math-preview-cursor-list");
				return text;
			});
		
		const highlightSetting = new Setting(containerEl)
			.setName("Highlight brackets in preview")
			.setDesc("Whether to highlight the area within the nearest pair of brackets around the cursor in the popup preview.")
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.mathPreviewBracketHighlighting)
				.onChange(async (value) => {
					this.plugin.settings.mathPreviewBracketHighlighting = value;
					await this.plugin.saveSettings();
				}));
		const mathPreviewDependentSettings = [positionSetting, cursorSetting, highlightSetting];
		mathPreviewDependentSettings.forEach((setting) =>
			setting.settingEl.toggleClass(
				"hidden",
				!this.plugin.settings.mathPreviewEnabled,
			),
		);

		mathPreviewSetting.addToggle(toggle => 
			toggle
				.setValue(this.plugin.settings.mathPreviewEnabled)
				.onChange(async (value) => {
					this.plugin.settings.mathPreviewEnabled = value;
					mathPreviewDependentSettings.forEach((setting) =>
						setting.settingEl.toggleClass("hidden", !value),
					);
					await this.plugin.saveSettings();
				}));
	}

	private displayAutofractionSettings() {
		const containerEl = this.createSettingsSection(
			getSettingsSection("auto-fraction"),
		);

		new Setting(containerEl)
			.setName("Enabled")
			.setDesc("Whether auto-fraction is enabled.")
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.autofractionEnabled)
				.onChange(async (value) => {
					this.plugin.settings.autofractionEnabled = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName("Fraction symbol")
			.setDesc("The fraction symbol to use in the replacement. e.g. \\frac, \\dfrac, \\tfrac")
			.addText(text => {
				text
					.setPlaceholder(DEFAULT_SETTINGS.autofractionSymbol)
					.setValue(this.plugin.settings.autofractionSymbol)
					.onChange(async (value) => {
						this.plugin.settings.autofractionSymbol = value;

						await this.plugin.saveSettings();
					});

				const datalist = containerEl.createEl("datalist", { attr: { id: "autofraction-symbol-list" } });
				["\\frac", "\\dfrac", "\\tfrac"].forEach(s => datalist.createEl("option", { value: s }));
				text.inputEl.setAttribute("list", "autofraction-symbol-list");
			});


		new Setting(containerEl)
			.setName("Excluded environments")
			.setDesc("A list of environments to exclude auto-fraction from running in. For example, to exclude auto-fraction from running while inside an exponent, such as e^{...}, use  [\"^{\", \"}\"]")
			.addTextArea(text => text
				.setPlaceholder("[ [\"^{\", \"}] ]")
				.setValue(this.plugin.settings.autofractionExcludedEnvs)
				.onChange(async (value) => {
					this.plugin.settings.autofractionExcludedEnvs = value;
					await this.plugin.saveSettings();
				}));


		new Setting(containerEl)
			.setName("Breaking characters")
			.setDesc("A list of characters that denote the start/end of a fraction. e.g. if + is included in the list, \"a+b/c\" will expand to \"a+\\frac{b}{c}\". If + is not in the list, it will expand to \"\\frac{a+b}{c}\".")
			.addText(text => text
				.setPlaceholder(DEFAULT_SETTINGS.autofractionBreakingChars)
				.setValue(this.plugin.settings.autofractionBreakingChars)
				.onChange(async (value) => {
					this.plugin.settings.autofractionBreakingChars = value;

					await this.plugin.saveSettings();
				}));
	}

	private displayMatrixShortcutsSettings() {
		const containerEl = this.createSettingsSection(
			getSettingsSection("matrices"),
		);

		new Setting(containerEl)
			.setName("Enabled")
			.setDesc("Whether matrix shortcuts are enabled.")
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.matrixShortcutsEnabled)
				.onChange(async (value) => {
					this.plugin.settings.matrixShortcutsEnabled = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName("Environments")
			.setDesc("A list of environment names to run the matrix shortcuts in, separated by commas.")
			.addText(text => text
				.setPlaceholder(DEFAULT_SETTINGS.matrixShortcutsEnvNames)
				.setValue(this.plugin.settings.matrixShortcutsEnvNames)
				.onChange(async (value) => {
					this.plugin.settings.matrixShortcutsEnvNames = value;

					await this.plugin.saveSettings();
				}));

	}

	private displayTaboutSettings() {
		const containerEl = this.createSettingsSection(
			getSettingsSection("tabout"),
		);

		new Setting(containerEl)
			.setName("Enabled")
			.setDesc("Whether tabout is enabled.")
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.taboutEnabled)
				.onChange(async (value) => {
					this.plugin.settings.taboutEnabled = value;

					taboutClosingBracketsSetting.settingEl.toggleClass("hidden", !value);

					await this.plugin.saveSettings();
				}));
		this.createTriggerSetting(containerEl, "tabout", "taboutTrigger")
			
		const taboutClosingBracketsSetting =  new Setting(containerEl)
			.setName("Closing brackets")
			.setDesc("A list of closing brackets for tabout, separated by commas.")
			.addText(text => text
				.setPlaceholder(DEFAULT_SETTINGS.taboutClosingSymbols)
				.setValue(this.plugin.settings.taboutClosingSymbols)
				.onChange(async (value) => {
					this.plugin.settings.taboutClosingSymbols = value;

					await this.plugin.saveSettings();
				}));

		taboutClosingBracketsSetting.settingEl.toggleClass("hidden", !this.plugin.settings.taboutEnabled);
	}

	private displayAutoEnlargeBracketsSettings() {
		const containerEl = this.createSettingsSection(
			getSettingsSection("auto-enlarge"),
		);

		new Setting(containerEl)
			.setName("Enabled")
			.setDesc("Whether to automatically enlarge brackets containing e.g. sum, int, frac.")
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.autoEnlargeBrackets)
				.onChange(async (value) => {
					this.plugin.settings.autoEnlargeBrackets = value;
					await this.plugin.saveSettings();
				}));


		new Setting(containerEl)
			.setName("Triggers")
			.setDesc("A list of symbols that should trigger auto-enlarge brackets, separated by commas.")
			.addText(text => text
				.setPlaceholder(DEFAULT_SETTINGS.autoEnlargeBracketsTriggers)
				.setValue(this.plugin.settings.autoEnlargeBracketsTriggers)
				.onChange(async (value) => {
					this.plugin.settings.autoEnlargeBracketsTriggers = value;

					await this.plugin.saveSettings();
				}));
	}

	private displayAdvancedSnippetSettings() {
		const containerEl = this.createSettingsSection(
			getSettingsSection("advanced"),
		);

		const snippetVariablesSetting = new Setting(containerEl)
			.setName("Snippet variables")
			.setDesc("Assign snippet variables that can be used as shortcuts when writing snippets.")
			.addTextArea(text => text
				.setValue(this.plugin.settings.snippetVariables)
				.onChange(async (value) => {
					this.plugin.settings.snippetVariables = value;
					await this.plugin.saveSettings();
				})
				.setPlaceholder(DEFAULT_SETTINGS.snippetVariables))
			.setClass("latex-suite-snippet-variables-setting");

		new Setting(containerEl)
			.setName("Load snippet variables from file or folder")
			.setDesc("Whether to load snippet variables from a specified file, or from all files within a folder (instead of from the plugin settings).")
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.loadSnippetVariablesFromFile)
				.onChange(async (value) => {
					this.plugin.settings.loadSnippetVariablesFromFile = value;

					snippetVariablesSetting.settingEl.toggleClass("hidden", value);
					if (this.snippetVariablesFileLocEl != undefined)
						this.snippetVariablesFileLocEl.toggleClass("hidden", !value);

					await this.plugin.saveSettings();
				}));

		const snippetVariablesFileLocDesc = new DocumentFragment();
		snippetVariablesFileLocDesc.createDiv({}, (div) => {
			div.appendText("The file or folder to load snippet variables from. The file or folder must be within your vault, and not within a hidden folder (such as ");
			div.createEl("code", { text: `${this.app.vault.configDir}/` });
			div.appendText(").");
		});

		const snippetVariablesFileLoc = new Setting(containerEl)
			.setName("Snippet variables file or folder location")
			.setDesc(snippetVariablesFileLocDesc);


		snippetVariablesFileLoc.addSearch(component => {
			component
				.setPlaceholder(DEFAULT_SETTINGS.snippetVariablesFileLocation)
				.setValue(this.plugin.settings.snippetVariablesFileLocation)
				.onChange(debounce(async (value) => {
					this.plugin.settings.snippetVariablesFileLocation = value;
					await this.plugin.saveSettings(true);
				}, 500, true));

			const inputVariablesEl = component.inputEl;
			inputVariablesEl.addClass("latex-suite-location-input-el");
			new FileSuggest(this.app, inputVariablesEl);
		}
		);

		this.snippetVariablesFileLocEl = snippetVariablesFileLoc.settingEl;


		// Hide settings that are not relevant when "loadSnippetsFromFile" is set to true/false
		const loadSnippetVariablesFromFile = this.plugin.settings.loadSnippetVariablesFromFile;
		snippetVariablesSetting.settingEl.toggleClass("hidden", loadSnippetVariablesFromFile);
		this.snippetVariablesFileLocEl.toggleClass("hidden", !loadSnippetVariablesFromFile);

		new Setting(containerEl)
			.setName("Word delimiters")
			.setDesc("Symbols that will be treated as word delimiters, for use with the \"w\" snippet option.")
			.addText(text => text
				.setPlaceholder(DEFAULT_SETTINGS.wordDelimiters)
				.setValue(this.plugin.settings.wordDelimiters)
				.onChange(async (value) => {
					this.plugin.settings.wordDelimiters = value;

					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName("Remove trailing whitespaces in snippets in inline math")
			.setDesc("Whether to remove trailing whitespaces when expanding snippets at the end of inline math blocks.")
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.removeSnippetWhitespace)
				.onChange(async (value) => {
					this.plugin.settings.removeSnippetWhitespace = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
		.setName("Remove closing $ when backspacing inside blank inline math")
		.setDesc("Whether to also remove the closing $ when you delete the opening $ symbol inside blank inline math.")
		.addToggle((toggle) => toggle
			.setValue(this.plugin.settings.autoDelete$)
			.onChange(async (value) => {
				this.plugin.settings.autoDelete$ = value;
				await this.plugin.saveSettings();
			}));

		const suppressIMESetting = new Setting(containerEl)
			.setName("Don't trigger snippets when IME is active")
			.setDesc("Whether to suppress snippets triggering when an IME is active.");
		const suppressIMEWarning = new Setting(containerEl)
			.setName("Suppress IME warning")
			.setDesc("Whether a warning is shown on startup if `Don't trigger snippets when IME is active` is enabled. Disable that setting if you are aware of the IME limitations. Currently only ios and android touch/swipe keyboards like gboard have support for IME. See https://github.com/jqml/latex-suite-rev/blob/main/DOCS.md#IME-keyboards for more info.")
			.addToggle((toggle) => toggle
				.setValue(this.plugin.settings.suppressIMEWarning)
				.onChange(async (value) => {
					this.plugin.settings.suppressIMEWarning = value;
					await this.plugin.saveSettings();
				})
			);
		suppressIMEWarning.settingEl.toggleClass("hidden", !(this.plugin.settings.suppressSnippetTriggerOnIME && isIMESupported()));
		suppressIMESetting
			.addToggle((toggle) => toggle
				.setValue(this.plugin.settings.suppressSnippetTriggerOnIME)
				.onChange(async (value) => {
					this.plugin.settings.suppressSnippetTriggerOnIME = value;
					suppressIMEWarning.settingEl.toggleClass("hidden", !(value && isIMESupported()));
					await this.plugin.saveSettings();
				})
			);

		new Setting(containerEl)
			.setName("Code languages to interpret as math mode")
			.setDesc("Codeblock languages where the whole code block should be treated like a math block, separated by commas.")
			.addText(text => text
				.setPlaceholder(DEFAULT_SETTINGS.forceMathLanguages)
				.setValue(this.plugin.settings.forceMathLanguages)
				.onChange(async (value) => {
					this.plugin.settings.forceMathLanguages = value;

					await this.plugin.saveSettings();
				}));
		
		new Setting(containerEl)
			.setName("Snippet debug mode")
			.setDesc("Set the level of debug information to log about snippet expansion. Set to \"info\" or \"verbose\" to help identify issues with snippet syntax or why a snippet is not expanding. Verbose mode will log most information to the developer console on debug level.")
			.addDropdown((dropdown) => dropdown
				.addOption("off", "Off")
				.addOption("info", "Info")
				.addOption("verbose", "Verbose")
				.setValue(this.plugin.settings.snippetDebug)
				.onChange(async (value) => {
					this.plugin.settings.snippetDebug = value as "off" | "info" | "verbose";
					await this.plugin.saveSettings();
				})
			);
		//The toggle both hides the settings and makes the plugin not load the vim commands on startup.
		// the vim toggle is loaded before the rest since expanding down looks better.
		const vimEnabled: Setting = new Setting(containerEl)
			.setName("Vim key bindings")
			.setDesc("turn on/off vim keybindings. Note vim needs to be enabled in obsidian itself.")
		const vimSettings: Setting[] = [];
		const selectMode: Setting = new Setting(containerEl)
			.setName("Vim: Switch from visual mode to select mode")
			.setDesc(`maps the key to switch from visual mode to select mode.
				 Keymap must be a vim keymap and can't contain any spaces. Use empty string to disable this feature.
				  (select mode=insert keybindings)`)
			.addText((text) =>
				text.setPlaceholder(DEFAULT_SETTINGS.vimSelectMode)
				.setValue(this.plugin.settings.vimSelectMode)
				.onChange(async (value) => {
					const oldValue: string = this.plugin.settings.vimSelectMode;
				this.plugin.settings.vimSelectMode = value;
				await this.plugin.saveSettings();	
				const vimObject = getVimAdapter();
				if (!vimObject) return;
				const command: vimCommand = getVimSelectModeCommand(this.plugin.settings);
				vimObject[command.defineType](command.id, command.action);
				vimObject.mapCommand(command.key, command.type, command.id, {}, { context: command.context });
					// this unmaps the current keybinding and reverts to the previous keyMap. For example if oldValue = "<C-c>", then "<C-c>" goes back to "enter normal mode" in default settings.
				vimObject.unmap(oldValue, command.context);
				})
			);
		vimSettings.push(selectMode);
		const visualMode = new Setting(containerEl)
			.setName("Vim: Switch from select mode to visual mode")
			.setDesc(`maps the key to switch from select mode to visual mode. 
				 must be a vim keymap and can't contain any spaces. Example <C-g><C-A-i> = Ctrl-g + Ctrl-Alt-i.
				 Please check the vim keybinding first on another command like w before reporting it. Some keybindings like shift don't work due to the original vim plugin. Use empty string to disable this feature.
				  (select mode=insert keybindings)`)
			.addText((text) =>{
				text.setPlaceholder(DEFAULT_SETTINGS.vimVisualMode)
				.setValue(this.plugin.settings.vimVisualMode)
				.onChange(async (value) => {
					const oldvalue: string = this.plugin.settings.vimVisualMode;
					this.plugin.settings.vimVisualMode = value;
					await this.plugin.saveSettings();	
					const command: vimCommand = getVimVisualModeCommand(this.plugin.settings);
					const vimObject = getVimAdapter();
					if (!vimObject) return;
					vimObject[command.defineType](command.id, command.action);
					vimObject.mapCommand(command.key, command.type, command.id, {}, { context: command.context });
					// this unmaps the current keybinding and reverts to the previous keyMap. For example if oldValue = "<C-c>", then "<C-c>" goes back to "enter normal mode" in default settings.
					vimObject.unmap(oldvalue, command.context);
				})
			});
		vimSettings.push(visualMode);
		const matrixEnter: Setting = new Setting(containerEl)
			.setName("Vim: run matrix enter")
			.setDesc(`maps the key to the action of inserting a new line below while appending \\\\ to the current line in a matrix environment.
				 Use empty string to disable this feature.`)
			.addText((text) => {
				text.setPlaceholder(DEFAULT_SETTINGS.vimMatrixEnter)
				.setValue(this.plugin.settings.vimMatrixEnter)
				.onChange(async (value) => {
					const oldValue: string = this.plugin.settings.vimMatrixEnter;
					this.plugin.settings.vimMatrixEnter = value;
					await this.plugin.saveSettings();
					const vimObj = getVimAdapter();
					if (!vimObj) return;
					vimObj.unmap(oldValue, "normal");
					const command: vimCommand = getVimRunMatrixEnterCommand(this.plugin.settings);
					vimObj[command.defineType](command.id, command.action);
					vimObj.mapCommand(command.key, command.type, command.id, {}, { context: command.context });
					vimObj.unmap(oldValue, command.context)
				})
			});
		vimSettings.push(matrixEnter);
		// shows/hides the vim settings, since these settings are not needed if vim is not enabled.
		vimEnabled.addToggle((toggle) => {
			const vimOn = this.plugin.settings.vimEnabled;
			vimSettings.forEach(setting => setting.settingEl.toggleClass("hidden", !vimOn));
			toggle
				.setValue(this.plugin.settings.vimEnabled)
				.onChange(async (value) => {
					this.plugin.settings.vimEnabled = value;
					await this.plugin.saveSettings();
					vimSettings.forEach(setting => setting.settingEl.toggleClass("hidden", !value));
					const vimObject = getVimAdapter();
					if (!vimObject) return;
					for (const command of getVimEditorCommands(this.plugin.settings)) {
						vimObject.unmap(command.key, command.context);
				}
				});
		});
	}

	createSnippetsEditor(snippetsSetting: Setting) {
		const customCSSWrapper = snippetsSetting.controlEl.createDiv("snippets-editor-wrapper");
		const snippetsFooter = snippetsSetting.controlEl.createDiv("snippets-footer");
		const validity = snippetsFooter.createDiv("snippets-editor-validity");

		const validityIndicator = new ExtraButtonComponent(validity);
		validityIndicator.setIcon("checkmark")
			.extraSettingsEl.addClass("snippets-editor-validity-indicator");

		const validityText = validity.createDiv("snippets-editor-validity-text");
		validityText.addClass("setting-item-description");


		function updateValidityIndicator(success: boolean) {
			validityIndicator.setIcon(success ? "checkmark" : "cross");
			validityIndicator.extraSettingsEl.removeClass(success ? "invalid" : "valid");
			validityIndicator.extraSettingsEl.addClass(success ? "valid" : "invalid");
			validityText.setText(success ? "Saved" : "Invalid syntax. Changes not saved");
		}


		let validationGeneration = 0;
		const validateAndSave = debounce(async (
			snippets: string,
			generation: number,
		) => {
			let success = true;
			try {
				const snippetVariables = await parseSnippetVariables(
					this.plugin.settings.snippetVariables,
				);
				await parseSnippets(snippets, snippetVariables);
			}
			catch {
				success = false;
			}

			if (generation !== validationGeneration) return;
			updateValidityIndicator(success);
			if (!success) return;

			this.plugin.settings.snippets = snippets;
			await this.plugin.saveSettings();
		}, 300, true);

		const change = EditorView.updateListener.of((viewUpdate: ViewUpdate) => {
			if (!viewUpdate.docChanged) return;
			validationGeneration += 1;
			void validateAndSave(
				viewUpdate.state.doc.toString(),
				validationGeneration,
			);
		});

		const extensions = [...basicSetup, change];

		this.snippetsEditor = createCMEditor(this.plugin.settings.snippets, extensions);
		customCSSWrapper.appendChild(this.snippetsEditor.dom);


		const buttonsDiv = snippetsFooter.createDiv("snippets-editor-buttons");
		const reset = new ButtonComponent(buttonsDiv);
		reset.setIcon("switch")
			.setTooltip("Reset to default snippets")
				.onClick(() => {
					new ConfirmationModal(this.plugin.app,
						"Are you sure? This will delete any custom snippets you have written.",
						button => {
							button.setButtonText("Reset to default snippets");
							// Kept for compatibility below Obsidian 1.13.
							button.setWarning();
						},
					async () => {
						this.snippetsEditor.setState(EditorState.create({ doc: DEFAULT_SNIPPETS, extensions: extensions }));
						updateValidityIndicator(true);

						this.plugin.settings.snippets = DEFAULT_SNIPPETS;

						await this.plugin.saveSettings();
					}
				).open();
			});

		const remove = new ButtonComponent(buttonsDiv);
		remove.setIcon("trash")
			.setTooltip("Remove all snippets")
				.onClick(() => {
					new ConfirmationModal(this.plugin.app,
						"Are you sure? This will delete any custom snippets you have written.",
						button => {
							button.setButtonText("Remove all snippets");
							// Kept for compatibility below Obsidian 1.13.
							button.setWarning();
						},
					async () => {
						const value = `[

]`;
						this.snippetsEditor.setState(EditorState.create({ doc: value, extensions: extensions }));
						updateValidityIndicator(true);

						this.plugin.settings.snippets = value;
						await this.plugin.saveSettings();
					}
				).open();
			});
	}

	createTriggerSetting(containerEl: HTMLElement, name: string, settingName: keyof LatexSuiteCMKeymapSettings) {
		return new Setting(containerEl)
			.setName(`Key trigger for ${name}`)
			.setDesc(getTriggerHelpText(name))
			.addText((text) => text
				.setValue(this.plugin.settings[settingName] as string)
				.setPlaceholder(DEFAULT_SETTINGS[settingName])
				.onChange(async (value) => {
					parseKeyName(value);
					this.plugin.settings[settingName] = value;
					await this.plugin.saveSettings();
				})
			);
	}
}

class ConfirmationModal extends Modal {

	constructor(app: App, body: string, buttonCallback: (button: ButtonComponent) => void, clickCallback: () => Promise<void>) {
		super(app);

		this.contentEl.addClass("latex-suite-confirmation-modal");
		this.contentEl.createEl("p", { text: body });


		new Setting(this.contentEl)
			.addButton(button => {
				buttonCallback(button);
					button.onClick(() => {
						void clickCallback()
							.then(() => this.close())
							.catch((error) => {
								new Notice(`LaTeX Suite Rev could not save settings: ${error}`);
							});
					});
			})
			.addButton(button => button
				.setButtonText("Cancel")
				.onClick(() => this.close()));
	}
}

function createCMEditor(content: string, extensions: Extension[]) {
	const view = new EditorView({
		state: EditorState.create({ doc: content, extensions }),
	});

	return view;
}

/**
 * IME support is tricky, currently only a fix for mobile platform is provided, update later if needed.
 * @returns Whether IME keyboards are supported
 */
export function isIMESupported(): boolean {
	return Platform.isMobileApp
}
function getTriggerHelpText(name: string) {
	const fragment = new DocumentFragment();
	const div = fragment.createDiv();
	div.appendText(`What key to press to trigger ${name}. Should follow CodeMirror keymap syntax such as "Ctrl-k Ctrl-a". For more information, see the `);
	div.createEl("a", {
		text: "CodeMirror keymap documentation",
		href: "https://codemirror.net/docs/ref/#view.KeyBinding",
	});
	div.appendText(".");
	return fragment;
}
