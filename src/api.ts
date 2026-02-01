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

type TextContentPart = {
    type: "text";
    text: string;
};

type ImageContentPart = {
    type: "image_url";
    image_url: {
        url: string;
        detail?: "low" | "high" | "auto";
    };
};

type InputAudioContentPart = {
    type: "input_audio";
    input_audio: {
        data: string;
        format: "wav" | "mp3";
    };
};

type ContentPart = TextContentPart | ImageContentPart | InputAudioContentPart;

interface Message {
    role: "system" | "user" | "assistant" | "tool";
    content: string | ContentPart[] | null;
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
    {
        type: "function",
        function: {
            name: "read_media",
            description:
                "Read media files such as PDF documents, images (PNG, JPG, JPEG, GIF, WEBP, BMP, SVG), audio files (MP3, WAV, OGG, FLAC, M4A), and video files (MP4, WEBM, AVI, MOV, MKV). Returns the file content encoded in base64. Only these file types are allowed.",
            parameters: {
                type: "object",
                properties: {
                    path: {
                        type: "string",
                        description: "Absolute path to the media file to read",
                    },
                },
                required: ["path"],
            },
        },
    },
];

function buildSystemPrompt(): string {
    return `You are an AI assistant that helps users execute tasks on their computer.

TOOLS AVAILABLE:
1. run_command - Execute shell commands (PowerShell on Windows, sh on Linux/macOS)
2. run_javascript - Execute JavaScript/TypeScript code using Bun
3. read_media - Read PDF documents, images, audio, and video files (returns base64 content)

IMPORTANT GUIDELINES:
- On Windows, use PowerShell syntax: Get-Content, Get-ChildItem, cat, ls, etc.
- Do NOT use CMD-only commands like "type" on Windows
- Do NOT use bash-specific syntax like ":;" 
- Do NOT prefix commands with ">" or "$" - just provide the raw command
- For JavaScript, write complete standalone scripts
- Always explain what you're going to do before executing
- Be cautious with destructive operations
- read_media only supports: PDF, images (PNG, JPG, JPEG, GIF, WEBP, BMP, SVG), audio (MP3, WAV, OGG, FLAC, M4A), and video (MP4, WEBM, AVI, MOV, MKV)

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

export interface MediaContent {
    base64: string;
    mimeType: string;
}

function getMediaType(mimeType: string): "image" | "audio" | "video" | "document" {
    if (mimeType.startsWith("image/")) return "image";
    if (mimeType.startsWith("audio/")) return "audio";
    if (mimeType.startsWith("video/")) return "video";
    return "document";
}

function getAudioFormat(mimeType: string): "wav" | "mp3" {
    if (mimeType.includes("wav")) return "wav";
    return "mp3";
}

export function addMediaToolResult(
    messages: Message[],
    toolCallId: string,
    media: MediaContent
): Message[] {
    const mediaType = getMediaType(media.mimeType);
    const dataUrl = `data:${media.mimeType};base64,${media.base64}`;

    const toolMessage: Message = {
        role: "tool",
        content: `[Media file loaded: ${media.mimeType}]`,
        tool_call_id: toolCallId,
    };

    let contentParts: ContentPart[];

    if (mediaType === "image") {
        contentParts = [
            { type: "text", text: "Here is the media file I just read:" },
            { type: "image_url", image_url: { url: dataUrl, detail: "auto" } },
        ];
    } else if (mediaType === "audio") {
        contentParts = [
            { type: "text", text: "Here is the audio file I just read:" },
            {
                type: "input_audio",
                input_audio: {
                    data: media.base64,
                    format: getAudioFormat(media.mimeType),
                },
            },
        ];
    } else {
        contentParts = [
            {
                type: "text",
                text: `Here is the file content (${media.mimeType}, base64 encoded):\n${media.base64}`,
            },
        ];
    }

    const userMessage: Message = {
        role: "user",
        content: contentParts,
    };

    return [...messages, toolMessage, userMessage];
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
            content: `Analyze this terminal output and determine if the process is waiting for input:\n\n"""\n${processOutput}\n"""`,
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

        if (content && typeof content === "string") {
            return JSON.parse(content) as InputAnalysis;
        }
    } catch {
        return { waitingForInput: false, suggestedInput: "", reason: "Parse error" };
    }

    return { waitingForInput: false, suggestedInput: "", reason: "No response" };
}

export type { Message, ToolCall, ChatResponse, InputAnalysis, ContentPart };

