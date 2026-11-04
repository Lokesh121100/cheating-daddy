import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import Module from 'module';
import { buildCompiledSiblings, removeCompiledSiblings } from '../helpers/compiledSiblings';

type IpcListener = (event: unknown, ...args: unknown[]) => unknown;

const onHandlers = new Map<string, IpcListener>();
const invokeHandlers = new Map<string, IpcListener>();

let window: typeof import('../../src/utils/window.js');

beforeAll(async () => {
    buildCompiledSiblings();

    const originalRequire = Module.prototype.require;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (Module.prototype as any).require = function (this: unknown, id: string, ...rest: unknown[]) {
        if (id === 'electron') {
            return {
                BrowserWindow: class {},
                globalShortcut: { unregisterAll: () => {}, register: () => {} },
                screen: { getPrimaryDisplay: () => ({ workAreaSize: { width: 1920, height: 1080 } }) },
                ipcMain: {
                    on: (channel: string, fn: IpcListener) => onHandlers.set(channel, fn),
                    handle: (channel: string, fn: IpcListener) => invokeHandlers.set(channel, fn),
                },
            };
        }
        return originalRequire.apply(this, [id, ...rest] as [string]);
    };

    try {
        window = await import('../../src/utils/window.js');
    } finally {
        Module.prototype.require = originalRequire;
    }

    const fakeMainWindow = {
        isDestroyed: () => false,
        isVisible: () => true,
        getPosition: () => [0, 0],
        setPosition: () => {},
    };
    window.setupWindowIpcHandlers(fakeMainWindow, () => {}, { current: null });
});

afterAll(() => {
    removeCompiledSiblings();
});

describe('window.js IPC parameter validation', () => {
    it('rejects update-keybinds with a null payload instead of crashing', () => {
        expect(() => onHandlers.get('update-keybinds')!({}, null)).not.toThrow();
    });

    it('rejects update-keybinds with a non-object payload instead of crashing', () => {
        expect(() => onHandlers.get('update-keybinds')!({}, 'not an object')).not.toThrow();
    });

    it('still accepts a well-formed keybinds object', () => {
        expect(() => onHandlers.get('update-keybinds')!({}, window.getDefaultKeybinds())).not.toThrow();
    });
});
