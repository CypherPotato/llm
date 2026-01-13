# llm

AI-powered command-line tool for executing shell commands and JavaScript code using natural language.

[![Bun](https://img.shields.io/badge/Bun-1.3.5+-black?logo=bun)](https://bun.sh)
[![License](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![NPM](https://img.shields.io/badge/npm-@cypherpotato/llm-red?logo=npm)](https://www.npmjs.com/package/@cypherpotato/llm)

---

## Table of Contents

- [About](#about)
- [Features](#features)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Configuration](#configuration)
- [Usage](#usage)
- [License](#license)

---

## About

LLM CLI is a cross-platform command-line tool that leverages OpenAI-compatible APIs to execute tasks on your computer using natural language prompts. It can run shell commands (PowerShell on Windows, sh on Linux/macOS) and JavaScript/TypeScript code through Bun runtime.

### Tech Stack

- **Runtime**: [Bun](https://bun.sh) - Fast JavaScript/TypeScript runtime
- **Language**: TypeScript
- **API**: OpenAI-compatible chat completions

---

## Features

- **Natural Language Interface** - Describe what you want to do in plain English
- **Cross-Platform** - Works on Windows (PowerShell), Linux, and macOS (sh)
- **JavaScript Execution** - Run JavaScript/TypeScript code using Bun
- **Interactive Processes** - Detects when processes wait for input using LLM analysis
- **Yolo Mode** - Skip confirmations for faster execution
- **Configurable** - Easy API and behavior configuration

---

## Installation

### From NPM (Global)

```bash
npm install -g @cypherpotato/llm
```

### From Source

```bash
git clone https://github.com/cypherpotato/llm.git
cd llm
bun install
bun run build
```

---

## Configuration

Before using, configure your API credentials:

```bash
# Set API endpoint
llm config --set openai.endpoint "https://api.openai.com/v1"

# Set API key
llm config --set openai.apikey "sk-..."

# Set model (optional, defaults to gpt-4o)
llm config --set openai.model "gpt-4o"
```

### Configuration Commands

| Command | Description |
|---------|-------------|
| `llm config --set <key> <value>` | Set a configuration value |
| `llm config --get <key>` | Get a configuration value |
| `llm config --list` | List all configuration values |
| `llm config --remove <key>` | Remove a configuration value |
| `llm config --clear` | Clear all configuration |

### Configuration Keys

| Key | Description | Default |
|-----|-------------|---------|
| `openai.endpoint` | API endpoint URL | - |
| `openai.apikey` | API key for authentication | - |
| `openai.model` | Model to use | `gpt-4o` |
| `yolomode` | Skip confirmations globally | `false` |
| `idle.timeout` | Input detection timeout (ms) | `8000` |

---

## Usage

### Basic Usage

```bash
# Execute a task with natural language
llm "list all files in the current directory"

# Convert files using ffmpeg
llm "convert all .png files to .jpg using ffmpeg"

# Run with yolo mode (skip confirmations)
llm -y "create a hello.txt file with 'Hello World' content"
```

### Yolo Mode

Yolo mode skips confirmation prompts, allowing for faster automated execution:

```bash
# Per-command yolo mode
llm -y "your prompt"
llm --yolo "your prompt"

# Enable globally
llm config --set yolomode true
```

### Interactive Processes

When a command waits for user input, LLM CLI automatically detects it and:
- In **normal mode**: Shows the analysis and prompts you for input
- In **yolo mode**: Automatically sends the LLM's suggested input

## License

MIT © [cypherpotato](https://github.com/cypherpotato)
