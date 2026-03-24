import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const packageJsonPath = path.join(__dirname, '..', 'package.json');
const extensionJsonPath = path.join(__dirname, '..', 'gemini-extension.json');

const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
const version = packageJson.version;

console.log(`Source version (package.json): ${version}`);

let errors = [];

// 1. Check gemini-extension.json
const extensionJson = JSON.parse(fs.readFileSync(extensionJsonPath, 'utf8'));
if (extensionJson.version !== version) {
    errors.push(`gemini-extension.json version (${extensionJson.version}) does not match package.json (${version})`);
}

if (errors.length > 0) {
    console.error('Version check failed:');
    errors.forEach(err => console.error(`- ${err}`));
    process.exit(1);
} else {
    console.log('All version checks passed!');
}
