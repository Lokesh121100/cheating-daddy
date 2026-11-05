// Types shared across the main/renderer IPC boundary. This file must stay free
// of any Node-only or DOM-only globals (no `fs`/`path`/`process`, no `window`)
// so both the main-process tsconfig (CommonJS, Node lib) and the renderer
// tsconfig (ESM, DOM lib) can import from it without pulling in the wrong
// global library set.

export type Keybinds = Record<string, string> | null;

export interface Credentials {
    apiKey: string;
    groqApiKey: string;
    cloudToken: string;
    openaiKey: string;
}

export interface AppConfig {
    configVersion: number;
    onboarded: boolean;
    layout: string;
    geminiLiveModel: string;
    groqModel: string;
    groqImageModel: string;
    disableGroqThinking: boolean;
}

export interface ConversationTurn {
    timestamp: number;
    transcription: string;
    ai_response: string;
}

export interface ScreenAnalysisEntry {
    timestamp: number;
    prompt: string;
    response: string;
    model: string;
}

export interface SessionRecord {
    sessionId: string;
    createdAt: number;
    lastUpdated: number;
    profile: string | null;
    customPrompt: string | null;
    conversationHistory: ConversationTurn[];
    screenAnalysisHistory: ScreenAnalysisEntry[];
}

export interface SessionSummary {
    sessionId: string;
    createdAt: number;
    lastUpdated: number;
    messageCount: number;
    screenAnalysisCount: number;
    profile: string | null;
    customPrompt: string | null;
}

export interface Preferences {
    customPrompt: string;
    providerMode: string;
    selectedProfile: string;
    selectedLanguage: string;
    selectedScreenshotInterval: string;
    selectedImageQuality: string;
    advancedMode: boolean;
    audioMode: string;
    // Pixel size (12-32), per every real consumer (CustomizeView.ts). The
    // original default below was the string 'medium', which nothing ever
    // actually read as a string -- fixed to match real usage.
    fontSize: number;
    backgroundTransparency: number;
    googleSearchEnabled: boolean;
    localLlmModel: string;
    whisperModel: string;
    theme: string;
}
