import { commands, window, workspace, type ExtensionContext, type TextDocument } from "vscode"
import { APIKeyManager } from "./apiKeyManager"
import { CommitMessageGenerator } from "./commitMessageGenerator"
import { ConfigManager } from "./configManager"
import { GitManager } from "./gitManager"

export function activate(context: ExtensionContext) {
  let previewDocument: TextDocument | undefined

  const apiKeyManager = new APIKeyManager(context)
  const gitManager = new GitManager()
  const configManager = new ConfigManager()

  async function generateCommitMessage(): Promise<string | undefined> {
    const workspaceRoot = workspace.workspaceFolders?.[0]?.uri?.fsPath
    if (!workspaceRoot) {
      window.showErrorMessage("No workspace folder found")
      return undefined
    }

    const diff = await gitManager.getDiff()
    if (!diff) {
      window.showErrorMessage("No changes detected")
      return undefined
    }

    const apiKey = (await apiKeyManager.getAPIKey()) ?? (await apiKeyManager.setAPIKey())
    if (!apiKey) {
      window.showErrorMessage("API Key is required")
      return undefined
    }

    const config = configManager.getConfig()
    const generator = new CommitMessageGenerator(apiKey)
    return await generator.generateMessage(diff, config)
  }

  // Register all commands
  const cmdUpdateAPIKey = commands.registerCommand("diffCommit.updateAPIKey", () => apiKeyManager.setAPIKey())
  const cmdGetAPIKey = commands.registerCommand("diffCommit.getAPIKey", () => apiKeyManager.getAPIKey())
  const cmdDeleteAPIKey = commands.registerCommand("diffCommit.deleteAPIKey", () => apiKeyManager.deleteAPIKey())

  const cmdGenerateCommitMessage = commands.registerCommand("diffCommit.generateCommitMessage", async () => {
    try {
      const commitMessage = await generateCommitMessage()
      if (!commitMessage) {
        return
      }
      gitManager.setCommitMessage(commitMessage)
    } catch (error) {
      console.error(`Error writing commit message to SCM:\n\n${error}`)
      window.showErrorMessage(`Failed to write to SCM:\n\n${error instanceof Error ? error.message : String(error)}`)
    }
  })

  const cmdPreviewCommitMessage = commands.registerCommand("diffCommit.previewCommitMessage", async () => {
    try {
      const commitMessage = await generateCommitMessage()
      if (!commitMessage) {
        return
      }

      previewDocument = await workspace.openTextDocument({
        content: commitMessage,
        language: "markdown",
      })
      await window.showTextDocument(previewDocument)
    } catch (error) {
      console.error(`Error opening commit message preview:\n\n${error}`)
      window.showErrorMessage(
        `Failed to open commit message preview:\n\n${error instanceof Error ? error.message : String(error)}`,
      )
    }
  })

  const onSave = workspace.onDidSaveTextDocument((document: TextDocument) => {
    if (document === previewDocument) {
      gitManager.setCommitMessage(document.getText())
    }
  })

  const onClose = workspace.onDidCloseTextDocument((document: TextDocument) => {
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
