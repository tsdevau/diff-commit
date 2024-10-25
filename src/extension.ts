import * as vscode from "vscode"
import { APIKeyManager } from "./apiKeyManager"
import { CommitMessageGenerator } from "./commitMessageGenerator"
import { ConfigManager } from "./configManager"
import { GitManager } from "./gitManager"

export function activate(context: vscode.ExtensionContext) {
  let previewDocument: vscode.TextDocument | undefined

  const apiKeyManager = new APIKeyManager(context)
  const gitManager = new GitManager()
  const configManager = new ConfigManager()

  async function generateCommitMessage(): Promise<string | undefined> {
    const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri?.fsPath
    if (!workspaceRoot) {
      vscode.window.showErrorMessage("No workspace folder found")
      return undefined
    }

    const diff = await gitManager.getDiff()
    if (!diff) {
      vscode.window.showErrorMessage("No changes detected")
      return undefined
    }

    const apiKey = (await apiKeyManager.getAPIKey()) ?? (await apiKeyManager.setAPIKey())
    if (!apiKey) {
      vscode.window.showErrorMessage("API Key is required")
      return undefined
    }

    const config = configManager.getConfig()
    const generator = new CommitMessageGenerator(apiKey)
    return await generator.generateMessage(diff, config)
  }

  // Register all commands
  const cmdUpdateAPIKey = vscode.commands.registerCommand("diffCommit.updateAPIKey", () => apiKeyManager.setAPIKey())
  const cmdGetAPIKey = vscode.commands.registerCommand("diffCommit.getAPIKey", () => apiKeyManager.getAPIKey())
  const cmdDeleteAPIKey = vscode.commands.registerCommand("diffCommit.deleteAPIKey", () => apiKeyManager.deleteAPIKey())

  const cmdGenerateCommitMessage = vscode.commands.registerCommand("diffCommit.generateCommitMessage", async () => {
    try {
      const commitMessage = await generateCommitMessage()
      if (!commitMessage) {
        return
      }
      gitManager.setCommitMessage(commitMessage)
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
      gitManager.setCommitMessage(document.getText())
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
