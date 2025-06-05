import Anthropic from "@anthropic-ai/sdk"
import {
  Ollama,
  type GenerateRequest as OllamaGenerateRequest,
  type GenerateResponse as OllamaGenerateResponse,
} from "ollama"
import { window } from "vscode"
import type { CommitConfig } from "./configManager"

export class CommitMessageGenerator {
  private apiKey: string | undefined
  private ollamaModel: string | undefined
  private ollamaHost: string | undefined

  // Constructor overload for Anthropic (API key only)
  constructor(apiKey: string)
  // Constructor overload for Ollama (hostname and model)
  constructor(hostname: string, ollamaModel: string)
  // Implementation
  constructor(...args: [string] | [string, string]) {
    try {
      if (args.length === 1 && args[0] && typeof args[0] === "string" && args[0].startsWith("sk-")) {
        // Anthropic constructor
        this.apiKey = args[0]
      } else if (
        args.length === 2 &&
        args[0] &&
        typeof args[0] === "string" &&
        args[0].startsWith("http") &&
        args[1] &&
        typeof args[1] === "string"
      ) {
        // Ollama constructor
        this.ollamaHost = args[0]
        this.ollamaModel = args[1]
      } else {
        throw new Error(
          "Invalid constructor arguments. Configure either an API key for Anthropic or a hostname and model for Ollama.",
        )
      }
    } catch (error) {
      console.error("Error initializing CommitMessageGenerator:", error)
      window.showErrorMessage("Failed to initialize CommitMessageGenerator. Please check your configuration.")
      throw error
    }
  }

  async generateMessage(diff: string, config: CommitConfig): Promise<string | undefined> {
    if (config.provider === "ollama") {
      return this.generateOllamaMessage(diff, config)
    } else {
      return this.generateAnthropicMessage(diff, config)
    }
  }

  private async generateAnthropicMessage(diff: string, config: CommitConfig): Promise<string | undefined> {
    const anthropic = new Anthropic({
      apiKey: this.apiKey,
    })

    const { systemPrompt, prompt } = this.buildPrompts(diff, config)

    let message: Anthropic.Message | undefined = undefined
    try {
      message = await anthropic.messages.create({
        model: config.model,
        max_tokens: config.maxTokens,
        temperature: config.temperature,
        system: systemPrompt,
        messages: [
          {
            role: "user",
            content: prompt,
          },
        ],
      })

      const commitMessage = this.processAnthropicResponse(message)

      if (!commitMessage) {
        window.showWarningMessage("No commit message was generated")
        return undefined
      }

      return commitMessage
    } catch (error) {
      this.handleAnthropicError(error)
      return undefined
    } finally {
      console.log("[DiffCommit] Stop Reason: ", message?.stop_reason)
      console.log("[DiffCommit] Input Tokens: ", message?.usage.input_tokens)
      console.log("[DiffCommit] Cache Creation Tokens: ", message?.usage.cache_creation_input_tokens)
      console.log("[DiffCommit] Cache Read Tokens: ", message?.usage.cache_read_input_tokens)
      console.log("[DiffCommit] Output Tokens: ", message?.usage.output_tokens)
    }
  }

  private async generateOllamaMessage(diff: string, config: CommitConfig): Promise<string | undefined> {
    if (!this.ollamaModel) {
      window.showErrorMessage("Ollama model not specified")
      return undefined
    }

    let response: OllamaGenerateResponse | undefined = undefined
    const { systemPrompt, prompt } = this.buildPrompts(diff, config, true)
    const ollama = new Ollama({
      host: this.ollamaHost,
    })
    const requestBody: OllamaGenerateRequest & { stream: false } = {
      model: this.ollamaModel,
      system: systemPrompt,
      prompt: prompt,
      think: false,
      stream: false,
      options: {
        temperature: config.temperature,
        num_predict: config.maxTokens,
      },
    }

    console.log(`[DiffCommit] Making request to Ollama at ${this.ollamaHost}/api/generate`)
    try {
      response = await ollama.generate(requestBody)

      const commitMessage = this.normaliseResponseText(response.response)

      if (!commitMessage) {
        window.showWarningMessage("No commit message was generated")
        return undefined
      } else if (commitMessage && !response.done) {
        window.showWarningMessage(
          "Ollama response was marked as incomplete. Review the commit message and ensure it meets your requirements.",
        )
        return commitMessage
      }

      return commitMessage
    } catch (error) {
      this.handleOllamaError(error)
      return undefined
    } finally {
      console.log("[DiffCommit] Ollama Stop Reason: ", response?.done_reason)
      console.log("[DiffCommit] Ollama Input Tokens: ", response?.prompt_eval_count)
      console.log("[DiffCommit] Ollama Output Tokens: ", response?.eval_count)
    }
  }

  private buildPrompts(
    diff: string,
    config: CommitConfig,
    isIdiotOllamaModel: boolean = false,
  ): { systemPrompt: string; prompt: string } {
    const systemPrompt =
      "You are a seasoned software engineer with more than 25 years of experience with an extraordinary ability for assessing and interpreting git diffs and writing detailed conventional commit messages and following 'instructions' and 'customInstructions' when generating them."

    const idiotOllamaAdditionalInstructions = `- Follow the following 'commit-format' strictly, where anything surrounded by << and >> is a placeholder that should be replaced with the actual content.

`
    const idiotOllamaCommitFormat = `<commit-format>
<<type>>(<<scope>>): <<commit message summary line to a max of 100 characters>>

<<commit body as a list or paragraph summary of the changes if required>>
</commit-format>

`
    const prompt = `
<task>
Generate a detailed conventional commit message summarising the following Git diff:

${diff}
</task>
<instructions>
- Use ONLY ${config.allowedTypes.map((val) => `'${val}'`).join(" | ")} as appropriate for the type of change.
- When assessing the commit type, consider actual impact of the commit. Refer to the "type-table" below for further guidance on the default commit types.
- ALWAYS infer and include a scope.
- Never use '!' or 'BREAKING CHANGE' in the commit message.
- Avoid unnecessary and excessive adjectives use. (eg 'enhance', 'comprehensive', etc.)
- 'customInstructions' override any conflicting instructions if they are provided.
- Your response MUST include ONLY the commit message - NOTHING ELSE!
- Use plain text output with markdown-like list formatting for lists etc.
${isIdiotOllamaModel ? idiotOllamaAdditionalInstructions : ""}
${isIdiotOllamaModel ? idiotOllamaCommitFormat : ""}

<type-table>
\`\`\`markdown
| Commit Type | When to Use                                                                                                                                                             |
| ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| chore       | Use when updating configs or non-code changes. (eg updating dependencies, modifying configs, updating types, etc.)                                                      |
| ci          | Use when updating CI/CD config files. (eg GitHub Actions, Workflows, Pipelines, etc.)                                                                                   |
| docs        | Use only when updating or adding documentation, comments, or README files. (Do NOT use when adding or updating page content in web apps. eg Astro content collections.) |
| feat        | Use only when adding new, user-facing feature or functionality or a fundamental change in an existing feature's functionality.                                          |
| fix         | Use when fixing a bug or issue in code that may or may not affect functionality.                                                                                        |
| perf        | Use when improving performance. (eg by optimising code.)                                                                                                                |
| refactor    | Use when restructuring code without changing functionality or fixing bugs. (This can include significant code changes like abstracting code to its own component.)      |
| style       | Use when code changes do not affect functionality. (eg linting, formatting adjustments, colour, margin, padding, etc.)                                                  |
| test        | Use when adding, updating, or removing tests.                                                                                                                           |
\`\`\`
</type-table>
</instructions>
${config.customInstructions ? `<customInstructions>\n${config.customInstructions}\n</customInstructions>` : ""}
`.trim()

    return { systemPrompt, prompt }
  }

  private processAnthropicResponse(message: Anthropic.Message): string {
    return this.normaliseResponseText(
      message.content
        .filter((msg) => msg.type === "text" && "text" in msg)
        .map((msg) => msg.text)
        .join("\n"),
    )
  }

  private normaliseResponseText(text: string): string {
    return text
      .replace(/\`\`\`.*?\n?/g, "") // Remove code block markers if present
      .replace(/\n{3,}/g, "\n\n") // Replace 3 or more newlines with 2 newlines
      .replace(/(?<![\\\w])\*+[ \t]+/g, "- ") // Replace bullets occasionally output by the model with hyphens
      .trim()
  }

  private handleAnthropicError(error: unknown): void {
    if (error instanceof Anthropic.APIError) {
      const errorMessage = error.message || "Unknown Anthropic API error"
      console.error(`Anthropic API Error (${error.status}):\n\n${errorMessage}`)

      switch (error.status) {
        case 400:
          window.showErrorMessage("Bad request. Review your prompt and try again.")
          break
        case 401:
          window.showErrorMessage("Invalid API key. Please update your API key and try again.")
          break
        case 403:
          window.showErrorMessage("Permission Denied. Review your prompt or API key and try again.")
          break
        case 429:
          window.showErrorMessage(`Rate limit exceeded. Please try again later:\n\n${errorMessage}`)
          break
        case 500:
          window.showErrorMessage("Anthropic API server error. Please try again later.")
          break
        default:
          window.showErrorMessage(`Failed to generate commit message:\n\n${errorMessage}`)
          break
      }
    } else {
      console.error(`Unknown error: ${error instanceof Error ? error.message : String(error)}`)
      window.showErrorMessage(
        `Unknown error generating commit message: ${error instanceof Error ? error.message : String(error)}`,
      )
    }
  }

  private handleOllamaError(error: unknown): void {
    console.error(`Ollama API Error:\n\n${error}`)

    if (error instanceof TypeError && error.message.includes("fetch")) {
      window.showErrorMessage(
        `Unable to connect to Ollama server at ${this.ollamaHost}. Please ensure that the Ollama server is running and accessible.`,
      )
    } else if (error instanceof Error) {
      if (error.message.includes("404")) {
        window.showErrorMessage(
          `Model '${this.ollamaModel}' not found. Please check if the model is available in Ollama.`,
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
