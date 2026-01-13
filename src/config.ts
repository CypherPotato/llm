import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { homedir } from "os";
import { join } from "path";

function getConfigDir(): string {
    const platform = process.platform;

    if (platform === "win32") {
        return join(process.env.LOCALAPPDATA || join(homedir(), "AppData", "Local"), ".llm");
    } else if (platform === "darwin") {
        return join(homedir(), "Library", "Application Support", ".llm");
    } else {
        return join(process.env.XDG_CONFIG_HOME || join(homedir(), ".config"), ".llm");
    }
}

function getConfigPath(): string {
    return join(getConfigDir(), "config.json");
}

function ensureConfigDir(): void {
    const dir = getConfigDir();
    if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
    }
}

export function readConfig(): Record<string, unknown> {
    const path = getConfigPath();
    if (!existsSync(path)) {
        return {};
    }
    try {
        return JSON.parse(readFileSync(path, "utf-8"));
    } catch {
        return {};
    }
}

export function writeConfig(config: Record<string, unknown>): void {
    ensureConfigDir();
    writeFileSync(getConfigPath(), JSON.stringify(config, null, 2));
}

export function getConfigValue(key: string): unknown {
    const config = readConfig();
    const keys = key.split(".");
    let value: unknown = config;

    for (const k of keys) {
        if (value && typeof value === "object" && k in value) {
            value = (value as Record<string, unknown>)[k];
        } else {
            return undefined;
        }
    }
    return value;
}

export function setConfigValue(key: string, value: string): void {
    const config = readConfig();
    const keys = key.split(".");
    let current: Record<string, unknown> = config;

    for (let i = 0; i < keys.length - 1; i++) {
        const k = keys[i]!;
        if (!(k in current) || typeof current[k] !== "object") {
            current[k] = {};
        }
        current = current[k] as Record<string, unknown>;
    }

    const parsedValue = value === "true" ? true : value === "false" ? false : value;
    current[keys[keys.length - 1]!] = parsedValue;
    writeConfig(config);
}

export function listConfig(): Record<string, unknown> {
    return readConfig();
}

export function removeConfigValue(key: string): boolean {
    const config = readConfig();
    const keys = key.split(".");
    let current: Record<string, unknown> = config;

    for (let i = 0; i < keys.length - 1; i++) {
        const k = keys[i]!;
        if (!(k in current) || typeof current[k] !== "object") {
            return false;
        }
        current = current[k] as Record<string, unknown>;
    }

    const lastKey = keys[keys.length - 1]!;
    if (!(lastKey in current)) {
        return false;
    }

    delete current[lastKey];
    writeConfig(config);
    return true;
}

export function clearConfig(): void {
    writeConfig({});
}
