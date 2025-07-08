import * as vscode from 'vscode';
import { TabLayoutSystem } from './TabLayout';

/**
 * @template LayoutSnapshotType
 */
export class TabLayoutTreeDataProvider<LayoutSnapshotType> implements vscode.TreeDataProvider<string> {
	public constructor(private readonly sys: TabLayoutSystem<LayoutSnapshotType>) {}

	// Update data
	private readonly onDidChangeTreeDataEmitter: vscode.EventEmitter<void> = new vscode.EventEmitter<void>();
	public readonly onDidChangeTreeData: vscode.Event<void> = this.onDidChangeTreeDataEmitter.event;
	public update(): void {
		this.onDidChangeTreeDataEmitter.fire();
	}

	public async getTreeItem(name: string): Promise<vscode.TreeItem> {
		const isActive = name === (await this.sys.getActiveLayoutName());

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
	public getChildren(element?: string): vscode.ProviderResult<string[]> {
		if (element === undefined) {
			return this.sys.listLayoutNames();
		} else {
			return [];
		}
	}
	public getParent?(_element: string): vscode.ProviderResult<string> {
		return undefined;
	}
	public resolveTreeItem?(
		item: vscode.TreeItem,
		_element: string,
		_token: vscode.CancellationToken
	): vscode.ProviderResult<vscode.TreeItem> {
		return item;
	}
}
