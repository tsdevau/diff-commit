import Anthropic from "@anthropic-ai/sdk"
import * as vscode from "vscode"
import { CommitConfig } from "./configManager"

export class CommitMessageGenerator {
  constructor(private apiKey: string) {}

  async generateMessage(diff: string, config: CommitConfig): Promise<string | undefined> {
    const anthropic = new Anthropic({
      apiKey: this.apiKey,
    })

    const systemPrompt =
      "You are a seasoned software developer with an extraordinary ability for writing detailed conventional commit messages and following 'instructions' and 'customInstructions' when generating them."

    const prompt = `
      <task>
      Generate a detailed conventional commit message for the following Git diff:

      ${diff}
      </task>
      <instructions>
      - Use ONLY ${config.allowedTypes.map((val) => `'${val}'`).join(" | ")} as appropriate for the type of change.
      - Always include a scope.
      - Never use '!' or 'BREAKING CHANGE' in the commit message.
      - Output will use markdown formatting for lists etc.
      - Output will ONLY contain the commit message.
      - Do not include any other text or explanation in the output.
      </instructions>
      ${config.customInstructions ? `<customInstructions>\n${config.customInstructions}\n</customInstructions>` : ""}
      `.trim()

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

      let commitMessage: string | undefined
      commitMessage = message.content
        .filter((msg) => msg.type === "text" && "text" in msg)
        .map((msg) => msg.text)
        .join("\n")
        .replace(/\n{3,}/g, "\n\n")
        .trim()

      if (!commitMessage) {
        vscode.window.showWarningMessage("No commit message was generated")
        return undefined
      }

      // Replace bullets occasionally output by the model with hyphens
      return commitMessage.replace(/\*\s/g, "- ")
    } catch (error) {
      this.handleError(error)
      return undefined
    } finally {
      console.log("[DiffCommit] Stop Reason: ", message?.stop_reason)
      console.log("[DiffCommit] Usage: ", message?.usage)
    }
  }

  private handleError(error: unknown): void {
    if (error instanceof Anthropic.APIError) {
      const errorMessage = error.message || "Unknown Anthropic API error"
      console.error(`Anthropic API Error (${error.status}):`, errorMessage)

      switch (error.status) {
        case 400:
          vscode.window.showErrorMessage("Bad request. Review your prompt and try again.")
          break
        case 401:
          vscode.window.showErrorMessage("Invalid API key. Please update your API key and try again.")
          break
        case 403:
          vscode.window.showErrorMessage("Permission Denied. Review your prompt or API key and try again.")
          break
        case 429:
          vscode.window.showErrorMessage(`Rate limit exceeded. Please try again later: ${errorMessage}`)
          break
        case 500:
          vscode.window.showErrorMessage("Anthropic API server error. Please try again later.")
          break
        default:
          vscode.window.showErrorMessage(`Failed to generate commit message: ${errorMessage}`)
          break
      }
    } else {
      console.error(`Unknown error: ${error instanceof Error ? error.message : String(error)}`)
      vscode.window.showErrorMessage(
        `Unknown error generating commit message: ${error instanceof Error ? error.message : String(error)}`,
      )
    }
  }
}
