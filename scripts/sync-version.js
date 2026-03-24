import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const packageJsonPath = path.join(__dirname, '..', 'package.json');
const extensionJsonPath = path.join(__dirname, '..', 'gemini-extension.json');

const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
const version = packageJson.version;

console.log(`Syncing version to: ${version}`);

// 1. Sync gemini-extension.json
const extensionJson = JSON.parse(fs.readFileSync(extensionJsonPath, 'utf8'));
if (extensionJson.version !== version) {
    console.log(`Updating gemini-extension.json to ${version}`);
    extensionJson.version = version;
    fs.writeFileSync(extensionJsonPath, JSON.stringify(extensionJson, null, 2) + '\n');
}

console.log(`Sync complete! gemini-extension.json is now at v${version}.`);
