const COLORS = {
    reset: "\x1b[0m",
    bold: "\x1b[1m",
    dim: "\x1b[2m",
    cyan: "\x1b[36m",
    yellow: "\x1b[33m",
    green: "\x1b[32m",
    red: "\x1b[31m",
    magenta: "\x1b[35m",
    gray: "\x1b[90m",
};

export function printHelp(): void {
    console.log(`
${COLORS.bold}${COLORS.cyan}LLM CLI${COLORS.reset} - AI-powered command execution

${COLORS.bold}USAGE:${COLORS.reset}
  llm "<prompt>"              Execute an AI-powered task
  llm -y "<prompt>"           Execute without confirmation (yolo mode)
  llm config --set <k> <v>    Set a configuration value
  llm config --get <key>      Get a configuration value
  llm config --list           List all configuration values
  llm config --remove <key>   Remove a configuration value
  llm config --clear          Clear all configuration
  llm --help                  Show this help message

${COLORS.bold}CONFIGURATION KEYS:${COLORS.reset}
  openai.endpoint             API endpoint URL
  openai.apikey               API key for authentication
  openai.model                Model to use (default: gpt-4o)
  yolomode                    Skip confirmations (true/false)
  idle.timeout                Input detection timeout in ms (default: 8000)

${COLORS.bold}EXAMPLES:${COLORS.reset}
  ${COLORS.dim}# Configure the API${COLORS.reset}
  llm config --set openai.endpoint "https://api.openai.com/v1"
  llm config --set openai.apikey "sk-..."
  llm config --set openai.model "gpt-4o"

  ${COLORS.dim}# Run a command${COLORS.reset}
  llm "convert all .png files to .jpg using ffmpeg"
  llm -y "list all files in the current directory"
`);
}

export function printAssistantMessage(content: string): void {
    const trimmed = content.trim();
    if (trimmed) {
        console.log(`\n${COLORS.cyan}${COLORS.bold}Assistant:${COLORS.reset} ${trimmed}`);
    }
}

export function printReasoning(reasoning: string): void {
    console.log(`\n${COLORS.gray}${COLORS.dim}Reasoning: ${reasoning}${COLORS.reset}`);
}

export function printToolCall(name: string, args: Record<string, unknown>): void {
    console.log(`\n${COLORS.yellow}${COLORS.bold}Tool: ${name}${COLORS.reset}`);
    if (name === "run_command") {
        console.log(`${COLORS.dim}Command:${COLORS.reset} ${args.command}`);
    } else if (name === "run_javascript") {
        console.log(`${COLORS.dim}Code:${COLORS.reset}\n${args.code}`);
    }
}

export function printToolResult(result: string, isError: boolean = false): void {
    const color = isError ? COLORS.red : COLORS.green;
    const label = isError ? "Error" : "Result";
    console.log(`${color}${label}:${COLORS.reset} ${result}`);
}

export function printError(message: string): void {
    console.error(`${COLORS.red}${COLORS.bold}Error:${COLORS.reset} ${message}`);
}

export function printSuccess(message: string): void {
    console.log(`${COLORS.green}${message}${COLORS.reset}`);
}

export function printInfo(message: string): void {
    console.log(`${COLORS.cyan}${message}${COLORS.reset}`);
}

export async function confirm(message: string): Promise<boolean> {
    process.stdout.write(`${COLORS.yellow}${message} [y/N]:${COLORS.reset} `);

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
    console.log(`\n${COLORS.magenta}${COLORS.bold}Process is waiting for input${COLORS.reset}`);
    if (reason) {
        console.log(`${COLORS.dim}Reason: ${reason}${COLORS.reset}`);
    }
}

export async function promptUserInput(message: string): Promise<string> {
    process.stdout.write(`${COLORS.cyan}${message}: ${COLORS.reset}`);

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
