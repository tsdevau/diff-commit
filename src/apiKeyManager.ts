import { type ExtensionContext, window } from "vscode"

export class APIKeyManager {
  constructor(private context: ExtensionContext) {}

  async setAPIKey(): Promise<string | undefined> {
    try {
      const apiKey = await window.showInputBox({
        prompt: "Enter your Anthropic API Key",
        password: true,
        placeHolder: "sk-ant-api...",
      })

      if (!apiKey) {
        window.showErrorMessage("API Key is required")
        return undefined
      }

      if (!apiKey.startsWith("sk-ant-api")) {
        window.showErrorMessage("Invalid Anthropic API Key format. Should start with sk-ant-api")
        return undefined
      }

      await this.context.secrets.store("anthropic-api-key", apiKey)
      window.showInformationMessage("API Key updated successfully")

      return apiKey
    } catch (error) {
      console.error("Secrets storage error:", error)
      window.showErrorMessage(
        `Failed to update API key in secure storage: ${error instanceof Error ? error.message : String(error)}`,
      )
      return undefined
    }
  }

  async getAPIKey(): Promise<string | undefined> {
    try {
      return await this.context.secrets.get("anthropic-api-key")
    } catch (error) {
      console.error("Secrets storage error:", error)
      window.showErrorMessage(
        `Failed to access secure storage: ${error instanceof Error ? error.message : String(error)}`,
      )
      return undefined
    }
  }

  async deleteAPIKey(): Promise<void> {
    try {
      const apiKey = await this.context.secrets.get("anthropic-api-key")
      if (!apiKey) {
        window.showWarningMessage("No API Key found to remove")
        return
      }
      await this.context.secrets.delete("anthropic-api-key")
      window.showInformationMessage("API Key deleted successfully")
    } catch (error) {
      console.error("Secrets storage error:", error)
      window.showErrorMessage(
        `Failed to delete API key from secure storage: ${error instanceof Error ? error.message : String(error)}`,
      )
    }
  }
}
