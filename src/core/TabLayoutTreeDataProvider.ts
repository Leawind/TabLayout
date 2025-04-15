import * as vscode from "vscode";
import { TabLayoutSystem } from "./TabLayout";

/**
 * @template LayoutSnapshotType 
 */
export class TabLayoutTreeDataProvider<LayoutSnapshotType> implements vscode.TreeDataProvider<string> {

	constructor(
		private readonly sys: TabLayoutSystem<LayoutSnapshotType>
	) {
	}

	// Update data
	private _onDidChangeTreeData: vscode.EventEmitter<string | undefined | null | void> = new vscode.EventEmitter<string | undefined | null | void>();
	public onDidChangeTreeData?: vscode.Event<string | void | string[] | null | undefined> | undefined = this._onDidChangeTreeData.event;
	update(): void {
		this._onDidChangeTreeData.fire();
	}

	public async getTreeItem(name: string): Promise<vscode.TreeItem> {
		const isActive = name === await this.sys.getActiveLayoutName();

		const iconPath = new vscode.ThemeIcon(isActive ? 'tab-layout' : 'tab-layout-inactive');
		// const iconPath = new vscode.ThemeIcon(isActive ? 'circle-filled' : 'circle-outline');

		return {
			label: name,
			id: name,
			iconPath,
			collapsibleState: vscode.TreeItemCollapsibleState.None,
			contextValue: isActive ? 'active' : 'inactive',
		};
	}
	public getChildren(element?: string | undefined): vscode.ProviderResult<string[]> {
		if (element === undefined) {
			return this.sys.listLayoutNames();
		} else {
			return [];
		}
	}
	public getParent?(_element: string): vscode.ProviderResult<string> {
		return undefined;
	}
	public resolveTreeItem?(item: vscode.TreeItem, _element: string, _token: vscode.CancellationToken): vscode.ProviderResult<vscode.TreeItem> {
		return item;
	}
}
