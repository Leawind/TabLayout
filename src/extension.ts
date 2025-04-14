import * as vscode from "vscode";

import * as CONSTS from './constants';
import { TabLayoutTreeDataProvider } from "./core/TabLayoutTreeDataProvider";
import { TabLayoutSystem } from "./core/TabLayout";
import { TabLayoutSystemImpl } from "./core/TabLayoutImpl";

class UserCanceledError extends Error { }

let onDeactivate: undefined | (() => void);

/**
 * Called when extension is activated
 * 
 * The extension is activated the very first time the command is executed
 */
export async function activate(ctx: vscode.ExtensionContext) {
	const { Lock, ThrottledAction } = await import('@leawind/inventory');

	////////////////////////////////////////////////////////////////
	// Pick implementation
	////////////////////////////////////////////////////////////////

	const system: TabLayoutSystem<any> = new TabLayoutSystemImpl(ctx);
	const lock = new Lock();

	async function checkAvailable(): Promise<boolean> {
		if (!await system.available()) {
			vscode.window.showErrorMessage("TabLayout is not available for current workspace!");
			return false;
		}
		return true;
	}

	/**
	 * @throws {UserCanceledError}
	 */
	async function pickNewLayoutName(): Promise<string> {
		let defaultName;
		{
			const names = await system.listLayoutNames();
			let i = 1;
			do {
				defaultName = `layout-${i++}`;
			} while (names.includes(defaultName));
		}

		let name = await vscode.window.showInputBox({
			title: 'New Layout',
			placeHolder: 'Layout Name',
			prompt: `Enter a name for the new layout, or leave it empty to use '${defaultName}'`,
			validateInput: async (value) => {
				if (await system.getLayout(value) !== undefined) {
					return 'Layout name already exists';
				}
				return null;
			}
		});
		if (name === undefined) {
			throw new UserCanceledError();
		}
		return name || defaultName;
	}

	////////////////////////////////////////////////////////////////
	// View
	////////////////////////////////////////////////////////////////
	const tabLayoutProvider = new TabLayoutTreeDataProvider(system);
	{
		vscode.window.registerTreeDataProvider('tab-layout', tabLayoutProvider);
		vscode.workspace.onDidCreateFiles(() => tabLayoutProvider.update());
		vscode.workspace.onDidDeleteFiles(() => tabLayoutProvider.update());
		vscode.workspace.onDidRenameFiles(() => tabLayoutProvider.update());
		system.onDidChangeLayouts(() => tabLayoutProvider.update());
		system.onDidChangeActiveLayout(() => tabLayoutProvider.update());
	}

	////////////////////////////////////////////////////////////////
	// Status Bar
	////////////////////////////////////////////////////////////////
	const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 128);
	async function updateStatusBarItem() {
		if (await system.available()) {
			const name = await system.getActiveLayoutName();
			const enabled = !!name;
			if (enabled) {
				statusBarItem.text = `$(tab-layout) ${name}`;
				statusBarItem.tooltip = `Current Layout: ${name}`;
			} else {
				statusBarItem.text = `$(tab-layout) <None>`;
				statusBarItem.tooltip = `Tab Layout is disabled.`;
			}
			statusBarItem.show();
		} else {
			statusBarItem.hide();
		}
	}
	{
		statusBarItem.command = CONSTS.COMMAND_FOCUS;
		statusBarItem.text = "Tab Layout";
		ctx.subscriptions.push(statusBarItem);

		system.onDidChangeActiveLayout(updateStatusBarItem);
		updateStatusBarItem();
	}

	////////////////////////////////////////////////////////////////
	// Commands
	////////////////////////////////////////////////////////////////
	{
		const commands: Record<string, (...args: any[]) => any> = {
			[CONSTS.COMMAND_NEW]: async () => {
				const name = await pickNewLayoutName();
				const snapshot = await system.takeLayoutSnapshot();
				await system.setLayout(name, snapshot);
				await system.setActiveLayoutName(name);
			},
			[CONSTS.COMMAND_LOAD]: async (name: string) => {
				if (typeof name !== 'string') {
					return;
				}
				const snapshot = await system.getLayout(name);
				if (snapshot) {
					await system.setActiveLayoutName(undefined);
					await system.restoreLayout(snapshot);
					await system.setActiveLayoutName(name);
				} else {
					vscode.window.showErrorMessage(`Failed to load layout ${name}`);
				}
			},
			[CONSTS.COMMAND_SAVE_AS]: async (name: string) => {
				if (typeof name !== 'string') {
					return;
				}
				const snapshot = await system.takeLayoutSnapshot();
				await system.setLayout(name, snapshot);
				await system.setActiveLayoutName(name);
			},
			[CONSTS.COMMAND_DELETE]: async (name: string) => {
				if (typeof name !== 'string') {
					return;
				}
				await system.deleteLayout(name);
			},
			[CONSTS.COMMAND_RENAME]: async (oldName: string, newName?: string) => {
				if (typeof oldName !== 'string') {
					return;
				}
				const isActive = await system.getActiveLayoutName() === oldName;
				newName ||= await pickNewLayoutName();
				await system.renameLayout(oldName, newName);
				if (isActive) {
					await system.setActiveLayoutName(newName);
				}
			},
			[CONSTS.COMMAND_DISABLE]: async () => {
				await system.setActiveLayoutName(undefined);
			},
		};
		for (const [commandId, command] of Object.entries(commands)) {
			const atomicCommand = async (...args: any[]) => {
				if (await checkAvailable()) {
					try {
						await lock.acquire(commandId);
						console.log(`Command: ${commandId} (${args.join(', ')})`);
						await command(...args);
					} catch (e) {
						if (e instanceof UserCanceledError) {
							console.log('Command canceled by user');
						} else {
							console.trace(e);
						}
					} finally {
						lock.release();
					}
				}
			};
			ctx.subscriptions.push(vscode.commands.registerCommand(commandId, atomicCommand));
		}
	}

	////////////////////////////////////////////////////////////////
	// Events
	////////////////////////////////////////////////////////////////
	{
		// Save layout when editors change

		const saveAction = new ThrottledAction(async () => {
			const name = await system.getActiveLayoutName();
			if (name) {
				await vscode.commands.executeCommand(CONSTS.COMMAND_SAVE_AS, name);
			}
		}, 5000);

		async function onChange() {
			if (await system.available()) {
				if (lock.getOwner() !== CONSTS.COMMAND_LOAD) {
					saveAction.urge();
				}
			}
		}

		vscode.window.onDidChangeVisibleTextEditors(onChange);
		vscode.window.onDidChangeTextEditorVisibleRanges(onChange);
		vscode.window.onDidChangeTextEditorViewColumn(onChange);
		onDeactivate = () => saveAction.executeImmediately();
	}
	{
		// Update when clause context

		vscode.commands.executeCommand('setContext', CONSTS.WHEN_AVAILABLE, await system.available());
		vscode.workspace.onDidChangeWorkspaceFolders(async () => vscode.commands.executeCommand('setContext', CONSTS.WHEN_AVAILABLE, await system.available()));

		vscode.commands.executeCommand('setContext', CONSTS.WHEN_ENABLED, await system.enabled());
		system.onDidChangeActiveLayout(async (name) => vscode.commands.executeCommand('setContext', CONSTS.WHEN_ENABLED, !!name));
	}
}

/**
 * Called when extension is deactivated
 */
export function deactivate() {
	if (onDeactivate !== undefined) {
		onDeactivate();
	}
}
