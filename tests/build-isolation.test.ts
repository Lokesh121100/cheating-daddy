import { describe, it, expect } from 'vitest';
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const repoRoot = path.join(__dirname, '..');
const compiledFiles = ['src/storage.js', 'src/utils/prompts.js', 'src/utils/transportLogger.js'];

describe('build output does not shadow TypeScript sources in tests', () => {
    it('pretest removes compiled .js that would otherwise shadow .ts sources', () => {
        execSync('npm run build', { cwd: repoRoot });
        for (const file of compiledFiles) {
            expect(fs.existsSync(path.join(repoRoot, file))).toBe(true);
        }

        execSync('npm run pretest', { cwd: repoRoot });
        for (const file of compiledFiles) {
            expect(fs.existsSync(path.join(repoRoot, file))).toBe(false);
        }
    });
});

describe('every Forge entry-point script builds before invoking electron-forge', () => {
    it('start, package, make, and publish all run the build first', () => {
        const pkg = JSON.parse(fs.readFileSync(path.join(repoRoot, 'package.json'), 'utf8'));
        for (const script of ['start', 'package', 'make', 'publish']) {
            expect(pkg.scripts[script]).toMatch(/^npm run build/);
        }
    });
});
