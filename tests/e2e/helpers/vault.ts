import { readFile } from 'node:fs/promises';
import path from 'node:path';

export function getVaultDir() {
	const value = process.env.E2E_VAULT_DIR;

	if (!value) {
		throw new Error('Missing required environment variable: E2E_VAULT_DIR');
	}

	return path.resolve(value);
}

export async function readVaultFile(relativePath: string) {
	const filePath = path.join(getVaultDir(), relativePath);
	return readFile(filePath, 'utf8');
}
