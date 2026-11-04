import WebSocket from 'ws';
import { BrowserWindow } from 'electron';

export interface CloudMessage {
    type: string;
    text?: string;
    message?: string;
    [key: string]: unknown;
}

let cloudWs: WebSocket | null = null;
let isCloudConnected = false;
let currentCloudResponse = '';
let currentTranscription = '';
let isFirstChunk = true;
let audioChunkCount = 0;
let onTurnComplete: ((transcription: string, response: string) => void) | null = null;

function sendToRenderer(channel: string, data: unknown): void {
    const windows = BrowserWindow.getAllWindows();
    if (windows.length > 0) {
        windows[0].webContents.send(channel, data);
    }
}

export function setOnTurnComplete(callback: (transcription: string, response: string) => void): void {
    onTurnComplete = callback;
}

export function connectCloud(token: string, profile?: string, userContext?: string): Promise<boolean> {
    // Close existing connection
    if (cloudWs) {
        try {
            cloudWs.close();
        } catch (e) {
            // ignore
        }
        cloudWs = null;
        isCloudConnected = false;
    }

    audioChunkCount = 0;

    return new Promise((resolve, reject) => {
        const url = `wss://api.cheatingdaddy.com/ws?token=${encodeURIComponent(token)}`;
        console.log('[Cloud] Connecting to', url);

        cloudWs = new WebSocket(url);

        const timeout = setTimeout(() => {
            if (!isCloudConnected) {
                cloudWs?.close();
                reject(new Error('Cloud connection timeout'));
            }
        }, 10000);

        cloudWs.on('open', () => {
            console.log('[Cloud] WebSocket open');
            isCloudConnected = true;
            clearTimeout(timeout);

            // Send config immediately after open
            const config = JSON.stringify({
                type: 'set_config',
                profile: profile || 'interview',
                user_context: userContext || '',
            });
            cloudWs?.send(config);
            console.log('[Cloud] Config sent:', profile);

            sendToRenderer('update-status', 'Cloud connected');
            resolve(true);
        });

        cloudWs.on('message', data => {
            try {
                const msg = JSON.parse(data.toString()) as CloudMessage;
                handleMessage(msg);
            } catch (e) {
                console.error('[Cloud] Parse error:', e);
            }
        });

        cloudWs.on('close', (code, reason) => {
            console.log('[Cloud] WebSocket closed:', code, reason.toString());
            console.log('[Cloud] Audio chunks sent before close:', audioChunkCount);
            isCloudConnected = false;
            clearTimeout(timeout);
        });

        cloudWs.on('error', err => {
            console.error('[Cloud] WebSocket error:', err.message);
            isCloudConnected = false;
            clearTimeout(timeout);
            reject(err);
        });
    });
}

function handleMessage(msg: CloudMessage): void {
    switch (msg.type) {
        case 'connected':
            console.log('[Cloud] Server confirmed connected');
            break;

        case 'transcription':
            console.log('[Cloud] Transcription:', msg.text);
            currentTranscription = msg.text || '';
            sendToRenderer('update-status', 'Generating response...');
            break;

        case 'response_start':
            currentCloudResponse = '';
            isFirstChunk = true;
            break;

        case 'response_chunk':
            currentCloudResponse += msg.text;
            sendToRenderer(isFirstChunk ? 'new-response' : 'update-response', currentCloudResponse);
            isFirstChunk = false;
            break;

        case 'response_end':
            if (onTurnComplete && currentCloudResponse.trim()) {
                onTurnComplete(currentTranscription, currentCloudResponse);
            }
            currentTranscription = '';
            sendToRenderer('update-status', 'Listening...');
            break;

        case 'session_end':
            console.log('[Cloud] Session ended by server');
            isCloudConnected = false;
            break;

        case 'error':
            console.error('[Cloud] Server error:', msg.message);
            sendToRenderer('update-status', 'Cloud error: ' + msg.message);
            break;

        default:
            console.log('[Cloud] Event:', msg.type);
    }
}

export function sendCloudAudio(pcmBuffer: Buffer): void {
    if (!cloudWs || !isCloudConnected || cloudWs.readyState !== WebSocket.OPEN) {
        return;
    }

    cloudWs.send(pcmBuffer, { binary: true }, err => {
        if (err) {
            console.error('[Cloud] Audio send error:', err.message);
        }
    });

    audioChunkCount++;
    process.stdout.write('.');
}

export function sendCloudText(text: string): void {
    if (cloudWs && isCloudConnected && cloudWs.readyState === WebSocket.OPEN) {
        cloudWs.send(
            JSON.stringify({
                type: 'test_text',
                text: text,
            })
        );
    }
}

export function sendCloudImage(base64Data: string): boolean {
    if (!cloudWs || !isCloudConnected || cloudWs.readyState !== WebSocket.OPEN) {
        return false;
    }
    cloudWs.send(
        JSON.stringify({
            type: 'image',
            image: base64Data,
        })
    );
    return true;
}

export function closeCloud(): void {
    console.log('[Cloud] Closing. Audio chunks sent:', audioChunkCount);
    if (cloudWs) {
        try {
            if (cloudWs.readyState === WebSocket.OPEN) {
                cloudWs.send(JSON.stringify({ type: 'end_connection' }));
            }
            cloudWs.close();
        } catch (e) {
            console.error('[Cloud] Close error:', e);
        }
        cloudWs = null;
    }
    isCloudConnected = false;
    currentCloudResponse = '';
    currentTranscription = '';
    isFirstChunk = true;
    audioChunkCount = 0;
    onTurnComplete = null;
}

export function isCloudActive(): boolean {
    return !!(isCloudConnected && cloudWs && cloudWs.readyState === WebSocket.OPEN);
}
