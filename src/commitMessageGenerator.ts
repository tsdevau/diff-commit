import Anthropic from "@anthropic-ai/sdk"
import { window } from "vscode"
import type { CommitConfig } from "./configManager"

export class CommitMessageGenerator {
  constructor(private apiKey: string) {}

  async generateMessage(diff: string, config: CommitConfig): Promise<string | undefined> {
    const anthropic = new Anthropic({
      apiKey: this.apiKey,
    })

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

      let commitMessage = message.content
        .filter((msg) => msg.type === "text" && "text" in msg)
        .map((msg) => msg.text)
        .join("\n")
        .replace(/\n{3,}/g, "\n\n") // Replace 3 or more newlines with 2 newlines
        .replace(/(?<![\\\w])\*+[ \t]+/g, "- ") // Replace bullets occasionally output by the model with hyphens
        .trim()

      if (!commitMessage) {
        window.showWarningMessage("No commit message was generated")
        return undefined
      }

      // Replace bullets occasionally output by the model with hyphens
      return commitMessage
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
}
