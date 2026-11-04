import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import Module from 'module';
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

type IpcHandler = (event: unknown, ...args: unknown[]) => unknown;

const handlers = new Map<string, IpcHandler>();
const repoRoot = path.join(__dirname, '..', '..');

// gemini.js is plain CommonJS and stays that way for this pass (see Phase 3 plan
// notes). It directly require()s its already-converted-to-TypeScript siblings
// (storage, prompts, cloud, transportLogger), so their compiled .js output must
// exist on disk for this file to load at all — even though the global `pretest`
// script deletes that exact output so THEIR OWN tests exercise the .ts sources
// directly. Rebuild here, then delete the same files again afterward so the file
// system is back to pretest's expected clean state for every other test file.
// vitest.config.ts turns off file parallelism so this doesn't race those other tests.
const compiledSiblings = ['src/storage.js', 'src/utils/prompts.js', 'src/utils/transportLogger.js', 'src/utils/cloud.js', 'src/preload.js'];

let gemini: typeof import('../../src/utils/gemini.js');

beforeAll(async () => {
    execSync('npm run build', { cwd: repoRoot });

    // vi.mock('electron', ...) does not reliably intercept gemini.js's direct
    // require('electron'), so we patch Node's module loader directly, the same
    // technique confirmed working in a standalone verification script beforehand.
    const originalRequire = Module.prototype.require;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (Module.prototype as any).require = function (this: unknown, id: string, ...rest: unknown[]) {
        if (id === 'electron') {
            return {
                BrowserWindow: { getAllWindows: () => [] },
                ipcMain: {
                    handle: (channel: string, fn: IpcHandler) => {
                        handlers.set(channel, fn);
                    },
                },
            };
        }
        return originalRequire.apply(this, [id, ...rest] as [string]);
    };

    try {
        gemini = await import('../../src/utils/gemini.js');
    } finally {
        Module.prototype.require = originalRequire;
    }

    gemini.setupGeminiIpcHandlers({ current: null });
});

afterAll(() => {
    for (const file of compiledSiblings) {
        fs.rmSync(path.join(repoRoot, file), { force: true });
    }
});

describe('gemini.js IPC parameter validation', () => {
    it('rejects initialize-cloud with a non-string token', async () => {
        const result = await handlers.get('initialize-cloud')!({}, undefined, 'interview', '');
        expect(result).toBe(false);
    });

    it('rejects initialize-cloud with an empty token', async () => {
        const result = await handlers.get('initialize-cloud')!({}, '   ', 'interview', '');
        expect(result).toBe(false);
    });

    it('rejects initialize-gemini with a non-string apiKey', async () => {
        const result = await handlers.get('initialize-gemini')!({}, 12345, '', 'interview', 'en-US');
        expect(result).toBe(false);
    });

    it('rejects initialize-local with non-string model identifiers', async () => {
        const result = await handlers.get('initialize-local')!({}, null, { not: 'a string' }, 'interview', '');
        expect(result).toBe(false);
    });

    it('rejects send-audio-content with a non-string data field', async () => {
        const result = await handlers.get('send-audio-content')!({}, { data: 12345, mimeType: 'audio/pcm' });
        expect(result).toEqual({ success: false, error: 'Invalid audio payload' });
    });

    it('rejects send-audio-content with a missing payload entirely', async () => {
        const result = await handlers.get('send-audio-content')!({});
        expect(result).toEqual({ success: false, error: 'Invalid audio payload' });
    });

    it('rejects send-mic-audio-content with a non-string mimeType field', async () => {
        const result = await handlers.get('send-mic-audio-content')!({}, { data: 'abc', mimeType: 42 });
        expect(result).toEqual({ success: false, error: 'Invalid audio payload' });
    });

    it('rejects update-google-search-setting with a non-boolean value', async () => {
        const result = await handlers.get('update-google-search-setting')!({}, 'yes');
        expect(result).toEqual({ success: false, error: 'Invalid setting value' });
    });

    it('still accepts a well-formed update-google-search-setting payload', async () => {
        const result = await handlers.get('update-google-search-setting')!({}, true);
        expect(result).toEqual({ success: true });
    });
});
