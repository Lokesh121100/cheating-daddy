import fs from 'fs';
import path from 'path';
import { getConfigDir } from '../storage';

let logStream: fs.WriteStream | null = null;
let isFirstEvent = true;
let currentLogPath: string | null = null;

export function startTransportLog(sessionId: string): void {
    closeTransportLog();

    const logsDirectory = path.join(getConfigDir(), 'logs');
    fs.mkdirSync(logsDirectory, { recursive: true });

    currentLogPath = path.join(logsDirectory, `${sessionId}.json`);
    logStream = fs.createWriteStream(currentLogPath, { flags: 'w' });
    logStream.on('error', function (error) {
        console.error('Transport log stream error:', error.message);
    });
    isFirstEvent = true;
    logStream.write('[\n');

    logTransportEvent('session.started', { sessionId });
    console.log('Transport log:', currentLogPath);
}

export function logTransportEvent(type: string, data: Record<string, unknown>): void {
    if (!logStream) {
        return;
    }

    try {
        const event = {
            timestamp: Date.now(),
            type,
            data,
        };
        const prefix = isFirstEvent ? '' : ',\n';
        logStream.write(prefix + JSON.stringify(event));
        isFirstEvent = false;
    } catch (error) {
        console.error('Failed to write transport log event:', error instanceof Error ? error.message : error);
    }
}

export function closeTransportLog(): void {
    if (!logStream) {
        return;
    }

    logTransportEvent('session.closed', {});
    logStream.end('\n]\n');
    logStream = null;
    currentLogPath = null;
    isFirstEvent = true;
}
