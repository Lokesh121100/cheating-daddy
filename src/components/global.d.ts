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
    setKeybinds(keybinds: Keybinds): Promise<IpcResult>;
    updateConfig<K extends keyof AppConfig>(key: K, value: AppConfig[K]): Promise<IpcResult>;
    getAllSessions(): Promise<SessionSummary[]>;
    getSession(sessionId: string): Promise<SessionRecord | null>;
    clearAll(): Promise<IpcResult>;
}

interface ThemeColors {
    background: string;
    text: string;
    textSecondary: string;
    textMuted: string;
    border: string;
    accent: string;
    btnPrimaryBg: string;
    btnPrimaryText: string;
    btnPrimaryHover: string;
    tooltipBg: string;
    tooltipText: string;
    keyBg: string;
}

interface ThemeOption {
    value: string;
    name: string;
    colors: ThemeColors;
}

interface CheatingDaddyThemeApi {
    getAll(): ThemeOption[];
    get(themeName: string): ThemeColors;
    apply(themeName: string, alpha?: number): void;
    applyBackgrounds(backgroundColor: string, alpha?: number): void;
    load(): Promise<string>;
    save(themeName: string): Promise<void>;
}

interface CheatingDaddyGlobal {
    storage: CheatingDaddyStorageApi;
    theme: CheatingDaddyThemeApi;
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
