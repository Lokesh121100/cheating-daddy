import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const repoRoot = path.join(__dirname, '..', '..');

// Plain CommonJS files not yet converted to TypeScript (gemini.js, window.js, ...)
// require() their already-converted siblings directly, so those siblings' compiled
// .js output must exist on disk for the plain file to load at all. The global
// `pretest` script deletes that exact output so the already-converted files' OWN
// tests exercise their .ts sources directly, so a test that needs to load a
// not-yet-converted file must rebuild it here and clean up again afterward,
// restoring pretest's expected clean state for every other test file.
// vitest.config.ts turns off file parallelism so this never races those other tests.
const compiledSiblings = ['src/storage.js', 'src/utils/prompts.js', 'src/utils/transportLogger.js', 'src/utils/cloud.js', 'src/preload.js'];

export function buildCompiledSiblings(): void {
    execSync('npm run build', { cwd: repoRoot });
}

export function removeCompiledSiblings(): void {
    for (const file of compiledSiblings) {
        fs.rmSync(path.join(repoRoot, file), { force: true });
    }
}
