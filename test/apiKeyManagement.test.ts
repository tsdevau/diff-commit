import { window, type ExtensionContext } from "vscode"
import { activate } from "../src/extension"

jest.mock("vscode", () => {
  const original = jest.requireActual("vscode")
  return {
    ...original,
    window: {
      ...original.window,
      showInputBox: jest.fn(),
      showErrorMessage: jest.fn(),
      showInformationMessage: jest.fn(),
      showWarningMessage: jest.fn(),
    },
    commands: {
      registerCommand: jest.fn((id, callback) => {
        registeredCallbacks.set(id, callback)
        return { dispose: jest.fn() }
      }),
    },
  }
})

// Store registered command callbacks
const registeredCallbacks = new Map<string, Function>()

describe("API Key Management", () => {
  let mockContext: ExtensionContext
  let mockStore: jest.Mock
  let mockGet: jest.Mock
  let mockDelete: jest.Mock

  beforeEach(() => {
    jest.clearAllMocks()
    registeredCallbacks.clear()

    // Create mock functions with proper typing
    mockStore = jest.fn()
    mockGet = jest.fn()
    mockDelete = jest.fn()

    mockContext = {
      subscriptions: [],
      secrets: {
        store: mockStore,
        get: mockGet,
        delete: mockDelete,
      },
    } as unknown as ExtensionContext

    // Activate the extension to register commands
    activate(mockContext)
  })

  const getCommand = (commandId: string): Function => {
    const command = registeredCallbacks.get(commandId)
    if (!command) {
      throw new Error(`Command ${commandId} not registered`)
    }
    return command
  }

  describe("API Key Validation", () => {
    it("should reject invalid API key format", async () => {
      jest.spyOn(window, "showInputBox").mockResolvedValue("invalid-key")

      const updateAPIKey = getCommand("diffCommit.updateAPIKey")
      const result = await updateAPIKey()

      expect(result).toBeUndefined()
      expect(window.showErrorMessage).toHaveBeenCalledWith(
        "Invalid Anthropic API Key format. Should start with sk-ant-api",
      )
      expect(mockStore).not.toHaveBeenCalled()
    })

    it("should accept valid API key format", async () => {
      const validKey = "sk-ant-api123456"
      jest.spyOn(window, "showInputBox").mockResolvedValue(validKey)

      const updateAPIKey = getCommand("diffCommit.updateAPIKey")
      const result = await updateAPIKey()

      expect(result).toBe(validKey)
      expect(mockStore).toHaveBeenCalledWith("anthropic-api-key", validKey)
      expect(window.showInformationMessage).toHaveBeenCalledWith("API Key updated successfully")
    })

    it("should handle empty API key input", async () => {
      jest.spyOn(window, "showInputBox").mockResolvedValue("")

      const updateAPIKey = getCommand("diffCommit.updateAPIKey")
      const result = await updateAPIKey()

      expect(result).toBeUndefined()
      expect(window.showErrorMessage).toHaveBeenCalledWith("API Key is required")
      expect(mockStore).not.toHaveBeenCalled()
    })

    it("should handle cancelled API key input", async () => {
      jest.spyOn(window, "showInputBox").mockResolvedValue(undefined)

      const updateAPIKey = getCommand("diffCommit.updateAPIKey")
      const result = await updateAPIKey()

      expect(result).toBeUndefined()
      expect(window.showErrorMessage).toHaveBeenCalledWith("API Key is required")
      expect(mockStore).not.toHaveBeenCalled()
    })
  })

  describe("API Key Storage", () => {
    it("should handle storage failures", async () => {
      const validKey = "sk-ant-api123456"
      jest.spyOn(window, "showInputBox").mockResolvedValue(validKey)
      mockStore.mockRejectedValue(new Error("Storage error"))

      const updateAPIKey = getCommand("diffCommit.updateAPIKey")
      const result = await updateAPIKey()

      expect(result).toBeUndefined()
      expect(window.showErrorMessage).toHaveBeenCalledWith("Failed to update API key in secure storage: Storage error")
    })

    it("should handle retrieval failures", async () => {
      mockGet.mockRejectedValue(new Error("Retrieval error"))

      const getAPIKey = getCommand("diffCommit.getAPIKey")
      const result = await getAPIKey()

      expect(result).toBeUndefined()
      expect(window.showErrorMessage).toHaveBeenCalledWith("Failed to access secure storage: Retrieval error")
    })
  })

  describe("API Key Deletion", () => {
    it("should handle successful API key deletion", async () => {
      mockGet.mockResolvedValue("sk-ant-api123456")

      const deleteAPIKey = getCommand("diffCommit.deleteAPIKey")
      await deleteAPIKey()

      expect(mockDelete).toHaveBeenCalledWith("anthropic-api-key")
      expect(window.showInformationMessage).toHaveBeenCalledWith("API Key deleted successfully")
    })

    it("should handle deletion when no API key exists", async () => {
      mockGet.mockResolvedValue(undefined)

      const deleteAPIKey = getCommand("diffCommit.deleteAPIKey")
      await deleteAPIKey()

      expect(mockDelete).not.toHaveBeenCalled()
      expect(window.showWarningMessage).toHaveBeenCalledWith("No API Key found to remove")
    })

    it("should handle deletion failures", async () => {
      mockGet.mockResolvedValue("sk-ant-api123456")
      mockDelete.mockRejectedValue(new Error("Deletion error"))

      const deleteAPIKey = getCommand("diffCommit.deleteAPIKey")
      await deleteAPIKey()

      expect(window.showErrorMessage).toHaveBeenCalledWith(
        "Failed to delete API key from secure storage: Deletion error",
      )
    })

    it("should handle retrieval error during deletion", async () => {
      mockGet.mockRejectedValue(new Error("Retrieval error"))

      const deleteAPIKey = getCommand("diffCommit.deleteAPIKey")
      await deleteAPIKey()

      expect(mockDelete).not.toHaveBeenCalled()
      expect(window.showErrorMessage).toHaveBeenCalledWith(
        "Failed to delete API key from secure storage: Retrieval error",
      )
    })
  })
})
