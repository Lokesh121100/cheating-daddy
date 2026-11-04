// Types shared across the main/renderer IPC boundary. This file must stay free
// of any Node-only or DOM-only globals (no `fs`/`path`/`process`, no `window`)
// so both the main-process tsconfig (CommonJS, Node lib) and the renderer
// tsconfig (ESM, DOM lib) can import from it without pulling in the wrong
// global library set.

export interface Preferences {
    customPrompt: string;
    providerMode: string;
    selectedProfile: string;
    selectedLanguage: string;
    selectedScreenshotInterval: string;
    selectedImageQuality: string;
    advancedMode: boolean;
    audioMode: string;
    fontSize: string;
    backgroundTransparency: number;
    googleSearchEnabled: boolean;
    localLlmModel: string;
    whisperModel: string;
}
