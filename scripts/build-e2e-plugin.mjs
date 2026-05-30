import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const vaultDir = path.resolve(
	process.env.E2E_VAULT_DIR ?? path.join(repoRoot, '.e2e', 'vault')
);

const command = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';
const child = spawn(command, ['build:vite'], {
	cwd: repoRoot,
	stdio: 'inherit',
	env: {
		...process.env,
		OBSIDIAN_PATH: vaultDir,
	},
});

child.on('exit', (code) => {
	process.exit(code ?? 1);
});
