// Ambient type for the `window.cheatingDaddy` bridge object defined in the
// still-unconverted src/utils/renderer.js. This grows incrementally, member by
// member, as each component that uses it gets converted -- each addition here
// is verified against renderer.js's real implementation at conversion time,
// not guessed ahead of it.
import type { Preferences, Keybinds } from '../shared/ipc-types';

interface IpcResult {
    success: boolean;
    error?: string;
}

interface CheatingDaddyStorageApi {
    getPreferences(): Promise<Preferences>;
    updatePreference<K extends keyof Preferences>(key: K, value: Preferences[K]): Promise<IpcResult>;
    getKeybinds(): Promise<Keybinds>;
}

interface CheatingDaddyGlobal {
    storage: CheatingDaddyStorageApi;
    isMacOS: boolean;
}

declare global {
    interface Window {
        cheatingDaddy: CheatingDaddyGlobal;
    }

    const cheatingDaddy: CheatingDaddyGlobal;
}

export {};
