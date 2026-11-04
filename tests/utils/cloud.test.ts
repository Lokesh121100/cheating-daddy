import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from 'vitest';
import { EventEmitter } from 'events';

class FakeWebSocket extends EventEmitter {
    static OPEN = 1;
    readyState = FakeWebSocket.OPEN;
    sentMessages: unknown[] = [];
    constructor(public url: string) {
        super();
    }
    send(data: unknown, optionsOrCallback?: unknown, callback?: (err?: Error) => void) {
        this.sentMessages.push(data);
        const cb = typeof optionsOrCallback === 'function' ? optionsOrCallback : callback;
        if (typeof cb === 'function') cb();
    }
    close() {
        this.emit('close', 1000, Buffer.from(''));
    }
}

let lastSocket: FakeWebSocket | undefined;
let sentToRenderer: Array<{ channel: string; data: unknown }> = [];
let windowCount = 1;

vi.mock('ws', () => ({
    default: class extends FakeWebSocket {
        constructor(url: string) {
            super(url);
            lastSocket = this;
        }
    },
}));

vi.mock('electron', () => ({
    BrowserWindow: {
        getAllWindows: () =>
            windowCount === 0
                ? []
                : [{ webContents: { send: (channel: string, data: unknown) => sentToRenderer.push({ channel, data }) } }],
    },
}));

beforeEach(() => {
    lastSocket = undefined;
    sentToRenderer = [];
    windowCount = 1;
});

let cloud: typeof import('../../src/utils/cloud.js');

beforeAll(async () => {
    cloud = await import('../../src/utils/cloud.js');
});

afterEach(() => {
    cloud.closeCloud();
});

describe('cloud', () => {
    it('resolves and reports connected status once the socket opens', async () => {
        const promise = cloud.connectCloud('tok', 'interview', 'ctx');
        lastSocket!.emit('open');
        await expect(promise).resolves.toBe(true);
        expect(sentToRenderer).toContainEqual({ channel: 'update-status', data: 'Cloud connected' });
    });

    it('does not throw when there are no open windows', async () => {
        windowCount = 0;
        const promise = cloud.connectCloud('tok', 'interview', 'ctx');
        expect(() => lastSocket!.emit('open')).not.toThrow();
        await promise;
    });

    it('accumulates response chunks as new-response then update-response', async () => {
        const promise = cloud.connectCloud('tok', 'interview', 'ctx');
        lastSocket!.emit('open');
        await promise;
        lastSocket!.emit('message', Buffer.from(JSON.stringify({ type: 'response_start' })));
        lastSocket!.emit('message', Buffer.from(JSON.stringify({ type: 'response_chunk', text: 'Hello' })));
        lastSocket!.emit('message', Buffer.from(JSON.stringify({ type: 'response_chunk', text: ' world' })));
        const chunkEvents = sentToRenderer.filter(e => e.channel === 'new-response' || e.channel === 'update-response');
        expect(chunkEvents[0]).toEqual({ channel: 'new-response', data: 'Hello' });
        expect(chunkEvents[1]).toEqual({ channel: 'update-response', data: 'Hello world' });
    });

    it('invokes onTurnComplete with transcription and final response only when the response is non-empty', async () => {
        const onTurnComplete = vi.fn();
        cloud.setOnTurnComplete(onTurnComplete);
        const promise = cloud.connectCloud('tok', 'interview', 'ctx');
        lastSocket!.emit('open');
        await promise;
        lastSocket!.emit('message', Buffer.from(JSON.stringify({ type: 'transcription', text: 'ignored question' })));
        lastSocket!.emit('message', Buffer.from(JSON.stringify({ type: 'response_start' })));
        lastSocket!.emit('message', Buffer.from(JSON.stringify({ type: 'response_end' })));
        expect(onTurnComplete).not.toHaveBeenCalled();

        lastSocket!.emit('message', Buffer.from(JSON.stringify({ type: 'transcription', text: 'hi there' })));
        lastSocket!.emit('message', Buffer.from(JSON.stringify({ type: 'response_start' })));
        lastSocket!.emit('message', Buffer.from(JSON.stringify({ type: 'response_chunk', text: 'answer' })));
        lastSocket!.emit('message', Buffer.from(JSON.stringify({ type: 'response_end' })));
        expect(onTurnComplete).toHaveBeenCalledWith('hi there', 'answer');
    });

    it('isCloudActive reflects the connection lifecycle', async () => {
        expect(cloud.isCloudActive()).toBe(false);
        const promise = cloud.connectCloud('tok', 'interview', 'ctx');
        lastSocket!.emit('open');
        await promise;
        expect(cloud.isCloudActive()).toBe(true);
        cloud.closeCloud();
        expect(cloud.isCloudActive()).toBe(false);
    });

    it('sendCloudAudio/sendCloudText/sendCloudImage no-op before any connection exists', () => {
        expect(() => cloud.sendCloudAudio(Buffer.from([1, 2, 3]))).not.toThrow();
        expect(() => cloud.sendCloudText('hi')).not.toThrow();
        expect(cloud.sendCloudImage('base64')).toBe(false);
        expect(lastSocket).toBeUndefined();
    });
});
