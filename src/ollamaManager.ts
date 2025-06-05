import { Ollama } from "ollama"
import { window, workspace } from "vscode"

export class OllamaManager {
  constructor() {}

  private async ollamaModelConfig(includeHostnameSelection: boolean = true): Promise<boolean> {
    const config = workspace.getConfiguration("diffCommit")
    let hostname = config.get<string>("ollamaHostname") || "http://localhost:11434"

    // Only prompt for hostname if this is initial setup or explicitly requested
    if (includeHostnameSelection) {
      const inputHostname = await window.showInputBox({
        prompt: "Enter Ollama hostname",
        value: hostname,
        placeHolder: "http://localhost:11434",
      })

      if (!inputHostname) {
        return false
      }

      try {
        const newHost = new URL(inputHostname)
        hostname = newHost.toString().replace(/\/+$/, "")
      } catch (error) {
        window.showErrorMessage("Invalid hostname URL. Please enter a valid URL (eg http://localhost:11434).")
        return this.ollamaModelConfig(includeHostnameSelection)
      }
    }

    try {
      // Test connection and get available models
      const models = await this.getAvailableModels(hostname)

      if (models.length === 0) {
        window.showWarningMessage("No models found on the Ollama server. Please pull a model first.")
        return false
      }

      // Let user select a model
      const currentModel = config.get<string>("ollamaModel")
      const placeHolder = includeHostnameSelection
        ? "Select an Ollama model"
        : `Select an Ollama model (current: ${currentModel || "none"})`

      const title = includeHostnameSelection ? "Choose Ollama Model" : "Change Ollama Model"

      const selectedModel = await window.showQuickPick(models, {
        placeHolder,
        title,
      })

      if (!selectedModel) {
        return false
      }

      // Save configuration
      if (includeHostnameSelection) {
        await config.update("provider", "ollama", true)
        await config.update("ollamaHostname", hostname, true)
      }
      await config.update("ollamaModel", selectedModel, true)

      window.setStatusBarMessage(`✓ Ollama model updated to '${selectedModel}' successfully`, 4000)

      return true
    } catch (error) {
      console.error(`Error updating Ollama model:`, error)

      if (error instanceof Error) {
        if (error.message.includes("ECONNREFUSED") || error.message.includes("fetch")) {
          window.showErrorMessage(
            `Unable to connect to Ollama server at ${hostname}. Please ensure that the Ollama server is running and accessible.`,
          )
        } else if (error.message.includes("404")) {
          window.showErrorMessage(`Ollama server not found at ${hostname}. Please check the hostname and try again.`)
        } else {
          window.showErrorMessage(`Failed to connect to Ollama: ${error.message}`)
        }
      } else {
        window.showErrorMessage(
          `Failed to connect to Ollama: ${error instanceof Error ? error.message : String(error)}`,
        )
      }
      return false
    }
  }

  async getAvailableModels(hostname: string): Promise<string[]> {
    try {
      const ollama = new Ollama({
        host: hostname,
      })

      const response = await ollama.list()
      return response.models.map((model) => model.name)
    } catch (error) {
      console.error("Failed to fetch Ollama models:", error)
      window.showErrorMessage(
        `Failed to fetch Ollama models: ${error instanceof Error ? error.message : String(error)}`,
      )
      throw error
    }
  }

  // Convenience method for initial setup
  async configureOllamaModel(): Promise<boolean> {
    return this.ollamaModelConfig(true)
  }

  // Convenience method for changing existing model
  async changeOllamaModel(): Promise<boolean> {
    return this.ollamaModelConfig(false)
  }
}
