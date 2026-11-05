// Ambient type for the `window.cheatingDaddy` bridge object defined in the
// still-unconverted src/utils/renderer.js. This grows incrementally, member by
// member, as each component that uses it gets converted -- each addition here
// is verified against renderer.js's real implementation at conversion time,
// not guessed ahead of it.
import type { Preferences, Keybinds, AppConfig, SessionRecord, SessionSummary } from '../shared/ipc-types';

interface IpcResult {
    success: boolean;
    error?: string;
}

interface CheatingDaddyStorageApi {
    getPreferences(): Promise<Preferences>;
    updatePreference<K extends keyof Preferences>(key: K, value: Preferences[K]): Promise<IpcResult>;
    getKeybinds(): Promise<Keybinds>;
    updateConfig<K extends keyof AppConfig>(key: K, value: AppConfig[K]): Promise<IpcResult>;
    getAllSessions(): Promise<SessionSummary[]>;
    getSession(sessionId: string): Promise<SessionRecord | null>;
}

interface CheatingDaddyGlobal {
    storage: CheatingDaddyStorageApi;
    isMacOS: boolean;
    getVersion(): Promise<string>;
}

interface MarkedGlobal {
    setOptions(options: { breaks?: boolean; gfm?: boolean; sanitize?: boolean }): void;
    parse(content: string): string;
}

declare global {
    interface Window {
        cheatingDaddy: CheatingDaddyGlobal;
        marked: MarkedGlobal;
        captureManualScreenshot: (imageQuality?: string | null) => Promise<void>;
        require: (id: 'electron') => typeof import('electron');
    }

    const cheatingDaddy: CheatingDaddyGlobal;

    // Renderer files call require('electron') directly (nodeIntegration is
    // enabled for this app's renderer). This narrowly types just that one
    // usage, verified against electron's own bundled types.
    function require(id: 'electron'): typeof import('electron');
}

export {};
