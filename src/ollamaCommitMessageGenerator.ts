import { window } from "vscode"
import type { CommitConfig } from "./configManager"

interface OllamaResponse {
  model: string
  created_at: string
  response: string
  done: boolean
}

export class OllamaCommitMessageGenerator {
  constructor(
    private hostname: string,
    private modelName: string,
  ) {}

  async generateMessage(diff: string, config: CommitConfig): Promise<string | undefined> {
    const systemPrompt =
      "You are a seasoned software engineer with more than 25 years of experience with an extraordinary ability for assessing and interpreting git diffs and writing detailed conventional commit messages and following 'instructions' and 'customInstructions' when generating them."

    const prompt = `
<task>
Generate a detailed conventional commit message for the following Git diff:

${diff}
</task>
<instructions>
- Use ONLY ${config.allowedTypes.map((val) => `'${val}'`).join(" | ")} as appropriate for the type of change.
- When assessing the commit type, consider actual impact of the commit. Refer to the "type-table" below for further guidance on the default commit types.
- Always include a scope.
- Never use '!' or 'BREAKING CHANGE' in the commit message.
- Avoid unnecessary and excessive adjectives use. (eg 'enhance', 'comprehensive', etc.)
- Output will use markdown formatting for lists etc.
- Output will ONLY contain the commit message.
- Do not explain the output.
- "customInstructions" override these instructions if they are provided and conflict.

<type-table>
\`\`\`markdown
| Commit Type | Typical Use Case                   | When to Use                                                                                                                                                             |
| ----------- | ---------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| chore       | Routine maintenance or updates     | Use when updating configs or non-code changes. (eg updating dependencies, modifying configs, updating types, etc.)                                                      |
| ci          | Continuous integration adjustments | Use when updating CI/CD config files. (eg GitHub Actions, Workflows, Pipelines, etc.)                                                                                   |
| docs        | Documentation-only changes         | Use only when updating or adding documentation, comments, or README files. (Do NOT use when adding or updating page content in web apps. eg Astro content collections.) |
| feat        | New feature                        | Use only when adding new, user-facing feature or functionality or a fundamental change in an existing feature's functionality.                                          |
| fix         | Bug fix                            | Use when fixing a bug or issue in code that may or may not affect functionality.                                                                                        |
| perf        | Performance improvement            | Use when improving performance. (eg by optimising code.)                                                                                                                |
| refactor    | Code restructuring                 | Use when restructuring code without changing functionality or fixing bugs. (This can include significant code changes like abstracting code to its own component.)      |
| style       | Code formatting or styling         | Use when code changes do not affect functionality. (eg linting, formatting adjustments, colour, margin, padding, etc.)                                                  |
| test        | Adding or updating tests           | Use when adding, updating, or removing tests.                                                                                                                           |
\`\`\`
</type-table>
</instructions>
${config.customInstructions ? `<customInstructions>\n${config.customInstructions}\n</customInstructions>` : ""}

System prompt: ${systemPrompt}
`.trim()

    try {
      const requestBody = {
        model: this.modelName,
        prompt: prompt,
        stream: false,
        options: {
          temperature: config.temperature,
          num_predict: config.maxTokens,
        },
      }

      console.log(`[DiffCommit] Making request to Ollama at ${this.hostname}/api/generate`)

      const response = await fetch(`${this.hostname}/api/generate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      })

      if (!response.ok) {
        throw new Error(`Ollama API request failed: ${response.status} ${response.statusText}`)
      }

      const data: OllamaResponse = await response.json()

      let commitMessage = data.response
        .replace(/\n{3,}/g, "\n\n") // Replace 3 or more newlines with 2 newlines
        .replace(/(?<![\\\w])\*+[ \t]+/g, "- ") // Replace bullets occasionally output by the model with hyphens
        .trim()

      if (!commitMessage) {
        window.showWarningMessage("No commit message was generated")
        return undefined
      }

      console.log("[DiffCommit] Ollama response received")
      return commitMessage
    } catch (error) {
      this.handleError(error)
      return undefined
    }
  }

  private handleError(error: unknown): void {
    console.error(`Ollama API Error:\n\n${error}`)

    if (error instanceof TypeError && error.message.includes("fetch")) {
      window.showErrorMessage(
        `Unable to connect to Ollama server at ${this.hostname}. Please ensure that the Ollama server is running and accessible.`,
      )
    } else if (error instanceof Error) {
      if (error.message.includes("404")) {
        window.showErrorMessage(
          `Model '${this.modelName}' not found. Please check if the model is available in Ollama.`,
        )
      } else if (error.message.includes("500")) {
        window.showErrorMessage("Ollama server error. Please try again later.")
      } else {
        window.showErrorMessage(`Failed to generate commit message with Ollama:\n\n${error.message}`)
      }
    } else {
      window.showErrorMessage(
        `Unknown error generating commit message with Ollama: ${error instanceof Error ? error.message : String(error)}`,
      )
    }
  }
}
