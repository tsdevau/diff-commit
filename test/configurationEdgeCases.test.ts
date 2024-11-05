import { extensions, workspace, type ExtensionContext } from "vscode"
import { activate } from "../src/extension"

// Store registered command callbacks
const registeredCallbacks = new Map<string, Function>()

// Mock Anthropic SDK
const mockAnthropicCreate = jest.fn()
jest.mock("@anthropic-ai/sdk", () => {
  return {
    __esModule: true,
    default: jest.fn().mockImplementation(() => ({
      messages: {
        create: mockAnthropicCreate,
      },
    })),
  }
})

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
    },
  }
})

describe("Configuration Edge Cases", () => {
  let mockContext: ExtensionContext
  let mockGitRepo: any
  let mockConfig: { [key: string]: any }

  beforeEach(() => {
    jest.clearAllMocks()
    registeredCallbacks.clear()

    // Reset config for each test
    mockConfig = {
      model: "claude-3-5-sonnet-latest",
      maxTokens: 1024,
      temperature: 0.3,
      allowedTypes: ["feat", "fix", "refactor", "chore", "docs", "style", "test", "perf", "ci"],
    }

    // Mock workspace.getConfiguration
    jest.spyOn(workspace, "getConfiguration").mockReturnValue({
      get: jest.fn((key: string) => mockConfig[key]),
    } as any)

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

    // Setup default Anthropic mock
    mockAnthropicCreate.mockResolvedValue({
      content: [{ type: "text", text: "test commit message" }],
      stop_reason: "end_turn",
      usage: { input_tokens: 100, output_tokens: 50 },
    })

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

  describe("Model Configuration", () => {
    it("should use default model when model is missing", async () => {
      mockConfig.model = undefined

      const generateCommitMessage = getCommand("diffCommit.generateCommitMessage")
      await generateCommitMessage()

      expect(mockAnthropicCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          model: "claude-3-5-sonnet-latest",
        }),
      )
    })
  })

  describe("Token Configuration", () => {
    it("should allow extremely large maxTokens", async () => {
      mockConfig.maxTokens = 1000000

      const generateCommitMessage = getCommand("diffCommit.generateCommitMessage")
      await generateCommitMessage()

      expect(mockAnthropicCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          max_tokens: 1000000,
        }),
      )
    })

    it("should use default maxTokens when missing", async () => {
      mockConfig.maxTokens = undefined

      const generateCommitMessage = getCommand("diffCommit.generateCommitMessage")
      await generateCommitMessage()

      expect(mockAnthropicCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          max_tokens: 1024,
        }),
      )
    })
  })

  describe("Temperature Configuration", () => {
    it("should allow temperature between 0 and 1", async () => {
      mockConfig.temperature = 0.7

      const generateCommitMessage = getCommand("diffCommit.generateCommitMessage")
      await generateCommitMessage()

      expect(mockAnthropicCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          temperature: 0.7,
        }),
      )
    })

    it("should use default temperature when missing", async () => {
      mockConfig.temperature = undefined

      const generateCommitMessage = getCommand("diffCommit.generateCommitMessage")
      await generateCommitMessage()

      expect(mockAnthropicCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          temperature: 0.3,
        }),
      )
    })
  })

  describe("Allowed Types Configuration", () => {
    it("should handle empty allowed types array", async () => {
      mockConfig.allowedTypes = []

      const generateCommitMessage = getCommand("diffCommit.generateCommitMessage")
      await generateCommitMessage()

      expect(mockAnthropicCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: expect.arrayContaining([
            expect.objectContaining({
              content: expect.stringContaining(" as appropriate for the type of change."), // Empty array results in no types
            }),
          ]),
        }),
      )
    })

    it("should handle custom allowed types", async () => {
      mockConfig.allowedTypes = ["custom1", "custom2"]

      const generateCommitMessage = getCommand("diffCommit.generateCommitMessage")
      await generateCommitMessage()

      expect(mockAnthropicCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: expect.arrayContaining([
            expect.objectContaining({
              content: expect.stringContaining(
                "- Use ONLY 'custom1' | 'custom2' as appropriate for the type of change.",
              ),
            }),
          ]),
        }),
      )
    })

    it("should use default types when missing", async () => {
      mockConfig.allowedTypes = undefined

      const generateCommitMessage = getCommand("diffCommit.generateCommitMessage")
      await generateCommitMessage()

      expect(mockAnthropicCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: expect.arrayContaining([
            expect.objectContaining({
              content: expect.stringContaining(
                "'feat' | 'fix' | 'refactor' | 'chore' | 'docs' | 'style' | 'test' | 'perf' | 'ci'",
              ),
            }),
          ]),
        }),
      )
    })
  })

  describe("Custom Instructions", () => {
    it("should include custom instructions in XML tags", async () => {
      mockConfig.customInstructions = "Use emoji in commit messages"

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

    it("should handle extremely long custom instructions", async () => {
      const longInstructions = "x".repeat(10000)
      mockConfig.customInstructions = longInstructions

      const generateCommitMessage = getCommand("diffCommit.generateCommitMessage")
      await generateCommitMessage()

      expect(mockAnthropicCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: expect.arrayContaining([
            expect.objectContaining({
              content: expect.stringContaining(`<customInstructions>\n${longInstructions}\n</customInstructions>`),
            }),
          ]),
        }),
      )
    })
  })
})
