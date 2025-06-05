import { type ExtensionContext, window, workspace } from "vscode"

interface OllamaModel {
  name: string
  modified_at: string
  size: number
}

interface OllamaTagsResponse {
  models: OllamaModel[]
}

export class OllamaManager {
  constructor(private context: ExtensionContext) {}

  async getAvailableModels(hostname: string): Promise<string[]> {
    try {
      const response = await fetch(`${hostname}/api/tags`)

      if (!response.ok) {
        throw new Error(`Failed to fetch models: ${response.status} ${response.statusText}`)
      }

      const data: OllamaTagsResponse = await response.json()
      return data.models.map((model) => model.name)
    } catch (error) {
      console.error("Failed to fetch Ollama models:", error)
      throw error
    }
  }

  async selectOllamaModel(): Promise<boolean> {
    // Get hostname from user or use default
    const hostname = await window.showInputBox({
      prompt: "Enter Ollama hostname",
      value: "http://localhost:11434",
      placeHolder: "http://localhost:11434",
    })

    if (!hostname) {
      return false
    }

    try {
      // Test connection and get available models
      const models = await this.getAvailableModels(hostname)

      if (models.length === 0) {
        window.showWarningMessage("No models found on the Ollama server. Please pull a model first.")
        return false
      }

      // Let user select a model
      const selectedModel = await window.showQuickPick(models, {
        placeHolder: "Select an Ollama model",
        title: "Choose Ollama Model",
      })

      if (!selectedModel) {
        return false
      }

      // Save configuration
      const config = workspace.getConfiguration("diffCommit")
      await config.update("provider", "ollama", true)
      await config.update("ollamaHostname", hostname, true)
      await config.update("ollamaModel", selectedModel, true)

      window.showInformationMessage(`Ollama model '${selectedModel}' selected successfully`)
      return true
    } catch (error) {
      console.error("Error selecting Ollama model:", error)
      if (error instanceof TypeError && error.message.includes("fetch")) {
        window.showErrorMessage(
          `Unable to connect to Ollama server at ${hostname}. Please ensure that the Ollama server is running and accessible.`,
        )
      } else {
        window.showErrorMessage(
          `Failed to connect to Ollama: ${error instanceof Error ? error.message : String(error)}`,
        )
      }
      return false
    }
  }

  async changeOllamaModel(): Promise<boolean> {
    const config = workspace.getConfiguration("diffCommit")
    const currentHostname = config.get<string>("ollamaHostname") || "http://localhost:11434"

    try {
      // Get available models from current hostname
      const models = await this.getAvailableModels(currentHostname)

      if (models.length === 0) {
        window.showWarningMessage("No models found on the Ollama server. Please pull a model first.")
        return false
      }

      const currentModel = config.get<string>("ollamaModel")
      const selectedModel = await window.showQuickPick(models, {
        placeHolder: `Select an Ollama model (current: ${currentModel || "none"})`,
        title: "Change Ollama Model",
      })

      if (!selectedModel) {
        return false
      }

      // Update only the model selection
      await config.update("ollamaModel", selectedModel, true)

      window.showInformationMessage(`Ollama model changed to '${selectedModel}'`)
      return true
    } catch (error) {
      console.error("Error changing Ollama model:", error)
      if (error instanceof TypeError && error.message.includes("fetch")) {
        window.showErrorMessage(
          `Unable to connect to Ollama server at ${currentHostname}. Please ensure Ollama is running and accessible.`,
        )
      } else {
        window.showErrorMessage(
          `Failed to connect to Ollama: ${error instanceof Error ? error.message : String(error)}`,
        )
      }
      return false
    }
  }
}
