const mockOllamaList = jest.fn()

// Create mock Ollama constructor
function MockOllama() {
  return {
    list: mockOllamaList,
  }
}

jest.mock("ollama", () => ({
  Ollama: MockOllama,
}))

// Mock console
const mockConsoleError = jest.fn()
jest.mock("console", () => ({
  error: mockConsoleError,
}))

// Mock vscode
import * as vscode from "vscode"

jest.mock("vscode")

import { OllamaManager } from "../src/ollamaManager"

describe("OllamaManager", () => {
  let ollamaManager: OllamaManager
  let mockShowErrorMessage: jest.Mock
  let mockShowWarningMessage: jest.Mock
  let mockShowInputBox: jest.Mock
  let mockShowQuickPick: jest.Mock
  let mockSetStatusBarMessage: jest.Mock
  let mockGetConfiguration: jest.Mock
  let mockConfigGet: jest.Mock
  let mockConfigUpdate: jest.Mock

  beforeEach(() => {
    jest.clearAllMocks()

    // Mock vscode functions
    mockShowErrorMessage = jest.fn()
    mockShowWarningMessage = jest.fn()
    mockShowInputBox = jest.fn()
    mockShowQuickPick = jest.fn()
    mockSetStatusBarMessage = jest.fn()
    mockConfigGet = jest.fn()
    mockConfigUpdate = jest.fn().mockResolvedValue(undefined)
    ;(vscode.window as any).showErrorMessage = mockShowErrorMessage
    ;(vscode.window as any).showWarningMessage = mockShowWarningMessage
    ;(vscode.window as any).showInputBox = mockShowInputBox
    ;(vscode.window as any).showQuickPick = mockShowQuickPick
    ;(vscode.window as any).setStatusBarMessage = mockSetStatusBarMessage

    mockGetConfiguration = jest.fn().mockReturnValue({
      get: mockConfigGet,
      update: mockConfigUpdate,
    })
    ;(vscode.workspace as any).getConfiguration = mockGetConfiguration

    ollamaManager = new OllamaManager()
  })

  describe("getAvailableModels", () => {
    it("should return model names successfully", async () => {
      const mockModels = [{ name: "llama3.2" }, { name: "codellama" }, { name: "mistral" }]
      mockOllamaList.mockResolvedValue({ models: mockModels })

      const result = await ollamaManager.getAvailableModels("http://localhost:11434")

      expect(result).toEqual(["llama3.2", "codellama", "mistral"])
      expect(mockOllamaList).toHaveBeenCalled()
    })

    it("should handle errors and show error message", async () => {
      const testError = new Error("Connection failed")
      mockOllamaList.mockRejectedValue(testError)

      await expect(ollamaManager.getAvailableModels("http://localhost:11434")).rejects.toThrow("Connection failed")

      expect(mockShowErrorMessage).toHaveBeenCalledWith("Failed to fetch Ollama models: Connection failed")
    })

    it("should handle non-Error objects", async () => {
      const testError = "String error"
      mockOllamaList.mockRejectedValue(testError)

      await expect(ollamaManager.getAvailableModels("http://localhost:11434")).rejects.toBe("String error")

      expect(mockShowErrorMessage).toHaveBeenCalledWith("Failed to fetch Ollama models: String error")
    })
  })

  describe("configureOllamaModel", () => {
    beforeEach(() => {
      mockConfigGet.mockImplementation((key: string) => {
        if (key === "ollamaHostname") return "http://localhost:11434"
        if (key === "ollamaModel") return "llama3.2"
        return undefined
      })
    })

    it("should configure successfully with valid hostname and models", async () => {
      const mockModels = [{ name: "llama3.2" }, { name: "codellama" }]
      mockOllamaList.mockResolvedValue({ models: mockModels })
      mockShowInputBox.mockResolvedValue("http://localhost:11434")
      mockShowQuickPick.mockResolvedValue("llama3.2")

      const result = await ollamaManager.configureOllamaModel()

      expect(result).toBe(true)
      expect(mockConfigUpdate).toHaveBeenCalledWith("provider", "ollama", true)
      expect(mockConfigUpdate).toHaveBeenCalledWith("ollamaHostname", "http://localhost:11434", true)
      expect(mockConfigUpdate).toHaveBeenCalledWith("ollamaModel", "llama3.2", true)
      expect(mockSetStatusBarMessage).toHaveBeenCalledWith("✓ Ollama model updated to 'llama3.2' successfully", 4000)
    })

    it("should return false when user cancels hostname input", async () => {
      mockShowInputBox.mockResolvedValue(undefined)

      const result = await ollamaManager.configureOllamaModel()

      expect(result).toBe(false)
      expect(mockConfigUpdate).not.toHaveBeenCalled()
    })

    it("should handle invalid hostname URL and retry", async () => {
      // First call with invalid URL, second call cancels
      mockShowInputBox.mockResolvedValueOnce("invalid-url").mockResolvedValueOnce(undefined)

      const result = await ollamaManager.configureOllamaModel()

      expect(mockShowErrorMessage).toHaveBeenCalledWith(
        "Invalid hostname URL. Please enter a valid URL (eg http://localhost:11434).",
      )
      expect(result).toBe(false)
    })

    it("should show warning when no models found", async () => {
      mockOllamaList.mockResolvedValue({ models: [] })
      mockShowInputBox.mockResolvedValue("http://localhost:11434")

      const result = await ollamaManager.configureOllamaModel()

      expect(result).toBe(false)
      expect(mockShowWarningMessage).toHaveBeenCalledWith(
        "No models found on the Ollama server. Please pull a model first.",
      )
    })

    it("should return false when user cancels model selection", async () => {
      const mockModels = [{ name: "llama3.2" }]
      mockOllamaList.mockResolvedValue({ models: mockModels })
      mockShowInputBox.mockResolvedValue("http://localhost:11434")
      mockShowQuickPick.mockResolvedValue(undefined)

      const result = await ollamaManager.configureOllamaModel()

      expect(result).toBe(false)
      expect(mockConfigUpdate).not.toHaveBeenCalled()
    })

    describe("error handling", () => {
      beforeEach(() => {
        mockShowInputBox.mockResolvedValue("http://localhost:11434")
      })

      it("should handle ECONNREFUSED error", async () => {
        const connectionError = new Error("ECONNREFUSED - connection refused")
        mockOllamaList.mockRejectedValue(connectionError)

        const result = await ollamaManager.configureOllamaModel()

        expect(result).toBe(false)
        expect(mockShowErrorMessage).toHaveBeenCalledWith(
          "Unable to connect to Ollama server at http://localhost:11434. Please ensure that the Ollama server is running and accessible.",
        )
      })

      it("should handle fetch error", async () => {
        const fetchError = new Error("fetch failed")
        mockOllamaList.mockRejectedValue(fetchError)

        const result = await ollamaManager.configureOllamaModel()

        expect(result).toBe(false)
        expect(mockShowErrorMessage).toHaveBeenCalledWith(
          "Unable to connect to Ollama server at http://localhost:11434. Please ensure that the Ollama server is running and accessible.",
        )
      })

      it("should handle 404 error", async () => {
        const notFoundError = new Error("404 not found")
        mockOllamaList.mockRejectedValue(notFoundError)

        const result = await ollamaManager.configureOllamaModel()

        expect(result).toBe(false)
        expect(mockShowErrorMessage).toHaveBeenCalledWith(
          "Ollama server not found at http://localhost:11434. Please check the hostname and try again.",
        )
      })

      it("should handle generic Error", async () => {
        const genericError = new Error("Something went wrong")
        mockOllamaList.mockRejectedValue(genericError)

        const result = await ollamaManager.configureOllamaModel()

        expect(result).toBe(false)
        expect(mockShowErrorMessage).toHaveBeenCalledWith("Failed to connect to Ollama: Something went wrong")
      })

      it("should handle non-Error objects", async () => {
        const stringError = "String error"
        mockOllamaList.mockRejectedValue(stringError)

        const result = await ollamaManager.configureOllamaModel()

        expect(result).toBe(false)
        expect(mockShowErrorMessage).toHaveBeenCalledWith("Failed to connect to Ollama: String error")
      })
    })
  })

  describe("changeOllamaModel", () => {
    beforeEach(() => {
      mockConfigGet.mockImplementation((key: string) => {
        if (key === "ollamaHostname") return "http://localhost:11434"
        if (key === "ollamaModel") return "llama3.2"
        return undefined
      })
    })

    it("should change model successfully without changing hostname", async () => {
      const mockModels = [{ name: "llama3.2" }, { name: "codellama" }]
      mockOllamaList.mockResolvedValue({ models: mockModels })
      mockShowQuickPick.mockResolvedValue("codellama")

      const result = await ollamaManager.changeOllamaModel()

      expect(result).toBe(true)
      expect(mockConfigUpdate).not.toHaveBeenCalledWith("provider", "ollama", true)
      expect(mockConfigUpdate).not.toHaveBeenCalledWith("ollamaHostname", expect.anything(), true)
      expect(mockConfigUpdate).toHaveBeenCalledWith("ollamaModel", "codellama", true)
      expect(mockSetStatusBarMessage).toHaveBeenCalledWith("✓ Ollama model updated to 'codellama' successfully", 4000)
    })

    it("should handle errors during model changing", async () => {
      const connectionError = new Error("ECONNREFUSED - connection refused")
      mockOllamaList.mockRejectedValue(connectionError)

      const result = await ollamaManager.changeOllamaModel()

      expect(result).toBe(false)
      expect(mockShowErrorMessage).toHaveBeenCalledWith(
        "Unable to connect to Ollama server at http://localhost:11434. Please ensure that the Ollama server is running and accessible.",
      )
    })
  })
})
