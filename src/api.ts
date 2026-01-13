import { getConfigValue } from "./config";
import { getSystemContext } from "./executor";

interface ToolDefinition {
    type: "function";
    function: {
        name: string;
        description: string;
        parameters: {
            type: "object";
            properties: Record<string, { type: string; description: string }>;
            required: string[];
        };
    };
}

interface Message {
    role: "system" | "user" | "assistant" | "tool";
    content: string | null;
    tool_calls?: ToolCall[];
    tool_call_id?: string;
}

interface ToolCall {
    id: string;
    type: "function";
    function: {
        name: string;
        arguments: string;
    };
}

interface ChatResponse {
    choices: {
        message: Message;
        finish_reason: string;
    }[];
}

const TOOLS: ToolDefinition[] = [
    {
        type: "function",
        function: {
            name: "run_command",
            description:
                "Execute a shell command. On Windows, commands run in PowerShell. On Linux/macOS, commands run in sh. Use standard commands like: Get-Content/cat for reading files, Get-ChildItem/ls for listing directories, etc.",
            parameters: {
                type: "object",
                properties: {
                    command: {
                        type: "string",
                        description: "The shell command to execute (PowerShell on Windows, sh on Linux/macOS)",
                    },
                },
                required: ["command"],
            },
        },
    },
    {
        type: "function",
        function: {
            name: "run_javascript",
            description:
                "Execute JavaScript/TypeScript code using Bun. The code runs as a standalone script file. You can use ES modules (import) or CommonJS (require). Console output is captured.",
            parameters: {
                type: "object",
                properties: {
                    code: {
                        type: "string",
                        description: "Complete JavaScript or TypeScript code to execute as a Bun script",
                    },
                },
                required: ["code"],
            },
        },
    },
];

function buildSystemPrompt(): string {
    return `You are an AI assistant that helps users execute tasks on their computer.

TOOLS AVAILABLE:
1. run_command - Execute shell commands (PowerShell on Windows, sh on Linux/macOS)
2. run_javascript - Execute JavaScript/TypeScript code using Bun

IMPORTANT GUIDELINES:
- On Windows, use PowerShell syntax: Get-Content, Get-ChildItem, cat, ls, etc.
- Do NOT use CMD-only commands like "type" on Windows
- Do NOT use bash-specific syntax like ":;" 
- Do NOT prefix commands with ">" or "$" - just provide the raw command
- For JavaScript, write complete standalone scripts
- Always explain what you're going to do before executing
- Be cautious with destructive operations

${getSystemContext()}`;
}

export async function callChatCompletion(messages: Message[]): Promise<ChatResponse> {
    const endpoint = getConfigValue("openai.endpoint") as string;
    const apiKey = getConfigValue("openai.apikey") as string;
    const model = (getConfigValue("openai.model") as string) || "gpt-4o";

    if (!endpoint) {
        throw new Error("API endpoint not configured. Run: llm config --set openai.endpoint <url>");
    }
    if (!apiKey) {
        throw new Error("API key not configured. Run: llm config --set openai.apikey <key>");
    }

    const url = endpoint.endsWith("/") ? `${endpoint}chat/completions` : `${endpoint}/chat/completions`;

    const response = await fetch(url, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
            model,
            messages,
            tools: TOOLS,
            tool_choice: "auto",
        }),
    });

    if (!response.ok) {
        const error = await response.text();
        throw new Error(`API request failed: ${response.status} - ${error}`);
    }

    return response.json() as Promise<ChatResponse>;
}

export function createInitialMessages(prompt: string): Message[] {
    return [
        { role: "system", content: buildSystemPrompt() },
        { role: "user", content: prompt },
    ];
}

export function addToolResult(messages: Message[], toolCallId: string, result: string): Message[] {
    return [
        ...messages,
        {
            role: "tool",
            content: result,
            tool_call_id: toolCallId,
        },
    ];
}

export function addAssistantMessage(messages: Message[], message: Message): Message[] {
    return [...messages, message];
}

interface InputAnalysis {
    waitingForInput: boolean;
    suggestedInput: string;
    reason: string;
}

const INPUT_ANALYSIS_SCHEMA = {
    type: "object" as const,
    properties: {
        waitingForInput: {
            type: "boolean",
            description: "Whether the process appears to be waiting for user input",
        },
        suggestedInput: {
            type: "string",
            description:
                "If waitingForInput is true, the suggested input to send. For yes/no prompts use 'y' or 'n'. Leave empty if unsure.",
        },
        reason: {
            type: "string",
            description: "Brief explanation of why you think the process is or isn't waiting for input",
        },
    },
    required: ["waitingForInput", "suggestedInput", "reason"],
    additionalProperties: false,
};

export async function analyzeProcessOutput(processOutput: string): Promise<InputAnalysis> {
    const endpoint = getConfigValue("openai.endpoint") as string;
    const apiKey = getConfigValue("openai.apikey") as string;
    const model = (getConfigValue("openai.model") as string) || "gpt-4o";

    if (!endpoint || !apiKey) {
        return { waitingForInput: false, suggestedInput: "", reason: "API not configured" };
    }

    const url = endpoint.endsWith("/") ? `${endpoint}chat/completions` : `${endpoint}/chat/completions`;

    const messages = [
        {
            role: "system",
            content: `You analyze terminal output to determine if a process is waiting for user input.
Common signs of waiting for input:
- Prompts ending with ?, :, or >
- Requests for passwords, usernames, confirmations
- [y/n], [yes/no], or similar choice prompts
- "Press any key", "Enter to continue"
- The output stopped mid-sentence or at a prompt

Signs NOT waiting for input:
- Process is still running/loading (progress bars, spinners)
- Output ended with a complete message
- Error messages that don't ask for action`,
        },
        {
            role: "user",
            content: `Analyze this terminal output and determine if the process is waiting for input:\n\n"""\n${processOutput.slice(-2000)}\n"""`,
        },
    ];

    try {
        const response = await fetch(url, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
                model,
                messages,
                response_format: {
                    type: "json_schema",
                    json_schema: {
                        name: "input_analysis",
                        strict: true,
                        schema: INPUT_ANALYSIS_SCHEMA,
                    },
                },
            }),
        });

        if (!response.ok) {
            return { waitingForInput: false, suggestedInput: "", reason: "API error" };
        }

        const data = (await response.json()) as ChatResponse;
        const content = data.choices[0]?.message?.content;

        if (content) {
            return JSON.parse(content) as InputAnalysis;
        }
    } catch {
        return { waitingForInput: false, suggestedInput: "", reason: "Parse error" };
    }

    return { waitingForInput: false, suggestedInput: "", reason: "No response" };
}

export type { Message, ToolCall, ChatResponse, InputAnalysis };

