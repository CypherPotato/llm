import { spawn, ChildProcess } from "child_process";
import { writeFileSync, unlinkSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { analyzeProcessOutput, type InputAnalysis } from "./api";
import { getConfigValue } from "./config";

interface ExecutionResult {
    success: boolean;
    output: string;
}

interface InteractiveExecutor {
    sendInput(input: string): void;
    terminate(): void;
    onOutput(callback: (data: string) => void): void;
    onWaitingForInput(callback: (analysis: InputAnalysis) => void): void;
    onComplete(callback: (result: ExecutionResult) => void): void;
}

const DEFAULT_IDLE_TIMEOUT_MS = 8000;

function getIdleTimeout(): number {
    const configured = getConfigValue("idle.timeout");
    if (typeof configured === "number") return configured;
    if (typeof configured === "string") {
        const parsed = parseInt(configured, 10);
        if (!isNaN(parsed)) return parsed;
    }
    return DEFAULT_IDLE_TIMEOUT_MS;
}

export function executeCommandInteractive(command: string): InteractiveExecutor {
    const isWindows = process.platform === "win32";
    let proc: ChildProcess;

    if (isWindows) {
        proc = spawn("powershell.exe", ["-NoProfile", "-Command", command], {
            stdio: ["pipe", "pipe", "pipe"],
        });
    } else {
        proc = spawn("sh", ["-c", command], {
            stdio: ["pipe", "pipe", "pipe"],
        });
    }

    let outputBuffer = "";
    let outputCallback: ((data: string) => void) | null = null;
    let waitingCallback: ((analysis: InputAnalysis) => void) | null = null;
    let completeCallback: ((result: ExecutionResult) => void) | null = null;
    let idleTimer: Timer | null = null;
    let isAnalyzing = false;
    let isComplete = false;

    const scheduleAnalysis = () => {
        if (isComplete || isAnalyzing) return;

        if (idleTimer) clearTimeout(idleTimer);
        idleTimer = setTimeout(async () => {
            if (isComplete || isAnalyzing) return;
            isAnalyzing = true;

            const analysis = await analyzeProcessOutput(outputBuffer);
            isAnalyzing = false;

            if (isComplete) return;

            if (analysis.waitingForInput) {
                waitingCallback?.(analysis);
            }
        }, getIdleTimeout());
    };

    proc.stdout?.on("data", (data: Buffer) => {
        const text = data.toString();
        outputBuffer += text;
        outputCallback?.(text);
        scheduleAnalysis();
    });

    proc.stderr?.on("data", (data: Buffer) => {
        const text = data.toString();
        outputBuffer += text;
        outputCallback?.(text);
        scheduleAnalysis();
    });

    proc.on("close", (code) => {
        isComplete = true;
        if (idleTimer) clearTimeout(idleTimer);
        completeCallback?.({
            success: code === 0,
            output: outputBuffer.trim() || "Command completed",
        });
    });

    proc.on("error", (error) => {
        isComplete = true;
        if (idleTimer) clearTimeout(idleTimer);
        completeCallback?.({
            success: false,
            output: error.message,
        });
    });

    return {
        sendInput(input: string) {
            proc.stdin?.write(input + "\n");
        },
        terminate() {
            isComplete = true;
            if (idleTimer) clearTimeout(idleTimer);
            proc.kill();
        },
        onOutput(callback) {
            outputCallback = callback;
        },
        onWaitingForInput(callback) {
            waitingCallback = callback;
        },
        onComplete(callback) {
            completeCallback = callback;
        },
    };
}

export function executeJavaScriptInteractive(code: string): InteractiveExecutor {
    const tempFile = join(tmpdir(), `llm-exec-${Date.now()}.js`);
    writeFileSync(tempFile, code);

    const proc = spawn("bun", ["run", tempFile], {
        stdio: ["pipe", "pipe", "pipe"],
    });

    let outputBuffer = "";
    let outputCallback: ((data: string) => void) | null = null;
    let waitingCallback: ((analysis: InputAnalysis) => void) | null = null;
    let completeCallback: ((result: ExecutionResult) => void) | null = null;
    let idleTimer: Timer | null = null;
    let isAnalyzing = false;
    let isComplete = false;

    const cleanup = () => {
        try {
            unlinkSync(tempFile);
        } catch { }
    };

    const scheduleAnalysis = () => {
        if (isComplete || isAnalyzing) return;

        if (idleTimer) clearTimeout(idleTimer);
        idleTimer = setTimeout(async () => {
            if (isComplete || isAnalyzing) return;
            isAnalyzing = true;

            const analysis = await analyzeProcessOutput(outputBuffer);
            isAnalyzing = false;

            if (isComplete) return;

            if (analysis.waitingForInput) {
                waitingCallback?.(analysis);
            }
        }, getIdleTimeout());
    };

    proc.stdout?.on("data", (data: Buffer) => {
        const text = data.toString();
        outputBuffer += text;
        outputCallback?.(text);
        scheduleAnalysis();
    });

    proc.stderr?.on("data", (data: Buffer) => {
        const text = data.toString();
        outputBuffer += text;
        outputCallback?.(text);
        scheduleAnalysis();
    });

    proc.on("close", (code) => {
        isComplete = true;
        if (idleTimer) clearTimeout(idleTimer);
        cleanup();
        completeCallback?.({
            success: code === 0,
            output: outputBuffer.trim() || "Code executed successfully",
        });
    });

    proc.on("error", (error) => {
        isComplete = true;
        if (idleTimer) clearTimeout(idleTimer);
        cleanup();
        completeCallback?.({
            success: false,
            output: error.message,
        });
    });

    return {
        sendInput(input: string) {
            proc.stdin?.write(input + "\n");
        },
        terminate() {
            isComplete = true;
            if (idleTimer) clearTimeout(idleTimer);
            proc.kill();
            cleanup();
        },
        onOutput(callback) {
            outputCallback = callback;
        },
        onWaitingForInput(callback) {
            waitingCallback = callback;
        },
        onComplete(callback) {
            completeCallback = callback;
        },
    };
}

export async function executeJavaScript(code: string): Promise<ExecutionResult> {
    return new Promise((resolve) => {
        const executor = executeJavaScriptInteractive(code);
        executor.onComplete(resolve);
    });
}

export async function executeCommand(command: string): Promise<ExecutionResult> {
    return new Promise((resolve) => {
        const executor = executeCommandInteractive(command);
        executor.onComplete(resolve);
    });
}

export function getShellInfo(): string {
    return process.platform === "win32" ? "PowerShell" : process.env.SHELL || "/bin/sh";
}

export function getSystemContext(): string {
    const isWindows = process.platform === "win32";

    const shellExamples = isWindows
        ? `Examples of valid PowerShell commands:
  - Get-Content package.json
  - Get-ChildItem (or ls, dir)
  - cat file.txt
  - echo "hello"
  - bun --version`
        : `Examples of valid shell commands:
  - cat package.json
  - ls -la
  - echo "hello"
  - bun --version`;

    return `Environment Information:
- Operating System: ${process.platform} (${process.arch})
- Shell: ${getShellInfo()}
- JavaScript Runtime: Bun ${Bun.version}
- Current Directory: ${process.cwd()}
- Current Date: ${new Date().toISOString()}

${shellExamples}

JavaScript execution notes:
- Code runs as a standalone Bun script
- Use ES modules (import) or CommonJS (require)
- Console output is captured and returned`;
}

export type { ExecutionResult, InteractiveExecutor };
