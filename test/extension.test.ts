import { beforeEach, describe, expect, it, vi } from "vitest"
import * as vscode from "vscode"
import { activate } from "../src/extension"
import { mockAnthropicCreate, MockAnthropicError } from "./setup"

// Mock Anthropic constructor
const mockAnthropicConstructor = vi.fn()
vi.mock("@anthropic-ai/sdk", () => {
  return {
    default: function (config: any) {
      mockAnthropicConstructor(config)
      return {
        messages: {
          create: mockAnthropicCreate,
        },
      }
    },
  }
})

describe("diffCommit extension", () => {
  let mockContext: vscode.ExtensionContext
  let mockGitRepo: any
  let mockGitAPI: any
  let mockGitExtension: any

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks()

    // Setup mock Git repo and API
    mockGitRepo = {
      rootUri: { fsPath: "/test/repo" },
      diff: vi.fn(),
      inputBox: {
        value: "",
      },
    }

    mockGitAPI = {
      repositories: [mockGitRepo],
    }

    mockGitExtension = {
      exports: {
        getAPI: vi.fn(() => mockGitAPI),
      },
    }

    // Setup mock context
    mockContext = {
      subscriptions: [],
      workspaceState: {} as any,
      globalState: {} as any,
      extensionUri: {} as any,
      extensionPath: "",
      asAbsolutePath: () => "",
      storagePath: "",
      globalStoragePath: "",
      logPath: "",
      extensionMode: 1,
      secrets: {
        get: vi.fn(),
        store: vi.fn(),
        delete: vi.fn(),
        onDidChange: {} as any,
      },
      environmentVariableCollection: {} as any,
      storageUri: {} as any,
      globalStorageUri: {} as any,
      logUri: {} as any,
      extension: {} as any,
      languageModelAccessInformation: {} as any,
    }

    // Setup default mock returns
    vi.mocked(vscode.workspace.getConfiguration).mockReturnValue({
      get: vi.fn((key: string) => {
        if (key === "model") return "claude-3-haiku-20240307"
        if (key === "maxTokens") return 1024
        if (key === "temperature") return 0.4
        return undefined
      }),
    } as any)

    // Default Git extension mock
    vi.mocked(vscode.extensions.getExtension).mockReturnValue(mockGitExtension as any)
  })

  describe("1. Configuration Handling", () => {
    beforeEach(() => {
      const testFolder = [{ uri: { fsPath: "/test" } } as vscode.WorkspaceFolder]
      vi.mocked(vscode.workspace).workspaceFolders = testFolder
      vi.mocked(mockContext.secrets.get).mockResolvedValue("sk-ant-api-valid-key")
      mockGitRepo.diff.mockResolvedValue("test diff")
    })

    it("should use custom configuration values when provided", async () => {
      const customConfig = {
        get: vi.fn((key: string) => {
          if (key === "model") return "custom-model"
          if (key === "maxTokens") return 2048
          if (key === "temperature") return 0.8
          return undefined
        }),
      }
      vi.mocked(vscode.workspace.getConfiguration).mockReturnValue(customConfig as any)

      activate(mockContext)
      const handler = vi.mocked(vscode.commands.registerCommand).mock.calls[0][1]
      await handler()

      expect(mockAnthropicCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          model: "custom-model",
          max_tokens: 2048,
          temperature: 0.8,
        }),
      )
    })

    it("should use default values when configuration is missing", async () => {
      const defaultConfig = {
        get: vi.fn().mockReturnValue(undefined),
      }
      vi.mocked(vscode.workspace.getConfiguration).mockReturnValue(defaultConfig as any)

      activate(mockContext)
      const handler = vi.mocked(vscode.commands.registerCommand).mock.calls[0][1]
      await handler()

      expect(mockAnthropicCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          model: "claude-3-5-sonnet-20241022",
          max_tokens: 1024,
          temperature: 0.4,
        }),
      )
    })

    it("should use default values when configuration is partially missing", async () => {
      const partialConfig = {
        get: vi.fn((key: string) => {
          if (key === "model") return "custom-model"
          return undefined
        }),
      }
      vi.mocked(vscode.workspace.getConfiguration).mockReturnValue(partialConfig as any)

      activate(mockContext)
      const handler = vi.mocked(vscode.commands.registerCommand).mock.calls[0][1]
      await handler()

      expect(mockAnthropicCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          model: "custom-model",
          max_tokens: 1024,
          temperature: 0.4,
        }),
      )
    })
  })

  describe("2. API Key Management", () => {
    beforeEach(() => {
      const testFolder = [{ uri: { fsPath: "/test" } } as vscode.WorkspaceFolder]
      vi.mocked(vscode.workspace).workspaceFolders = testFolder
      mockGitRepo.diff.mockResolvedValue("test diff")
    })

    it("should successfully store new API key in secrets", async () => {
      vi.mocked(mockContext.secrets.get).mockResolvedValue(undefined)
      vi.mocked(vscode.window.showInputBox).mockResolvedValue("sk-ant-api-new-key")

      activate(mockContext)
      const handler = vi.mocked(vscode.commands.registerCommand).mock.calls[0][1]
      await handler()

      expect(mockContext.secrets.store).toHaveBeenCalledWith("anthropic-api-key", "sk-ant-api-new-key")
      expect(mockAnthropicConstructor).toHaveBeenCalledWith({
        apiKey: "sk-ant-api-new-key",
      })
    })

    it("should successfully retrieve existing API key from secrets", async () => {
      const existingKey = "sk-ant-api-existing-key"
      vi.mocked(mockContext.secrets.get).mockResolvedValue(existingKey)

      activate(mockContext)
      const handler = vi.mocked(vscode.commands.registerCommand).mock.calls[0][1]
      await handler()

      expect(mockContext.secrets.get).toHaveBeenCalledWith("anthropic-api-key")
      expect(vscode.window.showInputBox).not.toHaveBeenCalled()
      expect(mockAnthropicConstructor).toHaveBeenCalledWith({
        apiKey: existingKey,
      })
    })

    it("should not store API key if input is cancelled", async () => {
      vi.mocked(mockContext.secrets.get).mockResolvedValue(undefined)
      vi.mocked(vscode.window.showInputBox).mockResolvedValue(undefined)

      activate(mockContext)
      const handler = vi.mocked(vscode.commands.registerCommand).mock.calls[0][1]
      await handler()

      expect(mockContext.secrets.store).not.toHaveBeenCalled()
      expect(vscode.window.showErrorMessage).toHaveBeenCalledWith("API Key is required")
    })

    it("should not store invalid API key format", async () => {
      vi.mocked(mockContext.secrets.get).mockResolvedValue(undefined)
      vi.mocked(vscode.window.showInputBox).mockResolvedValue("invalid-key-format")

      activate(mockContext)
      const handler = vi.mocked(vscode.commands.registerCommand).mock.calls[0][1]
      await handler()

      expect(mockContext.secrets.store).not.toHaveBeenCalled()
      expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
        "Invalid Anthropic API Key format. Should start with sk-ant-api",
      )
    })

    it("should handle secrets storage errors", async () => {
      const testFolder = [{ uri: { fsPath: "/test" } } as vscode.WorkspaceFolder]
      vi.mocked(vscode.workspace).workspaceFolders = testFolder
      const error = new Error("Failed to access secure storage")
      vi.mocked(mockContext.secrets.get).mockRejectedValue(error)

      activate(mockContext)
      const handler = vi.mocked(vscode.commands.registerCommand).mock.calls[0][1]
      await handler()

      expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
        "Failed to access secure storage:",
        JSON.stringify(error),
      )
      expect(mockAnthropicConstructor).not.toHaveBeenCalled()
      expect(mockAnthropicCreate).not.toHaveBeenCalled()
    })
  })

  describe("3. Message Processing", () => {
    beforeEach(() => {
      const testFolder = [{ uri: { fsPath: "/test" } } as vscode.WorkspaceFolder]
      vi.mocked(vscode.workspace).workspaceFolders = testFolder
      vi.mocked(mockContext.secrets.get).mockResolvedValue("sk-ant-api-valid-key")
      mockGitRepo.diff.mockResolvedValue("test diff")
    })

    it("should replace asterisk and space with hyphen and space", async () => {
      const messageWithBullets = "feat(scope): changes\n* Change 1\n* Change 2"
      const expectedMessage = "feat(scope): changes\n- Change 1\n- Change 2"

      const mockMessage = {
        content: [{ type: "text", text: messageWithBullets }],
      }
      mockAnthropicCreate.mockResolvedValue(mockMessage)

      activate(mockContext)
      const handler = vi.mocked(vscode.commands.registerCommand).mock.calls[0][1]
      await handler()

      expect(mockGitRepo.inputBox.value).toBe(expectedMessage)
    })

    it("should handle multiple bullet points in message", async () => {
      const messageWithBullets = "feat(scope): changes\n* Change 1\n* Change 2\n* Change 3"
      const expectedMessage = "feat(scope): changes\n- Change 1\n- Change 2\n- Change 3"

      const mockMessage = {
        content: [{ type: "text", text: messageWithBullets }],
      }
      mockAnthropicCreate.mockResolvedValue(mockMessage)

      activate(mockContext)
      const handler = vi.mocked(vscode.commands.registerCommand).mock.calls[0][1]
      await handler()

      expect(mockGitRepo.inputBox.value).toBe(expectedMessage)
    })

    it("should handle non-text content type", async () => {
      const mockMessage = {
        content: [{ type: "image", text: "some-image-data" }],
      }
      mockAnthropicCreate.mockResolvedValue(mockMessage)

      activate(mockContext)
      const handler = vi.mocked(vscode.commands.registerCommand).mock.calls[0][1]
      await handler()

      expect(mockGitRepo.inputBox.value).toBe("")
    })

    it("should handle undefined message content", async () => {
      const mockMessage = {
        content: undefined,
      }
      mockAnthropicCreate.mockResolvedValue(mockMessage as any)

      activate(mockContext)
      const handler = vi.mocked(vscode.commands.registerCommand).mock.calls[0][1]
      await handler()

      expect(mockGitRepo.inputBox.value).toBe("")
    })

    it("should handle empty content array", async () => {
      const mockMessage = {
        content: [],
      }
      mockAnthropicCreate.mockResolvedValue(mockMessage)

      activate(mockContext)
      const handler = vi.mocked(vscode.commands.registerCommand).mock.calls[0][1]
      await handler()

      expect(mockGitRepo.inputBox.value).toBe("")
    })

    it("should handle multiple content items", async () => {
      const mockMessage = {
        content: [
          { type: "text", text: "feat(scope): changes\n" },
          { type: "text", text: "* Change 1\n" },
          { type: "text", text: "* Change 2" },
        ],
      }
      mockAnthropicCreate.mockResolvedValue(mockMessage)

      activate(mockContext)
      const handler = vi.mocked(vscode.commands.registerCommand).mock.calls[0][1]
      await handler()

      expect(mockGitRepo.inputBox.value).toBe("feat(scope): changes\n\n- Change 1\n\n- Change 2")
    })
  })

  describe("4. Error Handling", () => {
    beforeEach(() => {
      const testFolder = [{ uri: { fsPath: "/test" } } as vscode.WorkspaceFolder]
      vi.mocked(vscode.workspace).workspaceFolders = testFolder
      vi.mocked(mockContext.secrets.get).mockResolvedValue("sk-ant-api-valid-key")
      mockGitRepo.diff.mockResolvedValue("test diff")
    })

    it("should handle Anthropic API error", async () => {
      const error = new MockAnthropicError("API Error")
      mockAnthropicCreate.mockRejectedValue(error)

      activate(mockContext)
      const handler = vi.mocked(vscode.commands.registerCommand).mock.calls[0][1]
      await handler()

      expect(vscode.window.showErrorMessage).toHaveBeenCalledWith("Failed to generate commit message: API Error")
    })

    it("should handle non-Anthropic errors", async () => {
      const error = new Error("Unknown error occurred")
      mockAnthropicCreate.mockRejectedValue(error)

      activate(mockContext)
      const handler = vi.mocked(vscode.commands.registerCommand).mock.calls[0][1]
      await handler()

      expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
        "Unknown error generating commit message:",
        JSON.stringify(error),
      )
    })

    it("should handle network errors", async () => {
      const error = new Error("Network error")
      error.name = "NetworkError"
      mockAnthropicCreate.mockRejectedValue(error)

      activate(mockContext)
      const handler = vi.mocked(vscode.commands.registerCommand).mock.calls[0][1]
      await handler()

      expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
        "Unknown error generating commit message:",
        JSON.stringify(error),
      )
    })

    it("should handle timeout errors", async () => {
      const error = new Error("Request timed out")
      error.name = "TimeoutError"
      mockAnthropicCreate.mockRejectedValue(error)

      activate(mockContext)
      const handler = vi.mocked(vscode.commands.registerCommand).mock.calls[0][1]
      await handler()

      expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
        "Unknown error generating commit message:",
        JSON.stringify(error),
      )
    })

    it("should handle missing message content", async () => {
      const mockMessage = {}
      mockAnthropicCreate.mockResolvedValue(mockMessage)

      activate(mockContext)
      const handler = vi.mocked(vscode.commands.registerCommand).mock.calls[0][1]
      await handler()

      expect(mockGitRepo.inputBox.value).toBe("")
    })

    it("should handle null message response", async () => {
      mockAnthropicCreate.mockResolvedValue(null)

      activate(mockContext)
      const handler = vi.mocked(vscode.commands.registerCommand).mock.calls[0][1]
      await handler()

      expect(mockGitRepo.inputBox.value).toBe("")
    })
  })

  it("should handle no workspace folder", async () => {
    vi.mocked(vscode.workspace).workspaceFolders = undefined

    activate(mockContext)
    const handler = vi.mocked(vscode.commands.registerCommand).mock.calls[0][1]
    await handler()

    expect(vscode.window.showErrorMessage).toHaveBeenCalledWith("No workspace folder found")
  })

  it("should handle missing Git extension", async () => {
    const testFolder = [{ uri: { fsPath: "/test" } } as vscode.WorkspaceFolder]
    vi.mocked(vscode.workspace).workspaceFolders = testFolder
    vi.mocked(vscode.extensions.getExtension).mockReturnValue(undefined)

    activate(mockContext)
    const handler = vi.mocked(vscode.commands.registerCommand).mock.calls[0][1]
    await handler()

    expect(vscode.window.showErrorMessage).toHaveBeenCalledWith("Git extension not found")
  })

  it("should handle no Git repository", async () => {
    const testFolder = [{ uri: { fsPath: "/test" } } as vscode.WorkspaceFolder]
    vi.mocked(vscode.workspace).workspaceFolders = testFolder
    mockGitAPI.repositories = []

    activate(mockContext)
    const handler = vi.mocked(vscode.commands.registerCommand).mock.calls[0][1]
    await handler()

    expect(vscode.window.showErrorMessage).toHaveBeenCalledWith("No Git repository found")
  })

  it("should handle no staged changes", async () => {
    const testFolder = [{ uri: { fsPath: "/test" } } as vscode.WorkspaceFolder]
    vi.mocked(vscode.workspace).workspaceFolders = testFolder
    mockGitRepo.diff.mockResolvedValue(undefined)

    activate(mockContext)
    const handler = vi.mocked(vscode.commands.registerCommand).mock.calls[0][1]
    await handler()

    expect(vscode.window.showErrorMessage).toHaveBeenCalledWith("No changes detected")
  })

  it("should successfully generate commit message", async () => {
    const testFolder = [{ uri: { fsPath: "/test" } } as vscode.WorkspaceFolder]
    vi.mocked(vscode.workspace).workspaceFolders = testFolder
    vi.mocked(mockContext.secrets.get).mockResolvedValue("sk-ant-api-valid-key")
    mockGitRepo.diff.mockResolvedValue("test diff")

    const mockMessage = {
      content: [{ type: "text", text: "feat(scope): test commit message" }],
    }
    mockAnthropicCreate.mockResolvedValue(mockMessage)

    activate(mockContext)
    const handler = vi.mocked(vscode.commands.registerCommand).mock.calls[0][1]
    await handler()

    expect(mockGitRepo.inputBox.value).toBe("feat(scope): test commit message")
  })
})
