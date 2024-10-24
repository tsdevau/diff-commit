import Anthropic from "@anthropic-ai/sdk"
import { AnthropicError } from "@anthropic-ai/sdk/error"
import * as vscode from "vscode"

const defaultModel = "claude-3-5-sonnet-20241022"
const defaultMaxTokens = 1024
const defaultTemperature = 0.4

export function activate(context: vscode.ExtensionContext) {
  const disposable = vscode.commands.registerCommand("diffCommit.generateCommitMessage", async () => {
    const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri?.fsPath
    if (!workspaceRoot) {
      vscode.window.showErrorMessage("No workspace folder found")
      return
    }

    const config = vscode.workspace.getConfiguration("diffCommit")

    // Get the Git extension
    const gitExtension = vscode.extensions.getExtension("vscode.git")?.exports
    if (!gitExtension) {
      vscode.window.showErrorMessage("Git extension not found")
      return
    }

    const git = gitExtension.getAPI(1)
    const repo = git.repositories[0]
    if (!repo) {
      vscode.window.showErrorMessage("No Git repository found")
      return
    }

    // Get the diff of staged changes
    const diff = await repo.diff(true)
    if (!diff) {
      vscode.window.showErrorMessage("No changes detected")
      return
    }

    let apiKey: string | undefined
    try {
      // Try to get existing API key from secure storage only
      apiKey = await context.secrets.get("anthropic-api-key")

      // If no key exists, prompt for it
      if (!apiKey) {
        apiKey = await vscode.window.showInputBox({
          prompt: "Enter your Anthropic API Key",
          password: true,
          placeHolder: "sk-ant-api...",
        })
        if (!apiKey) {
          vscode.window.showErrorMessage("API Key is required")
          return
        }
        if (!apiKey.startsWith("sk-ant-api")) {
          vscode.window.showErrorMessage("Invalid Anthropic API Key format. Should start with sk-ant-api")
          return
        }
        // Store the new key in SecretStorage only
        await context.secrets.store("anthropic-api-key", apiKey)
      }
    } catch (error) {
      console.error("Secrets storage error:", error)
      vscode.window.showErrorMessage("Failed to access secure storage:", JSON.stringify(error))
      return
    }

    const anthropic = new Anthropic({
      apiKey,
    })

    const prompt = `
            <task>
            Generate a detailed conventional commit message for the following Git diff:\n\n${diff}\n
            </task>
            <instructions>
            - Use 'feat' | 'fix' | 'refactor' | 'chore' | 'docs' | 'style' | 'test' | 'perf' | 'ci' as appropriate for the type of change.
            - Always include a scope.
            - Never use '!' or 'BREAKING CHANGE' in the commit message.
            - Output will use markdown formatting for lists etc.
            - Output will ONLY contain the commit message.
            - Do not include any other text or explanation in the output.
            </instructions>
            `

    try {
      const message = await anthropic.messages.create({
        model: config.get<string>("model") || defaultModel,
        max_tokens: config.get<number>("maxTokens") || defaultMaxTokens,
        temperature: config.get<number>("temperature") || defaultTemperature,
        system:
          "You are a seasoned software developer with an extraordinary gift for writing detailed conventional commit messages.",
        messages: [
          {
            role: "user",
            content: prompt,
          },
        ],
      })

      let commitMessage
      if (message.content[0].type === "text") {
        commitMessage = message.content
          .filter((msg) => msg.type === "text")
          .map((msg) => msg.text)
          .join("\n")
          .replace(/\n{3,}/g, "\n\n")
          .trim()
      }

      if (commitMessage) {
        console.log(message.stop_reason, message.usage)

        // Replace bullets occasionally output by the model with hyphens
        const processedMessage = commitMessage.replace(/\*\s/g, "- ")

        // TODO: Add some verification for format and content like starts with `type enum`, includes scope, etc.

        // Set the commit message in the repository's input box
        repo.inputBox.value = processedMessage
      }
    } catch (error) {
      if (error instanceof AnthropicError) {
        console.error("Anthropic API Error:", error)
        vscode.window.showErrorMessage(`Failed to generate commit message: ${error.message}`)
      } else {
        console.error("Unknown error:", error)
        vscode.window.showErrorMessage("Unknown error generating commit message:", JSON.stringify(error))
      }
    }
  })

  context.subscriptions.push(disposable)
}

export function deactivate() {}
