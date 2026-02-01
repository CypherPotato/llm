const COLORS = {
    reset: "\x1b[0m",
    bold: "\x1b[1m",
    dim: "\x1b[2m",
    italic: "\x1b[3m",
    cyan: "\x1b[36m",
    yellow: "\x1b[33m",
    green: "\x1b[32m",
    red: "\x1b[31m",
    magenta: "\x1b[35m",
    gray: "\x1b[90m",
    blue: "\x1b[34m",
    white: "\x1b[97m",
    bgGray: "\x1b[100m",
};

const ICONS = {
    bot: "◆",
    tool: "▸",
    success: "✓",
    error: "✗",
    warning: "!",
    arrow: "→",
    input: "›",
    bullet: "•",
};

const SPINNER_FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];

class Spinner {
    private frameIndex = 0;
    private interval: ReturnType<typeof setInterval> | null = null;
    private message: string;

    constructor(message: string) {
        this.message = message;
    }

    start(): void {
        process.stdout.write("\x1b[?25l");
        this.render();
        this.interval = setInterval(() => {
            this.frameIndex = (this.frameIndex + 1) % SPINNER_FRAMES.length;
            this.render();
        }, 80);
    }

    private render(): void {
        const frame = SPINNER_FRAMES[this.frameIndex];
        process.stdout.write(`\r${COLORS.cyan}${frame}${COLORS.reset} ${COLORS.dim}${this.message}${COLORS.reset}`);
    }

    stop(clearLine = true): void {
        if (this.interval) {
            clearInterval(this.interval);
            this.interval = null;
        }
        if (clearLine) {
            process.stdout.write("\r\x1b[K");
        }
        process.stdout.write("\x1b[?25h");
    }

    update(message: string): void {
        this.message = message;
    }
}

let activeSpinner: Spinner | null = null;

export function startSpinner(message: string): void {
    stopSpinner();
    activeSpinner = new Spinner(message);
    activeSpinner.start();
}

export function stopSpinner(): void {
    if (activeSpinner) {
        activeSpinner.stop();
        activeSpinner = null;
    }
}

export function printHelp(): void {
    console.log(`
${COLORS.cyan}${COLORS.bold}  ╭─────────────────────────────────────╮${COLORS.reset}
${COLORS.cyan}${COLORS.bold}  │${COLORS.reset}  ${COLORS.bold}${COLORS.white}LLM CLI${COLORS.reset} ${COLORS.dim}— AI-powered shell${COLORS.reset}     ${COLORS.cyan}${COLORS.bold}│${COLORS.reset}
${COLORS.cyan}${COLORS.bold}  ╰─────────────────────────────────────╯${COLORS.reset}

${COLORS.yellow}${COLORS.bold}  USAGE${COLORS.reset}
    ${COLORS.dim}$${COLORS.reset} llm ${COLORS.cyan}"<prompt>"${COLORS.reset}              ${COLORS.dim}Run AI task${COLORS.reset}
    ${COLORS.dim}$${COLORS.reset} llm ${COLORS.yellow}-y${COLORS.reset} ${COLORS.cyan}"<prompt>"${COLORS.reset}           ${COLORS.dim}Skip confirmations${COLORS.reset}

${COLORS.yellow}${COLORS.bold}  CONFIG${COLORS.reset}
    ${COLORS.dim}$${COLORS.reset} llm config --set ${COLORS.green}<k>${COLORS.reset} ${COLORS.green}<v>${COLORS.reset}    ${COLORS.dim}Set value${COLORS.reset}
    ${COLORS.dim}$${COLORS.reset} llm config --get ${COLORS.green}<key>${COLORS.reset}      ${COLORS.dim}Get value${COLORS.reset}
    ${COLORS.dim}$${COLORS.reset} llm config --list           ${COLORS.dim}List all${COLORS.reset}
    ${COLORS.dim}$${COLORS.reset} llm config --remove ${COLORS.green}<key>${COLORS.reset}   ${COLORS.dim}Remove key${COLORS.reset}
    ${COLORS.dim}$${COLORS.reset} llm config --clear          ${COLORS.dim}Clear all${COLORS.reset}

${COLORS.yellow}${COLORS.bold}  CONFIG KEYS${COLORS.reset}
    ${COLORS.green}openai.endpoint${COLORS.reset}     ${COLORS.dim}API endpoint URL${COLORS.reset}
    ${COLORS.green}openai.apikey${COLORS.reset}       ${COLORS.dim}API key${COLORS.reset}
    ${COLORS.green}openai.model${COLORS.reset}        ${COLORS.dim}Model (default: gpt-4o)${COLORS.reset}
    ${COLORS.green}yolomode${COLORS.reset}            ${COLORS.dim}Skip confirmations${COLORS.reset}
    ${COLORS.green}idle.timeout${COLORS.reset}        ${COLORS.dim}Input timeout ms (default: 8000)${COLORS.reset}

${COLORS.yellow}${COLORS.bold}  EXAMPLES${COLORS.reset}
    ${COLORS.dim}$${COLORS.reset} llm config --set openai.endpoint "https://api.openai.com/v1"
    ${COLORS.dim}$${COLORS.reset} llm "convert all .png to .jpg with ffmpeg"
`);
}

export function printAssistantMessage(content: string): void {
    stopSpinner();
    const trimmed = content.trim();
    if (trimmed) {
        console.log(`\n${COLORS.cyan}${ICONS.bot}${COLORS.reset} ${trimmed}`);
    }
}

export function printToolCall(name: string, args: Record<string, unknown>): void {
    stopSpinner();
    const displayName = name === "run_command" ? "Command" : name === "run_javascript" ? "JavaScript" : name;
    console.log(`\n${COLORS.yellow}${ICONS.tool} ${displayName}${COLORS.reset}`);

    if (name === "run_command") {
        console.log(`  ${COLORS.dim}${ICONS.arrow}${COLORS.reset} ${COLORS.white}${args.command}${COLORS.reset}`);
    } else if (name === "run_javascript") {
        const code = String(args.code).split("\n");
        const preview = code.length > 3
            ? [...code.slice(0, 3), `${COLORS.dim}... ${code.length - 3} more lines${COLORS.reset}`]
            : code;
        preview.forEach(line => {
            console.log(`  ${COLORS.dim}│${COLORS.reset} ${line}`);
        });
    }
}

export function printToolResult(result: string, isError: boolean = false): void {
    const trimmed = result.trim();
    if (!trimmed) return;

    const icon = isError ? ICONS.error : ICONS.success;
    const color = isError ? COLORS.red : COLORS.green;
    const label = isError ? "Error" : "Done";

    console.log(`${color}${icon} ${label}${COLORS.reset}`);
}

export function printError(message: string): void {
    stopSpinner();
    console.error(`\n${COLORS.red}${ICONS.error} ${message}${COLORS.reset}`);
}

export function printSuccess(message: string): void {
    console.log(`${COLORS.green}${ICONS.success} ${message}${COLORS.reset}`);
}

export function printInfo(message: string): void {
    console.log(`${COLORS.cyan}${ICONS.bullet} ${message}${COLORS.reset}`);
}

export async function confirm(message: string): Promise<boolean> {
    process.stdout.write(`${COLORS.yellow}${ICONS.warning} ${message}${COLORS.reset} ${COLORS.dim}[y/N]${COLORS.reset} `);

    return new Promise((resolve) => {
        const onData = (data: Buffer) => {
            process.stdin.removeListener("data", onData);
            process.stdin.pause();
            const answer = data.toString().trim().toLowerCase();
            resolve(answer === "y" || answer === "yes");
        };

        process.stdin.resume();
        process.stdin.once("data", onData);
    });
}

export function printWaitingForInput(reason: string): void {
    stopSpinner();
    console.log(`\n${COLORS.magenta}${ICONS.input} Waiting for input${COLORS.reset}`);
    if (reason) {
        console.log(`  ${COLORS.dim}${reason}${COLORS.reset}`);
    }
}

export async function promptUserInput(message: string): Promise<string> {
    process.stdout.write(`${COLORS.cyan}${ICONS.input}${COLORS.reset} ${message}: `);

    return new Promise((resolve) => {
        const onData = (data: Buffer) => {
            process.stdin.removeListener("data", onData);
            process.stdin.pause();
            resolve(data.toString().trim());
        };

        process.stdin.resume();
        process.stdin.once("data", onData);
    });
}
