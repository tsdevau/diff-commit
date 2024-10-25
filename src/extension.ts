import Anthropic from "@anthropic-ai/sdk"
import * as vscode from "vscode"

const defaultModel = "claude-3-5-sonnet-latest"
const defaultMaxTokens = 1024
const defaultTemperature = 0.4
const defaultAllowedTypes = ["feat", "fix", "refactor", "chore", "docs", "style", "test", "perf", "ci"]

export function activate(context: vscode.ExtensionContext) {
  let previewDocument: vscode.TextDocument | undefined

  function getRepo(): any | undefined {
    const gitExtension = vscode.extensions.getExtension("vscode.git")?.exports
    if (!gitExtension) {
      vscode.window.showErrorMessage("Git extension not found")
      return undefined
    }
    const gitAPI = gitExtension.getAPI(1)
    const gitRepo = gitAPI.repositories[0]
    if (!gitRepo) {
      vscode.window.showErrorMessage("No Git repository found")
      return undefined
    }
    return gitRepo
  }

  async function setAPIKey(): Promise<string | undefined> {
    try {
      const apiKey = await vscode.window.showInputBox({
        prompt: "Enter your Anthropic API Key",
        password: true,
        placeHolder: "sk-ant-api...",
      })

      if (!apiKey) {
        vscode.window.showErrorMessage("API Key is required")
        return undefined
      }

      if (!apiKey.startsWith("sk-ant-api")) {
        vscode.window.showErrorMessage("Invalid Anthropic API Key format. Should start with sk-ant-api")
        return undefined
      }

      await context.secrets.store("anthropic-api-key", apiKey)
      vscode.window.showInformationMessage("API Key updated successfully")

      return apiKey
    } catch (error) {
      console.error("Secrets storage error:", error)
      vscode.window.showErrorMessage(
        `Failed to update API key in secure storage: ${error instanceof Error ? error.message : String(error)}`,
      )
      return undefined
    }
  }

  async function getAPIKey(): Promise<string | undefined> {
    try {
      return await context.secrets.get("anthropic-api-key")
    } catch (error) {
      console.error("Secrets storage error:", error)
      vscode.window.showErrorMessage(
        `Failed to access secure storage: ${error instanceof Error ? error.message : String(error)}`,
      )
      return undefined
    }
  }

  async function deleteAPIKey(): Promise<void> {
    try {
      const apiKey = await context.secrets.get("anthropic-api-key")
      if (!apiKey) {
        vscode.window.showWarningMessage("No API Key found to remove")
        return
      }
      await context.secrets.delete("anthropic-api-key")
      vscode.window.showInformationMessage("API Key deleted successfully")
    } catch (error) {
      console.error("Secrets storage error:", error)
      vscode.window.showErrorMessage(
        `Failed to delete API key from secure storage: ${error instanceof Error ? error.message : String(error)}`,
      )
    }
  }

  async function generateCommitMessage(): Promise<string | undefined> {
    const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri?.fsPath
    if (!workspaceRoot) {
      vscode.window.showErrorMessage("No workspace folder found")
      return undefined
    }

    const config = vscode.workspace.getConfiguration("diffCommit")

    const gitRepo = getRepo()
    if (!gitRepo) {
      return undefined
    }

    const diff = await gitRepo.diff(true)
    if (!diff) {
      vscode.window.showErrorMessage("No changes detected")
      return undefined
    }

    const apiKey = (await getAPIKey()) ?? (await setAPIKey())
    if (!apiKey) {
      vscode.window.showErrorMessage("API Key is required")
      return undefined
    }

    const anthropic = new Anthropic({
      apiKey,
    })

    const customInstructions = config.get<string>("customInstructions") || undefined
    const allowedTypes = config.get<string[]>("allowedTypes") || defaultAllowedTypes
    const model = config.get<string>("model") || defaultModel
    const maxTokens = config.get<number>("maxTokens") || defaultMaxTokens
    const temperature = config.get<number>("temperature") || defaultTemperature
    const systemPrompt =
      "You are a seasoned software developer with an extraordinary ability for writing detailed conventional commit messages and following 'instructions' and 'customInstructions' when generating them."
    const prompt = `
      <task>
      Generate a detailed conventional commit message for the following Git diff:

      ${diff}
      </task>
      <instructions>
      - Use ONLY ${allowedTypes.map((val) => `'${val}'`).join(" | ")} as appropriate for the type of change.
      - Always include a scope.
      - Never use '!' or 'BREAKING CHANGE' in the commit message.
      - Output will use markdown formatting for lists etc.
      - Output will ONLY contain the commit message.
      - Do not include any other text or explanation in the output.
      </instructions>
      ${customInstructions ? `<customInstructions>\n${customInstructions}\n</customInstructions>` : ""}
      `.trim()

    let message: Anthropic.Message | undefined = undefined
    try {
      message = await anthropic.messages.create({
        model,
        max_tokens: maxTokens,
        temperature,
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
      return undefined
    } finally {
      console.log("[DiffCommit] Stop Reason: ", message?.stop_reason)
      console.log("[DiffCommit] Usage: ", message?.usage)
    }
  }

  // Register all commands
  const cmdUpdateAPIKey = vscode.commands.registerCommand("diffCommit.updateAPIKey", setAPIKey)
  const cmdGetAPIKey = vscode.commands.registerCommand("diffCommit.getAPIKey", getAPIKey)
  const cmdDeleteAPIKey = vscode.commands.registerCommand("diffCommit.deleteAPIKey", deleteAPIKey)
  const cmdGenerateCommitMessage = vscode.commands.registerCommand("diffCommit.generateCommitMessage", async () => {
    try {
      const commitMessage = await generateCommitMessage()
      if (!commitMessage) {
        return
      }

      // Set the commit message in the repository's input box
      const gitRepo = getRepo()
      if (!gitRepo) {
        return
      }
      gitRepo.inputBox.value = commitMessage
    } catch (error) {
      console.error("Error writing commit message to SCM:", error)
      vscode.window.showErrorMessage(
        `Failed to write to SCM: ${error instanceof Error ? error.message : String(error)}`,
      )
    }
  })

  const cmdPreviewCommitMessage = vscode.commands.registerCommand("diffCommit.previewCommitMessage", async () => {
    try {
      const commitMessage = await generateCommitMessage()
      if (!commitMessage) {
        return
      }

      previewDocument = await vscode.workspace.openTextDocument({
        content: commitMessage,
        language: "markdown",
      })
      await vscode.window.showTextDocument(previewDocument)
    } catch (error) {
      console.error("Error opening commit message preview:", error)
      vscode.window.showErrorMessage(
        `Failed to open commit message preview: ${error instanceof Error ? error.message : String(error)}`,
      )
    }
  })

  const onSave = vscode.workspace.onDidSaveTextDocument((document: vscode.TextDocument) => {
    if (document === previewDocument) {
      const gitRepo = getRepo()
      if (gitRepo) {
        gitRepo.inputBox.value = document.getText()
      }
    }
  })

  const onClose = vscode.workspace.onDidCloseTextDocument((document: vscode.TextDocument) => {
    if (document === previewDocument) {
      previewDocument = undefined
    }
  })

  // Push all commands and listeners to subscriptions
  context.subscriptions.push(
    cmdGenerateCommitMessage,
    cmdPreviewCommitMessage,
    cmdUpdateAPIKey,
    cmdGetAPIKey,
    cmdDeleteAPIKey,
    onSave,
    onClose,
  )
}

export function deactivate() {}
