#!/usr/bin/env bun

import { getConfigValue, setConfigValue, listConfig, removeConfigValue, clearConfig } from "./config";
import {
    callChatCompletion,
    createInitialMessages,
    addToolResult,
    addAssistantMessage,
    type Message,
    type ToolCall,
    type InputAnalysis,
} from "./api";
import {
    executeCommandInteractive,
    executeJavaScriptInteractive,
    type InteractiveExecutor,
} from "./executor";
import {
    printHelp,
    printAssistantMessage,
    printToolCall,
    printToolResult,
    printError,
    printSuccess,
    printWaitingForInput,
    promptUserInput,
    confirm,
} from "./ui";

async function handleConfig(args: string[]): Promise<void> {
    const subCommand = args[0];

    if (subCommand === "--set" && args.length >= 3) {
        const key = args[1] as string;
        const value = args.slice(2).join(" ");
        setConfigValue(key, value);
        printSuccess(`Set ${key} = ${value}`);
    } else if (subCommand === "--get" && args.length >= 2) {
        const key = args[1] as string;
        const value = getConfigValue(key);
        if (value !== undefined) {
            console.log(value);
        } else {
            printError(`Key "${key}" not found`);
            process.exit(1);
        }
    } else if (subCommand === "--list") {
        const config = listConfig();
        console.log(JSON.stringify(config, null, 2));
    } else if (subCommand === "--remove" && args.length >= 2) {
        const key = args[1] as string;
        if (removeConfigValue(key)) {
            printSuccess(`Removed ${key}`);
        } else {
            printError(`Key "${key}" not found`);
            process.exit(1);
        }
    } else if (subCommand === "--clear") {
        clearConfig();
        printSuccess("Configuration cleared");
    } else {
        printError("Invalid config command. Use --set, --get, --list, --remove, or --clear");
        process.exit(1);
    }
}

async function executeInteractive(
    executor: InteractiveExecutor,
    yoloMode: boolean
): Promise<{ success: boolean; output: string }> {
    return new Promise((resolve) => {
        let outputBuffer = "";
        let isResolved = false;

        const safeResolve = (result: { success: boolean; output: string }) => {
            if (!isResolved) {
                isResolved = true;
                resolve(result);
            }
        };

        executor.onOutput((data) => {
            outputBuffer += data;
            process.stdout.write(data);
        });

        executor.onWaitingForInput(async (analysis: InputAnalysis) => {
            printWaitingForInput(analysis.reason);

            if (yoloMode) {
                const input = analysis.suggestedInput || "";
                console.log(`\x1b[35mLLM suggested input: "${input}"\x1b[0m`);
                executor.sendInput(input);
            } else {
                console.log(`\x1b[90mLLM analysis: ${analysis.reason}\x1b[0m`);
                if (analysis.suggestedInput) {
                    console.log(`\x1b[90mSuggested: "${analysis.suggestedInput}"\x1b[0m`);
                }
                const userInput = await promptUserInput("Enter input for process");
                executor.sendInput(userInput);
            }
        });

        executor.onComplete((result) => {
            safeResolve({ success: result.success, output: result.output });
        });
    });
}

async function executeToolCall(
    toolCall: ToolCall,
    yoloMode: boolean
): Promise<{ success: boolean; output: string }> {
    const name = toolCall.function.name;
    const args = JSON.parse(toolCall.function.arguments);

    printToolCall(name, args);

    if (!yoloMode) {
        const shouldExecute = await confirm("Execute this?");
        if (!shouldExecute) {
            return { success: false, output: "Execution cancelled by user" };
        }
    }

    let executor: InteractiveExecutor;

    if (name === "run_command") {
        executor = executeCommandInteractive(args.command);
    } else if (name === "run_javascript") {
        executor = executeJavaScriptInteractive(args.code);
    } else {
        return { success: false, output: `Unknown tool: ${name}` };
    }

    return executeInteractive(executor, yoloMode);
}

async function runPrompt(prompt: string, yoloMode: boolean): Promise<void> {
    let messages = createInitialMessages(prompt);
    let continueLoop = true;

    while (continueLoop) {
        const response = await callChatCompletion(messages);
        const choice = response.choices[0];
        if (!choice) break;
        const message = choice.message;

        if (message.content) {
            printAssistantMessage(message.content);
        }

        if (message.tool_calls && message.tool_calls.length > 0) {
            messages = addAssistantMessage(messages, message);

            for (const toolCall of message.tool_calls) {
                const result = await executeToolCall(toolCall, yoloMode);
                printToolResult(result.output, !result.success);
                messages = addToolResult(messages, toolCall.id, result.output);
            }
        } else {
            continueLoop = false;
        }
    }
}

async function main(): Promise<void> {
    const args = process.argv.slice(2);

    if (args.length === 0 || args[0] === "--help" || args[0] === "-h") {
        printHelp();
        return;
    }

    if (args[0] === "config") {
        await handleConfig(args.slice(1));
        return;
    }

    let yoloMode = getConfigValue("yolomode") === true;
    let prompt: string | undefined;

    for (let i = 0; i < args.length; i++) {
        if (args[i] === "-y" || args[i] === "--yolo") {
            yoloMode = true;
        } else if (!prompt) {
            prompt = args[i];
        }
    }

    if (!prompt) {
        printHelp();
        return;
    }

    try {
        await runPrompt(prompt, yoloMode);
    } catch (error) {
        printError(error instanceof Error ? error.message : String(error));
        process.exit(1);
    }
}

main();
