// Mock Anthropic API at the top level
const mockAnthropicCreate = jest.fn()

// Mock Ollama API at the top level
const mockOllamaGenerate = jest.fn()

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

// Create mock Ollama constructor
function MockOllama() {
  return {
    generate: mockOllamaGenerate,
  }
}

jest.mock("@anthropic-ai/sdk", () => ({
  __esModule: true,
  default: MockAnthropic,
}))

jest.mock("ollama", () => ({
  Ollama: MockOllama,
}))

import { APIKeyManager } from "../src/apiKeyManager"

jest.mock("../src/apiKeyManager")

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
          model: "claude-sonnet-4-0",
          maxTokens: 1024,
          temperature: 0.2,
          provider: "anthropic",
          ollamaHostname: "http://localhost:11434",
          ollamaModel: "",
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
    ;(APIKeyManager.prototype.getAPIKey as jest.Mock).mockResolvedValue("sk-test-api-key")

    activate(mockContext)
    await mockCommands["diffCommit.generateCommitMessage"]()

    // Verify console.log was called with the expected arguments
    expect(console.log).toHaveBeenCalledWith("[DiffCommit] Stop Reason: ", mockMessage.stop_reason)
    expect(console.log).toHaveBeenCalledWith("[DiffCommit] Input Tokens: ", mockMessage.usage.input_tokens)
    expect(console.log).toHaveBeenCalledWith("[DiffCommit] Output Tokens: ", mockMessage.usage.output_tokens)
  })

  describe("Anthropic API Error Handling", () => {
    it("handles 400 Bad Request error", async () => {
      const apiError = new Anthropic.APIError(400, "Bad request", "api_error", {})
      mockAnthropicCreate.mockRejectedValue(apiError)
      ;(APIKeyManager.prototype.getAPIKey as jest.Mock).mockResolvedValue("sk-test-api-key")

      activate(mockContext)
      await mockCommands["diffCommit.generateCommitMessage"]()

      expect(vscode.window.showErrorMessage).toHaveBeenCalledWith("Bad request. Review your prompt and try again.")
      expect(console.error).toHaveBeenCalledWith("Anthropic API Error (400):\n\nBad request")
    })

    it("handles 401 Unauthorised error", async () => {
      const apiError = new Anthropic.APIError(401, "Invalid API key", "api_error", {})
      mockAnthropicCreate.mockRejectedValue(apiError)
      ;(APIKeyManager.prototype.getAPIKey as jest.Mock).mockResolvedValue("sk-test-api-key")

      activate(mockContext)
      await mockCommands["diffCommit.generateCommitMessage"]()

      expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
        "Invalid API key. Please update your API key and try again.",
      )
      expect(console.error).toHaveBeenCalledWith("Anthropic API Error (401):\n\nInvalid API key")
    })

    it("handles 403 Forbidden error", async () => {
      const apiError = new Anthropic.APIError(403, "Permission denied", "api_error", {})
      mockAnthropicCreate.mockRejectedValue(apiError)
      ;(APIKeyManager.prototype.getAPIKey as jest.Mock).mockResolvedValue("sk-test-api-key")

      activate(mockContext)
      await mockCommands["diffCommit.generateCommitMessage"]()

      expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
        "Permission Denied. Review your prompt or API key and try again.",
      )
      expect(console.error).toHaveBeenCalledWith("Anthropic API Error (403):\n\nPermission denied")
    })

    it("handles 429 Rate Limit error", async () => {
      const apiError = new Anthropic.APIError(429, "Too many requests", "api_error", {})
      mockAnthropicCreate.mockRejectedValue(apiError)
      ;(APIKeyManager.prototype.getAPIKey as jest.Mock).mockResolvedValue("sk-test-api-key")

      activate(mockContext)
      await mockCommands["diffCommit.generateCommitMessage"]()

      expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
        "Rate limit exceeded. Please try again later:\n\nToo many requests",
      )
      expect(console.error).toHaveBeenCalledWith("Anthropic API Error (429):\n\nToo many requests")
    })

    it("handles 500 Server error", async () => {
      const apiError = new Anthropic.APIError(500, "Internal server error", "api_error", {})
      mockAnthropicCreate.mockRejectedValue(apiError)

      activate(mockContext)
      await mockCommands["diffCommit.generateCommitMessage"]()

      expect(vscode.window.showErrorMessage).toHaveBeenCalledWith("Anthropic API server error. Please try again later.")
      expect(console.error).toHaveBeenCalledWith("Anthropic API Error (500):\n\nInternal server error")
    })

    it("handles unknown API error status", async () => {
      const apiError = new Anthropic.APIError(418, "Unknown error", "api_error", {})
      mockAnthropicCreate.mockRejectedValue(apiError)

      activate(mockContext)
      await mockCommands["diffCommit.generateCommitMessage"]()

      expect(vscode.window.showErrorMessage).toHaveBeenCalledWith("Failed to generate commit message:\n\nUnknown error")
      expect(console.error).toHaveBeenCalledWith("Anthropic API Error (418):\n\nUnknown error")
    })

    it("handles non-APIError exceptions", async () => {
      const regularError = new Error("Network connection failed")
      mockAnthropicCreate.mockRejectedValue(regularError)
      ;(APIKeyManager.prototype.getAPIKey as jest.Mock).mockResolvedValue("sk-test-api-key")

      activate(mockContext)
      await mockCommands["diffCommit.generateCommitMessage"]()

      expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
        "Unknown error generating commit message: Network connection failed",
      )
      expect(console.error).toHaveBeenCalledWith("Unknown error: Network connection failed")
    })

    it("handles non-Error objects", async () => {
      const stringError = "Something went wrong"
      mockAnthropicCreate.mockRejectedValue(stringError)
      ;(APIKeyManager.prototype.getAPIKey as jest.Mock).mockResolvedValue("sk-test-api-key")

      activate(mockContext)
      await mockCommands["diffCommit.generateCommitMessage"]()

      expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
        "Unknown error generating commit message: Something went wrong",
      )
      expect(console.error).toHaveBeenCalledWith("Unknown error: Something went wrong")
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
    expect(console.error).toHaveBeenCalledWith("Error writing commit message to SCM:\n\nError: SCM error")
    expect(vscode.window.showErrorMessage).toHaveBeenCalledWith("Failed to write to SCM:\n\nSCM error")
    // Verify finally block still logs
    expect(console.log).toHaveBeenCalledWith("[DiffCommit] Stop Reason: ", mockMessage.stop_reason)
    expect(console.log).toHaveBeenCalledWith("[DiffCommit] Input Tokens: ", mockMessage.usage.input_tokens)
    expect(console.log).toHaveBeenCalledWith("[DiffCommit] Output Tokens: ", mockMessage.usage.output_tokens)
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
    expect(console.error).toHaveBeenCalledWith("Error opening commit message preview:\n\nError: Show document error")
    expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
      "Failed to open commit message preview:\n\nShow document error",
    )
    // Verify finally block still logs
    expect(console.log).toHaveBeenCalledWith("[DiffCommit] Stop Reason: ", mockMessage.stop_reason)
    expect(console.log).toHaveBeenCalledWith("[DiffCommit] Input Tokens: ", mockMessage.usage.input_tokens)
    expect(console.log).toHaveBeenCalledWith("[DiffCommit] Output Tokens: ", mockMessage.usage.output_tokens)
  })

  describe("Ollama Error Handling", () => {
    beforeEach(() => {
      // Override the default configuration mock for Ollama tests
      ;(vscode.workspace as any).getConfiguration = () => ({
        get: (key: string) => {
          const config: { [key: string]: any } = {
            provider: "ollama",
            ollamaHostname: "http://localhost:11434",
            ollamaModel: "llama3.2",
            model: "claude-sonnet-4-0",
            maxTokens: 1000,
            temperature: 0.3,
            allowedTypes: ["feat", "fix", "refactor", "chore", "docs", "style", "test", "perf", "ci"],
          }
          return config[key]
        },
      })
    })

    it("handles TypeError with fetch error (connection errors)", async () => {
      const fetchError = new TypeError("fetch failed")
      mockOllamaGenerate.mockRejectedValue(fetchError)

      activate(mockContext)
      await mockCommands["diffCommit.generateCommitMessage"]()

      expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
        "Unable to connect to Ollama server at http://localhost:11434. Please ensure that the Ollama server is running and accessible.",
      )
      expect(console.error).toHaveBeenCalledWith("Ollama API Error:\n\nTypeError: fetch failed")
    })

    it("handles 404 model not found error", async () => {
      const notFoundError = new Error("404 model not found")
      mockOllamaGenerate.mockRejectedValue(notFoundError)

      activate(mockContext)
      await mockCommands["diffCommit.generateCommitMessage"]()

      expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
        "Model 'llama3.2' not found. Please check if the model is available in Ollama.",
      )
      expect(console.error).toHaveBeenCalledWith("Ollama API Error:\n\nError: 404 model not found")
    })

    it("handles 500 server error", async () => {
      const serverError = new Error("500 internal server error")
      mockOllamaGenerate.mockRejectedValue(serverError)

      activate(mockContext)
      await mockCommands["diffCommit.generateCommitMessage"]()

      expect(vscode.window.showErrorMessage).toHaveBeenCalledWith("Ollama server error. Please try again later.")
      expect(console.error).toHaveBeenCalledWith("Ollama API Error:\n\nError: 500 internal server error")
    })

    it("handles generic Error with custom message", async () => {
      const genericError = new Error("Something went wrong with Ollama")
      mockOllamaGenerate.mockRejectedValue(genericError)

      activate(mockContext)
      await mockCommands["diffCommit.generateCommitMessage"]()

      expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
        "Failed to generate commit message with Ollama:\n\nSomething went wrong with Ollama",
      )
      expect(console.error).toHaveBeenCalledWith("Ollama API Error:\n\nError: Something went wrong with Ollama")
    })

    it("handles unknown error type (not Error instance)", async () => {
      const unknownError = "Some string error"
      mockOllamaGenerate.mockRejectedValue(unknownError)

      activate(mockContext)
      await mockCommands["diffCommit.generateCommitMessage"]()

      expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
        "Unknown error generating commit message with Ollama: Some string error",
      )
      expect(console.error).toHaveBeenCalledWith("Ollama API Error:\n\nSome string error")
    })

    it("handles unknown error with object type", async () => {
      const unknownError = { message: "Object error" }
      mockOllamaGenerate.mockRejectedValue(unknownError)

      activate(mockContext)
      await mockCommands["diffCommit.generateCommitMessage"]()

      expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
        "Unknown error generating commit message with Ollama: [object Object]",
      )
      expect(console.error).toHaveBeenCalledWith("Ollama API Error:\n\n[object Object]")
    })
  })
})
