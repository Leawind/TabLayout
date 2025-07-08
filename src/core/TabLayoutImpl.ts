import * as vscode from 'vscode';

import { SortMethod, TabLayoutSystem } from './TabLayout';
import * as CONSTS from '../constants';

enum GroupOrientation {
	HORIZONTAL,
	VERTICAL,
}

interface GroupLayoutArgument {
	/**
	 * Only applies when there are multiple groups
	 * arranged next to each other in a row or column.
	 * If provided, their sum must be 1 to be applied
	 * per row or column.
	 */
	readonly size?: number;

	/**
	 * Editor groups  will be laid out orthogonal to the
	 * parent orientation.
	 */
	readonly groups?: GroupLayoutArgument[];
}
interface EditorGroupLayout {
	/**
	 * The initial orientation of the editor groups at the root.
	 */
	readonly orientation: GroupOrientation;

	/**
	 * The editor groups at the root of the layout.
	 */
	readonly groups: GroupLayoutArgument[];
}

type TabInputSnapshot =
	| {
			type: 'TabInputText';
			uri: string;
			relativePath?: string;
	  }
	| {
			type: 'TabInputTextDiff';
			original: string;
			originalRelativePath?: string;
			modified: string;
			modifiedRelativePath?: string;
	  }
	| {
			type: 'TabInputCustom';
			uri: string;
			relativePath?: string;
			viewType: string;
	  }
	| {
			type: 'TabInputWebview';
			viewType: string;
	  }
	| {
			type: 'TabInputNotebook';
			uri: string;
			relativePath?: string;
			notebookType: string;
	  }
	| {
			type: 'TabInputNotebookDiff';
			original: string;
			originalRelativePath?: string;
			modified: string;
			modifiedRelativePath?: string;
			notebookType: string;
	  }
	| {
			type: 'TabInputTerminal';
	  }
	| {
			type: 'unknown';
	  };

type TabSnapshot = {
	input: TabInputSnapshot;
	isPinned: boolean;
	isPreview: boolean;
};

type TabGroupSnapshot = {
	viewColumn: vscode.ViewColumn;
	activeTabIndex: number | undefined;
	/**
	 * @see vscode.TabGroup.tabs
	 * @see vscode.Tab
	 */
	tabs: TabSnapshot[];
};

export type LayoutSnapshot = {
	timestamp: number;

	/**
	 * @see vscode.window.tabGroups.all
	 * @see vscode.TabGroup
	 */
	tabGroups: TabGroupSnapshot[];

	/**
	 * @see [vscode.getEditorLayout](https://github.com/microsoft/vscode/blob/550fe4269b36c04b34b848dc796abf325a4772ab/src/vs/workbench/browser/parts/editor/editorCommands.ts#L378)
	 * @see [vscode.setEditorLayout](https://github.com/microsoft/vscode/blob/550fe4269b36c04b34b848dc796abf325a4772ab/src/vs/workbench/browser/parts/editor/editorCommands.ts#L341)
	 */
	editorLayout: EditorGroupLayout;
};

export class TabLayoutSystemImpl extends TabLayoutSystem<LayoutSnapshot> {
	public constructor(
		private readonly ctx: vscode.ExtensionContext,
		public folder?: vscode.WorkspaceFolder,
		public sortBy: SortMethod = SortMethod.RECENT
	) {
		super();

		vscode.workspace.onDidChangeWorkspaceFolders(() => {
			if (vscode.workspace.workspaceFolders) {
				this.folder = vscode.workspace.workspaceFolders[0];
			}
		});
		if (vscode.workspace.workspaceFolders) {
			this.folder = vscode.workspace.workspaceFolders[0];
		}
	}

	private getLayoutUri(name: string): vscode.Uri {
		const layoutsDir = vscode.Uri.joinPath(this.folder!.uri, CONSTS.LAYOUTS_DIR);
		return vscode.Uri.joinPath(layoutsDir, `${name}.json`);
	}

	public async available(): Promise<boolean> {
		return vscode.workspace.workspaceFolders?.length === 1;
	}

	public async getActiveLayoutName(): Promise<string | undefined> {
		let name = this.ctx.workspaceState.get(CONSTS.STATE_KEY_ACTIVE_LAYOUT) as string;
		if (name) {
			if (!(await this.hasLayout(name))) {
				console.warn(`Active layout '${name}' does not exist!`);
				this.ctx.workspaceState.update(CONSTS.STATE_KEY_ACTIVE_LAYOUT, undefined);
				return undefined;
			}
		}
		return name;
	}
	public async setActiveLayoutName(name?: string): Promise<void> {
		const old = this.ctx.workspaceState.get(CONSTS.STATE_KEY_ACTIVE_LAYOUT);
		if (old !== name) {
			this.ctx.workspaceState.update(CONSTS.STATE_KEY_ACTIVE_LAYOUT, name);
			this.onDidChangeActiveLayoutEmitter.fire(name);
		}
		if (!this.hasLayout(name)) {
			console.warn(`Set active layout to ${name}, but it does not exist!`);
		}
	}
	public async takeLayoutSnapshot(): Promise<LayoutSnapshot> {
		return {
			timestamp: Date.now(),
			tabGroups: vscode.window.tabGroups.all.map((group) => ({
				viewColumn: group.viewColumn,
				activeTabIndex: group.activeTab ? group.tabs.indexOf(group.activeTab) : undefined,
				tabs: group.tabs.map((tab) => {
					let input: TabInputSnapshot;
					if (tab.input instanceof vscode.TabInputText) {
						input = {
							type: 'TabInputText',
							uri: tab.input.uri.toString(),
							relativePath: vscode.workspace.asRelativePath(tab.input.uri),
						};
					} else if (tab.input instanceof vscode.TabInputTextDiff) {
						input = {
							type: 'TabInputTextDiff',
							original: tab.input.original.toString(),
							originalRelativePath: vscode.workspace.asRelativePath(tab.input.original),
							modified: tab.input.modified.toString(),
							modifiedRelativePath: vscode.workspace.asRelativePath(tab.input.modified),
						};
					} else if (tab.input instanceof vscode.TabInputCustom) {
						input = {
							type: 'TabInputCustom',
							uri: tab.input.uri.toString(),
							relativePath: vscode.workspace.asRelativePath(tab.input.uri),
							viewType: tab.input.viewType,
						};
					} else if (tab.input instanceof vscode.TabInputWebview) {
						input = {
							type: 'TabInputWebview',
							viewType: tab.input.viewType,
						};
					} else if (tab.input instanceof vscode.TabInputNotebook) {
						input = {
							type: 'TabInputNotebook',
							uri: tab.input.uri.toString(),
							relativePath: vscode.workspace.asRelativePath(tab.input.uri),
							notebookType: tab.input.notebookType,
						};
					} else if (tab.input instanceof vscode.TabInputNotebookDiff) {
						input = {
							type: 'TabInputNotebookDiff',
							original: tab.input.original.toString(),
							originalRelativePath: vscode.workspace.asRelativePath(tab.input.original),
							modified: tab.input.modified.toString(),
							modifiedRelativePath: vscode.workspace.asRelativePath(tab.input.modified),
							notebookType: tab.input.notebookType,
						};
					} else if (tab.input instanceof vscode.TabInputTerminal) {
						input = {
							type: 'TabInputTerminal',
						};
					} else {
						input = { type: 'unknown' };
					}

					return {
						input,
						isPinned: tab.isPinned,
						isPreview: tab.isPreview,
					};
				}),
			})),
			editorLayout: (await vscode.commands.executeCommand('vscode.getEditorLayout')) as EditorGroupLayout,
		};
	}
	public async restoreLayout(layout: LayoutSnapshot): Promise<void> {
		await vscode.commands.executeCommand('workbench.action.closeAllEditors');
		await vscode.commands.executeCommand('vscode.setEditorLayout', layout.editorLayout);

		const promises: Promise<void>[] = [];
		for (const group of layout.tabGroups) {
			let activeTab: TabSnapshot | undefined;
			if (group.activeTabIndex) {
				activeTab = Array.from(group.tabs).splice(group.activeTabIndex, 1)[0];
			}
			for (const tab of group.tabs) {
				try {
					promises.push(this.openTab(tab, group.viewColumn));
				} catch (e) {
					console.warn(`Failed to load tab: "${e}"`);
				}
			}
			if (activeTab) {
				promises.push(this.openTab(activeTab, group.viewColumn));
			}
		}
		await Promise.allSettled(promises);
	}

	private async openTab(tab: TabSnapshot, viewColumn: vscode.ViewColumn): Promise<void> {
		switch (tab.input.type) {
			case 'TabInputText': {
				let uri: vscode.Uri;
				if (tab.input.relativePath) {
					uri = vscode.Uri.joinPath(this.folder!.uri, tab.input.relativePath);
				} else {
					uri = vscode.Uri.parse(tab.input.uri);
				}
				const document = await vscode.workspace.openTextDocument(uri);
				await vscode.window.showTextDocument(document, {
					viewColumn,
					preview: tab.isPreview,
					preserveFocus: true,
				});
				break;
			}
			default:
				console.log(`Unsupported input type of tab: '${tab.input.type}'`);
		}
	}

	public async listLayoutNames(sort: boolean = false): Promise<string[]> {
		const layoutsDir = vscode.Uri.joinPath(this.folder!.uri, CONSTS.LAYOUTS_DIR);
		try {
			const names = (await vscode.workspace.fs.readDirectory(layoutsDir))
				.filter(([fileName, type]) => /^(.+)\.json$/.test(fileName) && type === vscode.FileType.File)
				.map(([fileName, _]) => /^(.+)\.json$/.exec(fileName)![1]);

			if (!sort) {
				return names;
			}

			switch (this.sortBy) {
				case SortMethod.NAME: {
					return names.sort((a, b) => a.localeCompare(b));
				}
				case SortMethod.RECENT: {
					const decoder = new TextDecoder();
					const name_time = await Promise.all(
						names.map(async (name) => {
							const uri = this.getLayoutUri(name);
							try {
								const content = await vscode.workspace.fs.readFile(uri);
								const json = decoder.decode(content);
								const timestamp = JSON.parse(json).timestamp ?? 0;
								return [name, timestamp] as const;
							} catch (e) {
								return [name, 0] as const;
							}
						})
					);
					return name_time.sort((a, b) => b[1] - a[1]).map(([name, _]) => name);
				}
			}
		} catch (e) {
			return [];
		}
	}

	public async hasLayout(name?: string): Promise<boolean> {
		if (!name) {
			return false;
		}
		const layoutUri = this.getLayoutUri(name);
		try {
			await vscode.workspace.fs.stat(layoutUri);
			return true;
		} catch (error) {
			return false;
		}
	}

	public async getLayout(name: string): Promise<LayoutSnapshot | undefined> {
		const layoutUri = this.getLayoutUri(name);
		try {
			const layoutContent = await vscode.workspace.fs.readFile(layoutUri);
			return JSON.parse(layoutContent.toString()) as LayoutSnapshot;
		} catch (error) {
			return undefined;
		}
	}
	public async setLayout(name: string, layout: LayoutSnapshot): Promise<void> {
		const layoutsDir = vscode.Uri.joinPath(this.folder!.uri, CONSTS.LAYOUTS_DIR);
		const layoutUri = vscode.Uri.joinPath(layoutsDir, `${name}.json`);
		// Ensure the directory exists
		await vscode.workspace.fs.createDirectory(layoutsDir);
		// Write the layout to the file
		await vscode.workspace.fs.writeFile(layoutUri, Buffer.from(JSON.stringify(layout, null, '\t')));

		this.onDidChangeLayoutsEmitter.fire();
	}

	async deleteLayout(name: string): Promise<boolean> {
		const layoutUri = this.getLayoutUri(name);
		try {
			const oldActiveName = await this.getActiveLayoutName();
			if (oldActiveName === name) {
				this.setActiveLayoutName(undefined);
			}

			await vscode.workspace.fs.stat(layoutUri);
			await vscode.workspace.fs.delete(layoutUri);

			this.onDidChangeLayoutsEmitter.fire();
			return true;
		} catch (error) {
			console.error(`Error deleting layout ${name}:`, error);
			return false;
		}
	}

	async renameLayout(name: string, newName: string): Promise<void> {
		if (newName !== name) {
			const uri = this.getLayoutUri(name);
			const newUri = this.getLayoutUri(newName);
			await vscode.workspace.fs.rename(uri, newUri);

			this.onDidChangeLayoutsEmitter.fire();

			if ((await this.getActiveLayoutName()) === name) {
				await this.setActiveLayoutName(newName);
			}
		}
	}
}
