//! This script uninstalls the extension, and reinstalls current version.
import * as path from 'path';
import { spawn } from 'child_process';

(async () => {
	try {
		const EXT_ID = 'tab-layout';
		const CWD = path.join(__dirname, '../..');
		const EXT_PATH = path.join(CWD, `${EXT_ID}-temp.vsix`);

		// pack with vsce
		await execute('pnpm', ['vsce:package', '-o', EXT_PATH], CWD);

		try {
			await execute('code', ['--uninstall-extension', EXT_ID], CWD);
			await execute('code', ['--install-extension', EXT_PATH], CWD);
		} catch (e) {
			throw e;
		} finally {
			// remove packed extension
			if ((await execute('rm', [EXT_PATH], CWD)) === 0) {
				console.log(`Packaged extension ${EXT_PATH} removed`);
			} else {
				throw new Error(`Failed to remove packed extension`);
			}
		}
	} catch (error) {
		console.error(error);
	}
})();

async function execute(command: string, args: string[], cwd: string): Promise<number> {
	return await new Promise<number>((resolve, reject) => {
		const child = spawn(command, args, {
			cwd,
			stdio: 'inherit',
		});
		child.on('error', reject);
		child.on('exit', resolve);
	});
}
