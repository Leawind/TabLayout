import * as vscode from 'vscode';

/**
 * @template LayoutSnapshotType Type of layout
 */
export abstract class TabLayoutSystem<LayoutSnapshotType> {
	protected readonly onDidChangeActiveLayoutEmitter = new vscode.EventEmitter<string | undefined>();
	public readonly onDidChangeActiveLayout: vscode.Event<string | undefined> =
		this.onDidChangeActiveLayoutEmitter.event;

	protected readonly onDidChangeLayoutsEmitter = new vscode.EventEmitter<void>();
	public readonly onDidChangeLayouts: vscode.Event<void> = this.onDidChangeLayoutsEmitter.event;

	/**
	 * Is this extension available for current window?
	 */
	public abstract available(): Promise<boolean>;

	/**
	 * Take a snapshot of current layout using vscode api
	 */
	public abstract takeLayoutSnapshot(): Promise<LayoutSnapshotType>;

	/**
	 * Set to given layout snapshot using vscode api
	 */
	public abstract restoreLayout(layout: LayoutSnapshotType): Promise<void>;

	/**
	 * Get name of active layout
	 *
	 * @returns name of active layout, or `undefined` if no layout is active
	 */
	public abstract getActiveLayoutName(): Promise<string | undefined>;

	public async enabled(): Promise<boolean> {
		return !!(await this.getActiveLayoutName());
	}

	/**
	 * Set active layout to given name
	 *
	 * @param name name of layout to set, or `undefined` to clear active layout
	 */
	public abstract setActiveLayoutName(name?: string): Promise<void>;

	/**
	 * List all layout names in current workspace
	 */
	public abstract listLayoutNames(): Promise<string[]>;

	/**
	 * Check if layout with given name exists
	 */
	public abstract hasLayout(name: string): Promise<boolean>;

	/**
	 * Load layout with given name
	 */
	public abstract getLayout(name: string): Promise<LayoutSnapshotType | undefined>;

	/**
	 * Save layout with given name
	 */
	public abstract setLayout(name: string, layout: LayoutSnapshotType): Promise<void>;

	/**
	 * @returns `true` if layout with given name was deleted, `false` if layout with given name does not exist
	 */
	public abstract deleteLayout(name: string): Promise<boolean>;

	/**
	 * Rename layout with given name
	 */
	public abstract renameLayout(name: string, newName: string): Promise<void>;
}
