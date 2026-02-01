const CHARS_PER_TOKEN = 4;

export function truncateOutput(output: string, maxTokens: number): string {
    const maxChars = maxTokens * CHARS_PER_TOKEN;

    if (output.length <= maxChars) {
        return output;
    }

    const charsToKeep = Math.floor(maxChars / 2);
    const numCharsTruncated = output.length - (charsToKeep * 2);

    const start = output.slice(0, charsToKeep);
    const end = output.slice(-charsToKeep);

    return `${start}\n\n[${numCharsTruncated} chars truncated]\n\n${end}`;
}
