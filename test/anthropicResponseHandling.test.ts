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
import { extensions, window, workspace, type ExtensionContext } from "vscode"
import { activate } from "../src/extension"

// Store registered command callbacks
const registeredCallbacks = new Map<string, Function>()

jest.mock("vscode", () => {
  const original = jest.requireActual("vscode")
  return {
    ...original,
    window: {
      ...original.window,
      showErrorMessage: jest.fn(),
      showWarningMessage: jest.fn(),
    },
    extensions: {
      ...original.extensions,
      getExtension: jest.fn(),
    },
    commands: {
      registerCommand: jest.fn((id, callback) => {
        registeredCallbacks.set(id, callback)
        return { dispose: jest.fn() }
      }),
    },
    workspace: {
      ...original.workspace,
      workspaceFolders: [
        {
          uri: {
            fsPath: "/test/workspace",
          },
        },
      ],
      getConfiguration: jest.fn().mockReturnValue({
        get: jest.fn((key: string) => {
          switch (key) {
            case "model":
              return "claude-3-5-sonnet-latest"
            case "maxTokens":
              return 1024
            case "temperature":
              return 0.4
            case "allowedTypes":
              return ["feat", "fix", "refactor", "chore", "docs", "style", "test", "perf", "ci"]
            default:
              return undefined
          }
        }),
      }),
    },
  }
})

describe("Anthropic API Response Handling", () => {
  let mockContext: ExtensionContext
  let mockGitRepo: any

  beforeEach(() => {
    jest.clearAllMocks()
    registeredCallbacks.clear()

    // Mock context with secrets
    mockContext = {
      subscriptions: [],
      secrets: {
        get: jest.fn().mockResolvedValue("sk-ant-api-valid-key"),
        store: jest.fn(),
        delete: jest.fn(),
      },
    } as unknown as ExtensionContext

    // Setup basic mock Git repo
    mockGitRepo = {
      diff: jest.fn().mockResolvedValue("test diff"),
      inputBox: { value: "" },
      state: {
        workingTreeChanges: [],
        indexChanges: [],
      },
    }

    // Setup default Git extension mock
    const mockGitExtension = {
      exports: {
        getAPI: jest.fn().mockReturnValue({
          repositories: [mockGitRepo],
        }),
      },
    }
    jest.spyOn(extensions, "getExtension").mockReturnValue(mockGitExtension as any)

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

  describe("API Error Handling", () => {
    it("should handle rate limit errors", async () => {
      const apiError = new Anthropic.APIError(429, "Rate limit exceeded", "api_error", {})
      mockAnthropicCreate.mockRejectedValue(apiError)

      const generateCommitMessage = getCommand("diffCommit.generateCommitMessage")
      await generateCommitMessage()

      expect(window.showErrorMessage).toHaveBeenCalledWith(
        "Rate limit exceeded. Please try again later: Rate limit exceeded",
      )
      expect(mockGitRepo.inputBox.value).toBe("")
    })

    it("should handle authentication errors", async () => {
      const apiError = new Anthropic.APIError(401, "Invalid API key", "api_error", {})
      mockAnthropicCreate.mockRejectedValue(apiError)

      const generateCommitMessage = getCommand("diffCommit.generateCommitMessage")
      await generateCommitMessage()

      expect(window.showErrorMessage).toHaveBeenCalledWith("Invalid API key. Please update your API key and try again.")
      expect(mockGitRepo.inputBox.value).toBe("")
    })

    it("should handle unknown API errors", async () => {
      const apiError = new Anthropic.APIError(418, "Unknown error", "api_error", {})
      mockAnthropicCreate.mockRejectedValue(apiError)

      const generateCommitMessage = getCommand("diffCommit.generateCommitMessage")
      await generateCommitMessage()

      expect(window.showErrorMessage).toHaveBeenCalledWith("Failed to generate commit message: Unknown error")
      expect(mockGitRepo.inputBox.value).toBe("")
    })
  })

  describe("Response Content Handling", () => {
    it("should handle empty content array", async () => {
      mockAnthropicCreate.mockResolvedValue({
        content: [],
        stop_reason: "end_turn",
        usage: { input_tokens: 100, output_tokens: 0 },
      })

      const generateCommitMessage = getCommand("diffCommit.generateCommitMessage")
      await generateCommitMessage()

      expect(mockGitRepo.inputBox.value).toBe("")
    })

    it("should handle non-text content", async () => {
      mockAnthropicCreate.mockResolvedValue({
        content: [{ type: "image", source: { type: "base64", media_type: "image/png", data: "some-image-data" } }],
        stop_reason: "end_turn",
        usage: { input_tokens: 100, output_tokens: 50 },
      })

      const generateCommitMessage = getCommand("diffCommit.generateCommitMessage")
      await generateCommitMessage()

      expect(mockGitRepo.inputBox.value).toBe("")
    })

    it("should handle mixed content types", async () => {
      mockAnthropicCreate.mockResolvedValue({
        content: [
          { type: "text", text: "feat(scope): add feature" },
          { type: "image", source: { type: "base64", media_type: "image/png", data: "some-image" } },
        ],
        stop_reason: "end_turn",
        usage: { input_tokens: 100, output_tokens: 50 },
      })

      const generateCommitMessage = getCommand("diffCommit.generateCommitMessage")
      await generateCommitMessage()

      expect(mockGitRepo.inputBox.value).toBe("feat(scope): add feature")
    })

    it("should handle multiple text segments", async () => {
      mockAnthropicCreate.mockResolvedValue({
        content: [{ type: "text", text: "feat(scope): add feature\n\n* Change 1\n* Change 2" }],
        stop_reason: "end_turn",
        usage: { input_tokens: 100, output_tokens: 50 },
      })

      const generateCommitMessage = getCommand("diffCommit.generateCommitMessage")
      await generateCommitMessage()

      expect(mockGitRepo.inputBox.value).toBe("feat(scope): add feature\n\n- Change 1\n- Change 2")
    })

    it("should handle excessive newlines", async () => {
      mockAnthropicCreate.mockResolvedValue({
        content: [
          {
            type: "text",
            text: "feat(scope): add feature\n\n\n* Change 1\n\n\n* Change 2\n\n\n",
          },
        ],
        stop_reason: "end_turn",
        usage: { input_tokens: 100, output_tokens: 50 },
      })

      const generateCommitMessage = getCommand("diffCommit.generateCommitMessage")
      await generateCommitMessage()

      expect(mockGitRepo.inputBox.value).toBe("feat(scope): add feature\n\n- Change 1\n\n- Change 2")
    })
  })

  describe("Response Metadata Handling", () => {
    it("should log stop reason", async () => {
      const consoleSpy = jest.spyOn(console, "log")
      mockAnthropicCreate.mockResolvedValue({
        content: [{ type: "text", text: "test message" }],
        stop_reason: "end_turn",
        usage: { input_tokens: 100, output_tokens: 50 },
      })

      const generateCommitMessage = getCommand("diffCommit.generateCommitMessage")
      await generateCommitMessage()

      expect(consoleSpy).toHaveBeenCalledWith("[DiffCommit] Stop Reason: ", "end_turn")
    })

    it("should log usage data", async () => {
      const consoleSpy = jest.spyOn(console, "log")
      mockAnthropicCreate.mockResolvedValue({
        content: [{ type: "text", text: "test message" }],
        stop_reason: "end_turn",
        usage: { input_tokens: 100, output_tokens: 50 },
      })

      const generateCommitMessage = getCommand("diffCommit.generateCommitMessage")
      await generateCommitMessage()

      expect(consoleSpy).toHaveBeenCalledWith("[DiffCommit] Usage: ", { input_tokens: 100, output_tokens: 50 })
    })
  })

  describe("XML Tag Handling", () => {
    it("should include task and instructions tags in prompt", async () => {
      const generateCommitMessage = getCommand("diffCommit.generateCommitMessage")
      await generateCommitMessage()

      expect(mockAnthropicCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: expect.arrayContaining([
            expect.objectContaining({
              content: expect.stringContaining("<task>"),
            }),
          ]),
        }),
      )

      expect(mockAnthropicCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: expect.arrayContaining([
            expect.objectContaining({
              content: expect.stringContaining("<instructions>"),
            }),
          ]),
        }),
      )
    })

    it("should include custom instructions in XML tags when provided", async () => {
      jest.spyOn(workspace, "getConfiguration").mockReturnValue({
        get: jest.fn((key: string) => {
          if (key === "customInstructions") {
            return "Use emoji in commit messages"
          }
          return undefined
        }),
      } as any)

      const generateCommitMessage = getCommand("diffCommit.generateCommitMessage")
      await generateCommitMessage()

      expect(mockAnthropicCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: expect.arrayContaining([
            expect.objectContaining({
              content: expect.stringContaining(
                "<customInstructions>\nUse emoji in commit messages\n</customInstructions>",
              ),
            }),
          ]),
        }),
      )
    })
  })
})
