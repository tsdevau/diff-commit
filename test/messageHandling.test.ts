import * as vscode from "vscode"
import { activate } from "../src/extension"

// Mock Anthropic SDK
jest.mock("@anthropic-ai/sdk", () => {
  return {
    __esModule: true,
    default: jest.fn().mockImplementation(() => ({
      messages: {
        create: jest.fn(),
      },
    })),
  }
})

jest.mock("vscode")

describe("Message Handling", () => {
  let mockContext: any
  let configGetMock: jest.Mock
  let mockAnthropicSDK: any
  let mockGitRepo: any

  beforeEach(() => {
    jest.clearAllMocks()

    // Mock context with secrets
    mockContext = {
      subscriptions: [],
      secrets: {
        get: jest.fn().mockResolvedValue("sk-ant-api-valid-key"),
        store: jest.fn(),
        delete: jest.fn(),
      },
    }

    // Reset workspace configuration mock
    configGetMock = jest.fn()
    ;(vscode.workspace.getConfiguration as jest.Mock).mockImplementation((section?: string) => {
      if (section === "diffCommit") {
        return {
          get: configGetMock,
        }
      }
      return {
        get: jest.fn(),
      }
    })

    // Get reference to mocked Anthropic SDK
    mockAnthropicSDK = require("@anthropic-ai/sdk").default

    // Setup mock Git repo with proper structure
    mockGitRepo = {
      state: {
        HEAD: {
          name: "main",
        },
      },
      inputBox: { value: "" },
      diff: jest.fn().mockResolvedValue("test diff"),
    }

    // Mock Git extension with proper API structure
    const mockGitExtension = {
      exports: {
        getAPI: (version: number) => ({
          repositories: [mockGitRepo],
        }),
      },
    }

    ;(vscode.extensions.getExtension as jest.Mock).mockImplementation((extensionId: string) => {
      if (extensionId === "vscode.git") {
        return mockGitExtension
      }
      return undefined
    })

    // Mock workspace event handlers
    ;(vscode.workspace.onDidSaveTextDocument as jest.Mock).mockReturnValue({ dispose: jest.fn() })
    ;(vscode.workspace.onDidCloseTextDocument as jest.Mock).mockReturnValue({ dispose: jest.fn() })

    // Mock workspace folders
    ;(vscode.workspace.workspaceFolders as any) = [{ uri: { fsPath: "/test/workspace" } }]
  })

  describe("Message Formatting", () => {
    it("should replace asterisk bullet points with hyphens", async () => {
      const messageWithBullets = "feat(scope): changes\n* Change 1\n* Change 2"
      const expectedMessage = "feat(scope): changes\n- Change 1\n- Change 2"

      // Mock Anthropic response
      mockAnthropicSDK.mockImplementation(() => ({
        messages: {
          create: jest.fn().mockResolvedValue({
            content: [{ type: "text", text: messageWithBullets }],
            stop_reason: "end_turn",
            usage: { input_tokens: 10, output_tokens: 20 },
          }),
        },
      }))

      await activate(mockContext)
      await vscode.commands.executeCommand("diffCommit.generateCommitMessage")
      expect(mockGitRepo.inputBox.value).toBe(expectedMessage)
    })

    it("should handle multiple bullet points", async () => {
      const messageWithBullets = "feat(scope): changes\n* Change 1\n* Change 2\n* Change 3"
      const expectedMessage = "feat(scope): changes\n- Change 1\n- Change 2\n- Change 3"

      mockAnthropicSDK.mockImplementation(() => ({
        messages: {
          create: jest.fn().mockResolvedValue({
            content: [{ type: "text", text: messageWithBullets }],
            stop_reason: "end_turn",
            usage: { input_tokens: 10, output_tokens: 20 },
          }),
        },
      }))

      await activate(mockContext)
      await vscode.commands.executeCommand("diffCommit.generateCommitMessage")
      expect(mockGitRepo.inputBox.value).toBe(expectedMessage)
    })
  })

  describe("Content Type Handling", () => {
    it("should handle non-text content type", async () => {
      mockAnthropicSDK.mockImplementation(() => ({
        messages: {
          create: jest.fn().mockResolvedValue({
            content: [{ type: "image", text: "some-image-data" }],
            stop_reason: "end_turn",
            usage: { input_tokens: 10, output_tokens: 20 },
          }),
        },
      }))

      await activate(mockContext)
      await vscode.commands.executeCommand("diffCommit.generateCommitMessage")
      expect(mockGitRepo.inputBox.value).toBe("")
    })

    it("should handle undefined message content", async () => {
      mockAnthropicSDK.mockImplementation(() => ({
        messages: {
          create: jest.fn().mockResolvedValue({
            content: undefined,
            stop_reason: "end_turn",
            usage: { input_tokens: 10, output_tokens: 20 },
          }),
        },
      }))

      await activate(mockContext)
      await vscode.commands.executeCommand("diffCommit.generateCommitMessage")
      expect(mockGitRepo.inputBox.value).toBe("")
    })

    it("should handle empty content array", async () => {
      mockAnthropicSDK.mockImplementation(() => ({
        messages: {
          create: jest.fn().mockResolvedValue({
            content: [],
            stop_reason: "end_turn",
            usage: { input_tokens: 10, output_tokens: 20 },
          }),
        },
      }))

      await activate(mockContext)
      await vscode.commands.executeCommand("diffCommit.generateCommitMessage")
      expect(mockGitRepo.inputBox.value).toBe("")
    })
  })

  describe("Multiple Content Items", () => {
    it("should concatenate multiple content items", async () => {
      mockAnthropicSDK.mockImplementation(() => ({
        messages: {
          create: jest.fn().mockResolvedValue({
            content: [
              { type: "text", text: "feat(scope): changes\n" },
              { type: "text", text: "* Change 1\n" },
              { type: "text", text: "* Change 2" },
            ],
            stop_reason: "end_turn",
            usage: { input_tokens: 10, output_tokens: 20 },
          }),
        },
      }))

      await activate(mockContext)
      await vscode.commands.executeCommand("diffCommit.generateCommitMessage")
      expect(mockGitRepo.inputBox.value).toBe("feat(scope): changes\n\n- Change 1\n\n- Change 2")
    })

    it("should filter out non-text content items", async () => {
      mockAnthropicSDK.mockImplementation(() => ({
        messages: {
          create: jest.fn().mockResolvedValue({
            content: [
              { type: "text", text: "feat(scope): changes\n" },
              { type: "image", text: "some-image" },
              { type: "text", text: "* Change 1" },
            ],
            stop_reason: "end_turn",
            usage: { input_tokens: 10, output_tokens: 20 },
          }),
        },
      }))

      await activate(mockContext)
      await vscode.commands.executeCommand("diffCommit.generateCommitMessage")
      expect(mockGitRepo.inputBox.value).toBe("feat(scope): changes\n\n- Change 1")
    })
  })
})
