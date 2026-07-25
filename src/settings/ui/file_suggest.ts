import { AbstractInputSuggest, App, TAbstractFile, Vault } from "obsidian";

export class FileSuggest extends AbstractInputSuggest<TAbstractFile> {
	private readonly inputEl: HTMLInputElement;
	private readonly vault: Vault;

	constructor(app: App, inputEl: HTMLInputElement) {
		super(app, inputEl);
		this.inputEl = inputEl;
		this.vault = app.vault;
	}

	protected getSuggestions(inputStr: string): TAbstractFile[] {

		const files: TAbstractFile[] = [];
		const lowerCaseInputStr = inputStr.toLowerCase();

		Vault.recurseChildren(this.vault.getRoot(), (file) => {
			if (file.path.toLowerCase().contains(lowerCaseInputStr)) {
				files.push(file);
			}
		});

		return files;
	}

	renderSuggestion(file: TAbstractFile, el: HTMLElement): void {
		el.setText(file.path);
	}

	selectSuggestion(file: TAbstractFile): void {
		this.setValue(file.path);
		this.inputEl.trigger("input");
		this.close();
	}
}
