import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import Module from 'module';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { buildCompiledSiblings, removeCompiledSiblings } from './helpers/compiledSiblings';

type IpcHandler = (event: unknown, ...args: unknown[]) => unknown;

const invokeHandlers = new Map<string, IpcHandler>();
const onHandlers = new Map<string, IpcHandler>();
let tempDir: string;

beforeAll(async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cheating-daddy-index-test-'));
    process.env.CHEATING_DADDY_CONFIG_DIR = tempDir;

    buildCompiledSiblings();

    const originalRequire = Module.prototype.require;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (Module.prototype as any).require = function (this: unknown, id: string, ...rest: unknown[]) {
        if (id === 'electron-squirrel-startup') {
            return false;
        }
        if (id === 'electron') {
            return {
                app: {
                    whenReady: () => Promise.resolve(),
                    on: () => {},
                    quit: () => {},
                    getVersion: () => '0.0.0-test',
                },
                BrowserWindow: { getAllWindows: () => [] },
                shell: { openExternal: async () => {} },
                ipcMain: {
                    handle: (channel: string, fn: IpcHandler) => invokeHandlers.set(channel, fn),
                    on: (channel: string, fn: IpcHandler) => onHandlers.set(channel, fn),
                },
                desktopCapturer: { getSources: async () => [] },
            };
        }
        if (id === './utils/window' || id === './utils/window.js') {
            return { createWindow: () => ({}), updateGlobalShortcuts: () => {} };
        }
        if (id === './utils/gemini' || id === './utils/gemini.js') {
            return { setupGeminiIpcHandlers: () => {}, stopMacOSAudioCapture: () => {}, sendToRenderer: () => {} };
        }
        return originalRequire.apply(this, [id, ...rest] as [string]);
    };

    try {
        require('../src/index.js');
    } finally {
        Module.prototype.require = originalRequire;
    }

    // app.whenReady().then(...) schedules its callback as a microtask; let it run
    // so setupStorageIpcHandlers/setupGeneralIpcHandlers actually register.
    await new Promise(resolve => setImmediate(resolve));
});

afterAll(() => {
    delete process.env.CHEATING_DADDY_CONFIG_DIR;
    fs.rmSync(tempDir, { recursive: true, force: true });
    removeCompiledSiblings();
});

describe('index.js open-external IPC validation', () => {
    it('rejects a file:// URL', async () => {
        const result = await invokeHandlers.get('open-external')!({}, 'file:///etc/passwd');
        expect(result).toEqual({ success: false, error: 'Only http(s) URLs may be opened' });
    });

    it('rejects a javascript: URL', async () => {
        const result = await invokeHandlers.get('open-external')!({}, 'javascript:alert(1)');
        expect(result).toEqual({ success: false, error: 'Only http(s) URLs may be opened' });
    });

    it('rejects a non-string URL', async () => {
        const result = await invokeHandlers.get('open-external')!({}, 12345);
        expect(result).toEqual({ success: false, error: 'Invalid URL' });
    });

    it('accepts a well-formed https URL', async () => {
        const result = await invokeHandlers.get('open-external')!({}, 'https://example.com');
        expect(result).toEqual({ success: true });
    });
});

describe('index.js session IPC path-traversal guard', () => {
    it('rejects a path-traversal sessionId on get-session', async () => {
        const result = await invokeHandlers.get('storage:get-session')!({}, '../../../../etc/passwd');
        expect(result).toEqual({ success: false, error: 'Invalid session ID' });
    });

    it('rejects a path-traversal sessionId on save-session', async () => {
        const result = await invokeHandlers.get('storage:save-session')!({}, '../../outside', { profile: 'x' });
        expect(result).toEqual({ success: false, error: 'Invalid session ID' });
    });

    it('rejects a path-traversal sessionId on delete-session', async () => {
        const result = await invokeHandlers.get('storage:delete-session')!({}, '../../outside');
        expect(result).toEqual({ success: false, error: 'Invalid session ID' });
    });

    it('accepts a well-formed numeric sessionId', async () => {
        const result = await invokeHandlers.get('storage:save-session')!({}, '1700000000', { profile: 'interview' });
        expect(result).toEqual({ success: true });
    });
});

describe('index.js config/preference key hardening', () => {
    it('rejects __proto__ as an update-config key', async () => {
        const result = await invokeHandlers.get('storage:update-config')!({}, '__proto__', { polluted: true });
        expect(result).toEqual({ success: false, error: 'Invalid config key' });
    });

    it('rejects a non-object set-config payload', async () => {
        const result = await invokeHandlers.get('storage:set-config')!({}, 'not an object');
        expect(result).toEqual({ success: false, error: 'Invalid config payload' });
    });

    it('still accepts a well-formed update-config call', async () => {
        const result = await invokeHandlers.get('storage:update-config')!({}, 'layout', 'compact');
        expect(result).toEqual({ success: true });
    });
});
