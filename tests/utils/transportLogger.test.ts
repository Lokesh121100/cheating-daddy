import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';

let tempDir: string;

beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cheating-daddy-transport-test-'));
    process.env.CHEATING_DADDY_CONFIG_DIR = tempDir;
});

afterEach(() => {
    delete process.env.CHEATING_DADDY_CONFIG_DIR;
    fs.rmSync(tempDir, { recursive: true, force: true });
});

describe('transportLogger', () => {
    it('writes a parseable JSON array log with a session.started event', async () => {
        const { startTransportLog, closeTransportLog } = await import('../../src/utils/transportLogger.js');
        startTransportLog('test-session');
        closeTransportLog();
        const logPath = path.join(tempDir, 'logs', 'test-session.json');
        // The write stream flushes asynchronously; wait for the file to actually land before reading it.
        await vi.waitFor(() => {
            if (!fs.existsSync(logPath)) throw new Error('log file not written yet');
        });
        const events = JSON.parse(fs.readFileSync(logPath, 'utf8'));
        expect(events[0].type).toBe('session.started');
        expect(events.at(-1).type).toBe('session.closed');
    });

    it('is a no-op when logging an event with no active session', async () => {
        const { logTransportEvent } = await import('../../src/utils/transportLogger.js');
        expect(() => logTransportEvent('some.event', {})).not.toThrow();
    });
});
