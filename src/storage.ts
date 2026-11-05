import fs from 'fs';
import path from 'path';
import os from 'os';
import type { Preferences, Keybinds, AppConfig } from './shared/ipc-types';

export type { Preferences, Keybinds, AppConfig };

const CONFIG_VERSION = 1;

export interface Credentials {
    apiKey: string;
    groqApiKey: string;
}

export interface ModelUsage {
    chars: number;
    limit?: number;
}

export interface DailyLimitsEntry {
    date: string;
    flash: { count: number };
    flashLite: { count: number };
    groq?: Record<string, ModelUsage>;
    gemini?: Record<string, ModelUsage>;
}

export interface LimitsData {
    data: DailyLimitsEntry[];
}

export interface SessionRecord {
    sessionId: string;
    createdAt: number;
    lastUpdated: number;
    profile: string | null;
    customPrompt: string | null;
    conversationHistory: unknown[];
    screenAnalysisHistory: unknown[];
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

// Default values
const DEFAULT_CONFIG: AppConfig = {
    configVersion: CONFIG_VERSION,
    onboarded: false,
    layout: 'normal',
    geminiLiveModel: 'gemini-3.1-flash-live-preview',
    groqModel: 'qwen/qwen3.6-27b',
    groqImageModel: 'qwen/qwen3.6-27b',
    disableGroqThinking: true,
};

const DEFAULT_CREDENTIALS: Credentials = {
    apiKey: '',
    groqApiKey: '',
};

const DEFAULT_PREFERENCES: Preferences = {
    customPrompt: '',
    providerMode: 'byok',
    selectedProfile: 'interview',
    selectedLanguage: 'en-US',
    selectedScreenshotInterval: '5',
    selectedImageQuality: 'medium',
    advancedMode: false,
    audioMode: 'speaker_only',
    fontSize: 'medium',
    backgroundTransparency: 0.8,
    googleSearchEnabled: false,
    localLlmModel: 'unsloth/Qwen3.5-4B-GGUF:Q4_K_M',
    whisperModel: 'tiny.en',
};

const DEFAULT_KEYBINDS: Keybinds = null; // null means use system defaults

const DEFAULT_LIMITS: LimitsData = {
    data: [], // Array of { date: 'YYYY-MM-DD', flash: { count }, flashLite: { count }, groq: { 'qwen3-32b': { chars, limit }, 'gpt-oss-120b': { chars, limit }, 'gpt-oss-20b': { chars, limit } }, gemini: { 'gemma-4-26b-a4b-it': { chars } } }
};

// Get the config directory path based on OS
export function getConfigDir(): string {
    if (process.env.VITEST && process.env.CHEATING_DADDY_CONFIG_DIR) {
        return process.env.CHEATING_DADDY_CONFIG_DIR;
    }

    const platform = os.platform();
    let configDir: string;

    if (platform === 'win32') {
        configDir = path.join(os.homedir(), 'AppData', 'Roaming', 'cheating-daddy-config');
    } else if (platform === 'darwin') {
        configDir = path.join(os.homedir(), 'Library', 'Application Support', 'cheating-daddy-config');
    } else {
        configDir = path.join(os.homedir(), '.config', 'cheating-daddy-config');
    }

    return configDir;
}

// File paths
function getConfigPath(): string {
    return path.join(getConfigDir(), 'config.json');
}

function getCredentialsPath(): string {
    return path.join(getConfigDir(), 'credentials.json');
}

function getPreferencesPath(): string {
    return path.join(getConfigDir(), 'preferences.json');
}

function getKeybindsPath(): string {
    return path.join(getConfigDir(), 'keybinds.json');
}

function getLimitsPath(): string {
    return path.join(getConfigDir(), 'limits.json');
}

function getHistoryDir(): string {
    return path.join(getConfigDir(), 'history');
}

// Helper to read JSON file safely
function readJsonFile<T>(filePath: string, defaultValue: T): T {
    try {
        if (fs.existsSync(filePath)) {
            const data = fs.readFileSync(filePath, 'utf8');
            return JSON.parse(data) as T;
        }
    } catch (error) {
        console.warn(`Error reading ${filePath}:`, error instanceof Error ? error.message : error);
    }
    return defaultValue;
}

// Helper to write JSON file safely
function writeJsonFile<T>(filePath: string, data: T): boolean {
    try {
        const dir = path.dirname(filePath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
        return true;
    } catch (error) {
        console.error(`Error writing ${filePath}:`, error instanceof Error ? error.message : error);
        return false;
    }
}

// Check if we need to reset (no configVersion or wrong version)
function needsReset(): boolean {
    const configPath = getConfigPath();
    if (!fs.existsSync(configPath)) {
        return true;
    }

    try {
        const config = JSON.parse(fs.readFileSync(configPath, 'utf8')) as Partial<AppConfig>;
        return !config.configVersion || config.configVersion !== CONFIG_VERSION;
    } catch {
        return true;
    }
}

// Wipe and reinitialize the config directory
function resetConfigDir(): void {
    const configDir = getConfigDir();

    console.log('Resetting config directory...');

    // Remove existing directory if it exists
    if (fs.existsSync(configDir)) {
        fs.rmSync(configDir, { recursive: true, force: true });
    }

    // Create fresh directory structure
    fs.mkdirSync(configDir, { recursive: true });
    fs.mkdirSync(getHistoryDir(), { recursive: true });

    // Initialize with defaults
    writeJsonFile(getConfigPath(), DEFAULT_CONFIG);
    writeJsonFile(getCredentialsPath(), DEFAULT_CREDENTIALS);
    writeJsonFile(getPreferencesPath(), DEFAULT_PREFERENCES);

    console.log('Config directory initialized with defaults');
}

// Initialize storage - call this on app startup
export function initializeStorage(): void {
    if (needsReset()) {
        resetConfigDir();
    } else {
        // Ensure history directory exists
        const historyDir = getHistoryDir();
        if (!fs.existsSync(historyDir)) {
            fs.mkdirSync(historyDir, { recursive: true });
        }
    }
}

// ============ CONFIG ============

export function getConfig(): AppConfig {
    const saved = readJsonFile<Partial<AppConfig>>(getConfigPath(), {});
    return { ...DEFAULT_CONFIG, ...saved };
}

export function setConfig(config: Partial<AppConfig>): boolean {
    const current = getConfig();
    const updated: AppConfig = { ...current, ...config, configVersion: CONFIG_VERSION };
    return writeJsonFile(getConfigPath(), updated);
}

export function updateConfig<K extends keyof AppConfig>(key: K, value: AppConfig[K]): boolean {
    const config = getConfig();
    const updated = { ...config, [key]: value } as AppConfig;
    return writeJsonFile(getConfigPath(), updated);
}

// ============ CREDENTIALS ============

export function getCredentials(): Credentials {
    return readJsonFile<Credentials>(getCredentialsPath(), DEFAULT_CREDENTIALS);
}

export function setCredentials(credentials: Partial<Credentials>): boolean {
    const current = getCredentials();
    const updated: Credentials = { ...current, ...credentials };
    return writeJsonFile(getCredentialsPath(), updated);
}

export function getApiKey(): string {
    return getCredentials().apiKey || '';
}

export function setApiKey(apiKey: string): boolean {
    return setCredentials({ apiKey });
}

export function getGroqApiKey(): string {
    return getCredentials().groqApiKey || '';
}

export function setGroqApiKey(groqApiKey: string): boolean {
    return setCredentials({ groqApiKey });
}

// ============ PREFERENCES ============

export function getPreferences(): Preferences {
    const saved = readJsonFile<Partial<Preferences>>(getPreferencesPath(), {});
    const preferences: Preferences = { ...DEFAULT_PREFERENCES, ...saved };
    const legacyWhisperModels: Record<string, string> = {
        'Xenova/whisper-tiny': 'tiny.en',
        'Xenova/whisper-base': 'base.en',
        'Xenova/whisper-small': 'small.en',
    };

    preferences.whisperModel = legacyWhisperModels[preferences.whisperModel] || preferences.whisperModel;
    return preferences;
}

export function setPreferences(preferences: Partial<Preferences>): boolean {
    const current = getPreferences();
    const updated: Preferences = { ...current, ...preferences };
    return writeJsonFile(getPreferencesPath(), updated);
}

export function updatePreference<K extends keyof Preferences>(key: K, value: Preferences[K]): boolean {
    const preferences = getPreferences();
    const updated = { ...preferences, [key]: value } as Preferences;
    return writeJsonFile(getPreferencesPath(), updated);
}

// ============ KEYBINDS ============

export function getKeybinds(): Keybinds {
    return readJsonFile<Keybinds>(getKeybindsPath(), DEFAULT_KEYBINDS);
}

export function setKeybinds(keybinds: Keybinds): boolean {
    return writeJsonFile(getKeybindsPath(), keybinds);
}

// ============ LIMITS (Rate Limiting) ============

export function getLimits(): LimitsData {
    return readJsonFile<LimitsData>(getLimitsPath(), DEFAULT_LIMITS);
}

export function setLimits(limits: LimitsData): boolean {
    return writeJsonFile(getLimitsPath(), limits);
}

function getTodayDateString(): string {
    const now = new Date();
    return now.toISOString().split('T')[0]; // YYYY-MM-DD
}

export function getTodayLimits(): DailyLimitsEntry {
    const limits = getLimits();
    const today = getTodayDateString();

    // Find today's entry
    const todayEntry = limits.data.find(entry => entry.date === today);

    if (todayEntry) {
        // ensure new fields exist
        if (!todayEntry.groq) {
            todayEntry.groq = {
                'qwen3-32b': { chars: 0, limit: 1500000 },
                'gpt-oss-120b': { chars: 0, limit: 600000 },
                'gpt-oss-20b': { chars: 0, limit: 600000 },
                'kimi-k2-instruct': { chars: 0, limit: 600000 },
            };
        }
        if (!todayEntry.gemini) {
            todayEntry.gemini = {
                'gemma-4-26b-a4b-it': { chars: 0 },
            };
        }
        setLimits(limits);
        return todayEntry;
    }

    // No entry for today - clean old entries and create new one
    limits.data = limits.data.filter(entry => entry.date === today);
    const newEntry: DailyLimitsEntry = {
        date: today,
        flash: { count: 0 },
        flashLite: { count: 0 },
        groq: {
            'qwen3-32b': { chars: 0, limit: 1500000 },
            'gpt-oss-120b': { chars: 0, limit: 600000 },
            'gpt-oss-20b': { chars: 0, limit: 600000 },
            'kimi-k2-instruct': { chars: 0, limit: 600000 },
        },
        gemini: {
            'gemma-4-26b-a4b-it': { chars: 0 },
        },
    };
    limits.data.push(newEntry);
    setLimits(limits);

    return newEntry;
}

export function incrementLimitCount(model: string): DailyLimitsEntry {
    const limits = getLimits();
    const today = getTodayDateString();

    // Find or create today's entry
    let todayEntry = limits.data.find(entry => entry.date === today);

    if (!todayEntry) {
        // Clean old entries and create new one
        limits.data = [];
        todayEntry = {
            date: today,
            flash: { count: 0 },
            flashLite: { count: 0 },
        };
        limits.data.push(todayEntry);
    } else {
        // Clean old entries, keep only today
        limits.data = limits.data.filter(entry => entry.date === today);
    }

    // Increment the appropriate model count
    if (model === 'gemini-2.5-flash') {
        todayEntry.flash.count++;
    } else if (model === 'gemini-2.5-flash-lite') {
        todayEntry.flashLite.count++;
    }

    setLimits(limits);
    return todayEntry;
}

export function incrementCharUsage(provider: string, model: string, charCount: number): DailyLimitsEntry | undefined {
    getTodayLimits();

    const limits = getLimits();
    const today = getTodayDateString();
    const todayEntry = limits.data.find(entry => entry.date === today);

    if (todayEntry) {
        const providerUsage = (todayEntry as unknown as Record<string, Record<string, ModelUsage> | undefined>)[provider];
        if (providerUsage && providerUsage[model]) {
            providerUsage[model].chars += charCount;
            setLimits(limits);
        }
    }

    return todayEntry;
}

export function getAvailableModel(): string {
    const todayLimits = getTodayLimits();

    // RPD limits: flash = 20, flash-lite = 20
    // After both exhausted, fall back to flash (for paid API users)
    if (todayLimits.flash.count < 20) {
        return 'gemini-2.5-flash';
    } else if (todayLimits.flashLite.count < 20) {
        return 'gemini-2.5-flash-lite';
    }

    return 'gemini-2.5-flash'; // Default to flash for paid API users
}

export function getModelForToday(): string | null {
    const todayEntry = getTodayLimits();
    const groq = todayEntry.groq!;

    if (groq['gpt-oss-120b'].chars < (groq['gpt-oss-120b'].limit ?? 0)) {
        return 'openai/gpt-oss-120b';
    }
    if (groq['gpt-oss-20b'].chars < (groq['gpt-oss-20b'].limit ?? 0)) {
        return 'openai/gpt-oss-20b';
    }
    if (groq['kimi-k2-instruct'].chars < (groq['kimi-k2-instruct'].limit ?? 0)) {
        return 'moonshotai/kimi-k2-instruct';
    }

    // All limits exhausted
    return null;
}

// ============ HISTORY ============

function getSessionPath(sessionId: string): string {
    return path.join(getHistoryDir(), `${sessionId}.json`);
}

export function saveSession(sessionId: string, data: Partial<SessionRecord>): boolean {
    const sessionPath = getSessionPath(sessionId);

    // Load existing session to preserve metadata
    const existingSession = readJsonFile<SessionRecord | null>(sessionPath, null);

    const sessionData: SessionRecord = {
        sessionId,
        createdAt: existingSession?.createdAt || parseInt(sessionId),
        lastUpdated: Date.now(),
        // Profile context - set once when session starts
        profile: data.profile || existingSession?.profile || null,
        customPrompt: data.customPrompt || existingSession?.customPrompt || null,
        // Conversation data
        conversationHistory: data.conversationHistory || existingSession?.conversationHistory || [],
        screenAnalysisHistory: data.screenAnalysisHistory || existingSession?.screenAnalysisHistory || [],
    };
    return writeJsonFile(sessionPath, sessionData);
}

export function getSession(sessionId: string): SessionRecord | null {
    return readJsonFile<SessionRecord | null>(getSessionPath(sessionId), null);
}

export function getAllSessions(): SessionSummary[] {
    const historyDir = getHistoryDir();

    try {
        if (!fs.existsSync(historyDir)) {
            return [];
        }

        const files = fs
            .readdirSync(historyDir)
            .filter(f => f.endsWith('.json'))
            .sort((a, b) => {
                // Sort by timestamp descending (newest first)
                const tsA = parseInt(a.replace('.json', ''));
                const tsB = parseInt(b.replace('.json', ''));
                return tsB - tsA;
            });

        return files
            .map((file): SessionSummary | null => {
                const sessionId = file.replace('.json', '');
                const data = readJsonFile<SessionRecord | null>(path.join(historyDir, file), null);
                if (data) {
                    return {
                        sessionId,
                        createdAt: data.createdAt,
                        lastUpdated: data.lastUpdated,
                        messageCount: data.conversationHistory?.length || 0,
                        screenAnalysisCount: data.screenAnalysisHistory?.length || 0,
                        profile: data.profile || null,
                        customPrompt: data.customPrompt || null,
                    };
                }
                return null;
            })
            .filter((session): session is SessionSummary => session !== null);
    } catch (error) {
        console.error('Error reading sessions:', error instanceof Error ? error.message : error);
        return [];
    }
}

export function deleteSession(sessionId: string): boolean {
    const sessionPath = getSessionPath(sessionId);
    try {
        if (fs.existsSync(sessionPath)) {
            fs.unlinkSync(sessionPath);
            return true;
        }
    } catch (error) {
        console.error('Error deleting session:', error instanceof Error ? error.message : error);
    }
    return false;
}

export function deleteAllSessions(): boolean {
    const historyDir = getHistoryDir();
    try {
        if (fs.existsSync(historyDir)) {
            const files = fs.readdirSync(historyDir).filter(f => f.endsWith('.json'));
            files.forEach(file => {
                fs.unlinkSync(path.join(historyDir, file));
            });
        }
        return true;
    } catch (error) {
        console.error('Error deleting all sessions:', error instanceof Error ? error.message : error);
        return false;
    }
}

// ============ CLEAR ALL DATA ============

export function clearAllData(): boolean {
    resetConfigDir();
    return true;
}
