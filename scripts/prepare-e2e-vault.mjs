import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const fixtureVaultDir = path.join(repoRoot, 'tests', 'e2e', 'fixtures', 'vault');
const vaultDir = path.resolve(
	process.env.E2E_VAULT_DIR ?? path.join(repoRoot, '.e2e', 'vault')
);
const manifestPath = path.join(repoRoot, 'public', 'manifest.json');

function isSafeVaultDir(targetDir) {
	return (
		targetDir.includes(`${path.sep}.e2e${path.sep}`) ||
		targetDir.startsWith('/tmp/')
	);
}

async function ensurePluginSkeleton(targetDir) {
	const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
	const pluginDir = path.join(
		targetDir,
		'.obsidian',
		'plugins',
		manifest.id
	);

	await mkdir(pluginDir, { recursive: true });
	await writeFile(
		path.join(pluginDir, 'manifest.json'),
		JSON.stringify(manifest, null, 2)
	);
}

async function main() {
	if (!isSafeVaultDir(vaultDir)) {
		throw new Error(`Refusing to reset non-e2e vault directory: ${vaultDir}`);
	}

	await rm(vaultDir, { recursive: true, force: true });
	await mkdir(vaultDir, { recursive: true });
	await cp(fixtureVaultDir, vaultDir, { recursive: true });
	await ensurePluginSkeleton(vaultDir);

	console.log(`Prepared e2e vault at ${vaultDir}`);
}

main().catch((error) => {
	console.error(error);
	process.exitCode = 1;
});
