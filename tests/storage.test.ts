import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';

let tempDir: string;

beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cheating-daddy-config-test-'));
    process.env.CHEATING_DADDY_CONFIG_DIR = tempDir;
});

afterEach(() => {
    delete process.env.CHEATING_DADDY_CONFIG_DIR;
    fs.rmSync(tempDir, { recursive: true, force: true });
});

describe('storage', () => {
    it('initializes default config, credentials, and preferences on first run', async () => {
        const storage = await import('../src/storage.js');
        storage.initializeStorage();
        expect(storage.getConfig().configVersion).toBe(1);
        expect(storage.getApiKey()).toBe('');
        expect(storage.getPreferences().selectedProfile).toBe('interview');
    });

    it('round-trips a session through save/get/list/delete', async () => {
        const storage = await import('../src/storage.js');
        storage.initializeStorage();
        storage.saveSession('1700000000', { profile: 'interview', conversationHistory: [{ role: 'user', text: 'hi' }] });
        expect(storage.getSession('1700000000')?.profile).toBe('interview');
        expect(storage.getAllSessions()).toHaveLength(1);
        expect(storage.deleteSession('1700000000')).toBe(true);
        expect(storage.getAllSessions()).toHaveLength(0);
    });

    it('tracks today’s flash/flash-lite request counts independently', async () => {
        const storage = await import('../src/storage.js');
        storage.initializeStorage();
        storage.incrementLimitCount('gemini-2.5-flash');
        expect(storage.getTodayLimits().flash.count).toBe(1);
        expect(storage.getTodayLimits().flashLite.count).toBe(0);
    });
});
