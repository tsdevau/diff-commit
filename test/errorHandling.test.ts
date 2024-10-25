// Mock Anthropic API at the top level
const mockAnthropicCreate = jest.fn()

// Create mock APIError class
class MockAPIError extends Error {
  constructor(
    public status: number,
    message: string,
    public type = "api_error",
    public headers = {},
  ) {
    super(message)
    this.name = "APIError"
  }
}

// Create mock Anthropic constructor
function MockAnthropic() {
  return {
    messages: {
      create: mockAnthropicCreate,
    },
  }
}
MockAnthropic.APIError = MockAPIError

jest.mock("@anthropic-ai/sdk", () => ({
  __esModule: true,
  default: MockAnthropic,
}))

import Anthropic from "@anthropic-ai/sdk"
import * as vscode from "vscode"
import { activate } from "../src/extension"

// Mock ExtensionMode enum since it's not available in the test environment
const mockExtensionMode = {
  Development: 1,
  Test: 2,
  Production: 3,
}

// Mock ExtensionKind enum
const mockExtensionKind = {
  UI: 1,
  Workspace: 2,
}

// Mock event function
const mockEvent = jest.fn()

describe("Error Handling", () => {
  let mockContext: vscode.ExtensionContext
  let mockCommands: { [key: string]: (...args: any[]) => any }

  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks()

    mockCommands = {}
    mockContext = {
      subscriptions: [],
      workspaceState: {
        get: jest.fn(),
        update: jest.fn(),
        keys: jest.fn().mockReturnValue([]),
      },
      globalState: {
        get: jest.fn(),
        update: jest.fn(),
        keys: jest.fn().mockReturnValue([]),
        setKeysForSync: jest.fn(),
      },
      extensionPath: "",
      storagePath: "",
      globalStoragePath: "",
      logPath: "",
      extensionUri: {} as vscode.Uri,
      extensionMode: mockExtensionMode.Test,
      languageModelAccessInformation: {
        canSendRequest: jest.fn(),
        onDidChange: jest.fn(),
      },
      environmentVariableCollection: {
        persistent: true,
        description: "Mock Environment Variables",
        replace: jest.fn(),
        append: jest.fn(),
        prepend: jest.fn(),
        get: jest.fn(),
        forEach: jest.fn(),
        delete: jest.fn(),
        clear: jest.fn(),
        getScoped: jest.fn(),
        [Symbol.iterator]: function* () {
          yield* []
        },
      } as vscode.GlobalEnvironmentVariableCollection,
      secrets: {
        get: jest.fn().mockResolvedValue("test-api-key"),
        store: jest.fn(),
        delete: jest.fn(),
        onDidChange: mockEvent,
      },
      extension: {
        id: "test",
        extensionUri: {} as vscode.Uri,
        extensionPath: "",
        isActive: true,
        packageJSON: {},
        exports: undefined,
        activate: jest.fn(),
        extensionKind: mockExtensionKind.Workspace,
      },
      asAbsolutePath: jest.fn(),
      storageUri: {} as vscode.Uri | undefined,
      globalStorageUri: {} as vscode.Uri,
      logUri: {} as vscode.Uri,
    }

    // Mock console methods
    global.console.log = jest.fn()
    global.console.error = jest.fn()

    // Mock vscode.commands
    ;(vscode.commands as any).registerCommand = jest.fn((command: string, callback: (...args: any[]) => any) => {
      mockCommands[command] = callback
      return { dispose: jest.fn() }
    })

    // Mock vscode.workspace
    ;(vscode.workspace as any).workspaceFolders = [{ uri: { fsPath: "/test" } }]
    ;(vscode.workspace as any).getConfiguration = () => ({
      get: (key: string) => {
        const defaults: { [key: string]: any } = {
          model: "claude-3-5-sonnet-latest",
          maxTokens: 1024,
          temperature: 0.4,
        }
        return defaults[key]
      },
    })

    // Mock vscode.window
    ;(vscode.window as any).showErrorMessage = jest.fn()

    // Mock Git extension
    ;(vscode.extensions as any).getExtension = () => ({
      exports: {
        getAPI: () => ({
          repositories: [
            {
              diff: () => "test diff",
              inputBox: { value: "" },
            },
          ],
        }),
      },
    })
  })

  it("logs message stop reason and usage in finally block on success", async () => {
    // Setup successful API response
    const mockMessage = {
      content: [{ type: "text", text: "test commit message" }],
      stop_reason: "end_turn",
      usage: { input_tokens: 100, output_tokens: 50 },
    }
    mockAnthropicCreate.mockResolvedValue(mockMessage)

    activate(mockContext)
    await mockCommands["diffCommit.generateCommitMessage"]()

    // Verify console.log was called with the expected arguments
    expect(console.log).toHaveBeenCalledWith("[DiffCommit] Stop Reason: ", mockMessage.stop_reason)
    expect(console.log).toHaveBeenCalledWith("[DiffCommit] Usage: ", mockMessage.usage)
  })

  describe("Anthropic API Error Handling", () => {
    it("handles 400 Bad Request error", async () => {
      const apiError = new Anthropic.APIError(400, "Bad request", "api_error", {})
      mockAnthropicCreate.mockRejectedValue(apiError)

      activate(mockContext)
      await mockCommands["diffCommit.generateCommitMessage"]()

      expect(vscode.window.showErrorMessage).toHaveBeenCalledWith("Bad request. Review your prompt and try again.")
      expect(console.error).toHaveBeenCalledWith("Anthropic API Error (400):", "Bad request")
    })

    it("handles 401 Unauthorized error", async () => {
      const apiError = new Anthropic.APIError(401, "Invalid API key", "api_error", {})
      mockAnthropicCreate.mockRejectedValue(apiError)

      activate(mockContext)
      await mockCommands["diffCommit.generateCommitMessage"]()

      expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
        "Invalid API key. Please update your API key and try again.",
      )
      expect(console.error).toHaveBeenCalledWith("Anthropic API Error (401):", "Invalid API key")
    })

    it("handles 403 Forbidden error", async () => {
      const apiError = new Anthropic.APIError(403, "Permission denied", "api_error", {})
      mockAnthropicCreate.mockRejectedValue(apiError)

      activate(mockContext)
      await mockCommands["diffCommit.generateCommitMessage"]()

      expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
        "Permission Denied. Review your prompt or API key and try again.",
      )
      expect(console.error).toHaveBeenCalledWith("Anthropic API Error (403):", "Permission denied")
    })

    it("handles 429 Rate Limit error", async () => {
      const apiError = new Anthropic.APIError(429, "Too many requests", "api_error", {})
      mockAnthropicCreate.mockRejectedValue(apiError)

      activate(mockContext)
      await mockCommands["diffCommit.generateCommitMessage"]()

      expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
        "Rate limit exceeded. Please try again later: Too many requests",
      )
      expect(console.error).toHaveBeenCalledWith("Anthropic API Error (429):", "Too many requests")
    })

    it("handles 500 Server error", async () => {
      const apiError = new Anthropic.APIError(500, "Internal server error", "api_error", {})
      mockAnthropicCreate.mockRejectedValue(apiError)

      activate(mockContext)
      await mockCommands["diffCommit.generateCommitMessage"]()

      expect(vscode.window.showErrorMessage).toHaveBeenCalledWith("Anthropic API server error. Please try again later.")
      expect(console.error).toHaveBeenCalledWith("Anthropic API Error (500):", "Internal server error")
    })

    it("handles unknown API error status", async () => {
      const apiError = new Anthropic.APIError(418, "Unknown error", "api_error", {})
      mockAnthropicCreate.mockRejectedValue(apiError)

      activate(mockContext)
      await mockCommands["diffCommit.generateCommitMessage"]()

      expect(vscode.window.showErrorMessage).toHaveBeenCalledWith("Failed to generate commit message: Unknown error")
      expect(console.error).toHaveBeenCalledWith("Anthropic API Error (418):", "Unknown error")
    })
  })

  it("logs error when writing commit message to SCM fails", async () => {
    // Mock Git extension with failing inputBox
    ;(vscode.extensions as any).getExtension = () => ({
      exports: {
        getAPI: () => ({
          repositories: [
            {
              diff: () => "test diff",
              inputBox: {
                get value() {
                  throw new Error("SCM error")
                },
                set value(_: string) {
                  throw new Error("SCM error")
                },
              },
            },
          ],
        }),
      },
    })

    // Setup successful API response
    const mockMessage = {
      content: [{ type: "text", text: "test commit message" }],
      stop_reason: "end_turn",
      usage: { input_tokens: 100, output_tokens: 50 },
    }
    mockAnthropicCreate.mockResolvedValue(mockMessage)

    activate(mockContext)
    await mockCommands["diffCommit.generateCommitMessage"]()

    // Verify console.error was called with the expected error
    expect(console.error).toHaveBeenCalledWith("Error writing commit message to SCM:", expect.any(Error))
    expect(vscode.window.showErrorMessage).toHaveBeenCalledWith("Failed to write to SCM: SCM error")
    // Verify finally block still logs
    expect(console.log).toHaveBeenCalledWith("[DiffCommit] Stop Reason: ", mockMessage.stop_reason)
    expect(console.log).toHaveBeenCalledWith("[DiffCommit] Usage: ", mockMessage.usage)
  })

  it("logs error when opening commit message preview fails", async () => {
    // Mock Git extension
    ;(vscode.extensions as any).getExtension = () => ({
      exports: {
        getAPI: () => ({
          repositories: [
            {
              diff: () => "test diff",
            },
          ],
        }),
      },
    })

    // Setup successful API response
    const mockMessage = {
      content: [{ type: "text", text: "test commit message" }],
      stop_reason: "end_turn",
      usage: { input_tokens: 100, output_tokens: 50 },
    }
    mockAnthropicCreate.mockResolvedValue(mockMessage)

    // Mock workspace.openTextDocument to succeed but showTextDocument to fail
    const mockDocument = { test: "document" }
    ;(vscode.workspace as any).openTextDocument = jest.fn().mockResolvedValue(mockDocument)
    ;(vscode.window as any).showTextDocument = jest.fn().mockRejectedValue(new Error("Show document error"))

    activate(mockContext)
    await mockCommands["diffCommit.previewCommitMessage"]()

    // Verify console.error was called with the expected error
    expect(console.error).toHaveBeenCalledWith("Error opening commit message preview:", expect.any(Error))
    expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
      "Failed to open commit message preview: Show document error",
    )
    // Verify finally block still logs
    expect(console.log).toHaveBeenCalledWith("[DiffCommit] Stop Reason: ", mockMessage.stop_reason)
    expect(console.log).toHaveBeenCalledWith("[DiffCommit] Usage: ", mockMessage.usage)
  })
})
