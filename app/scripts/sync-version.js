#!/usr/bin/env node

/**
 * Syncs package.json version with git tag
 * Falls back to "0.0.0-dev" if no tag is found
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

try {
  // Get version from git tag (strip leading 'v' if present)
  let version = execSync('git describe --tags --always', { encoding: 'utf8' }).trim();

  // Remove leading 'v' if present
  if (version.startsWith('v')) {
    version = version.substring(1);
  }

  console.log(`[sync-version] Git version: ${version}`);

  // Update package.json
  const packagePath = path.join(__dirname, '..', 'package.json');
  const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));

  packageJson.version = version;

  fs.writeFileSync(packagePath, JSON.stringify(packageJson, null, 2) + '\n');

  console.log(`[sync-version] Updated package.json to version: ${version}`);
} catch (error) {
  console.warn('[sync-version] Could not determine git version, using 0.0.0-dev');

  const packagePath = path.join(__dirname, '..', 'package.json');
  const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));

  packageJson.version = '0.0.0-dev';

  fs.writeFileSync(packagePath, JSON.stringify(packageJson, null, 2) + '\n');
}
