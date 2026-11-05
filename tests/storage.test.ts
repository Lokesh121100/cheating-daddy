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
        storage.saveSession('1700000000', {
            profile: 'interview',
            conversationHistory: [{ timestamp: Date.now(), transcription: 'hi', ai_response: 'hello' }],
        });
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

    it('ignores CHEATING_DADDY_CONFIG_DIR outside of a test run', async () => {
        const originalVitestFlag = process.env.VITEST;
        delete process.env.VITEST;
        try {
            const storage = await import('../src/storage.js');
            expect(storage.getConfigDir()).not.toBe(tempDir);
        } finally {
            process.env.VITEST = originalVitestFlag;
        }
    });

    it('treats a model with no configured limit as exhausted, not as always available', async () => {
        const storage = await import('../src/storage.js');
        storage.initializeStorage();
        const todayLimits = storage.getTodayLimits();
        delete todayLimits.groq!['gpt-oss-120b'].limit;
        storage.setLimits({ data: [todayLimits] });
        expect(storage.getModelForToday()).not.toBe('openai/gpt-oss-120b');
    });
});
