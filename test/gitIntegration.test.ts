import { extensions, window, type ExtensionContext } from "vscode"
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
              return "claude-3-5-sonnet-20241022"
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

describe("Git Integration", () => {
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
      diff: jest.fn(),
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

  describe("Git Extension Availability", () => {
    it("should handle missing Git extension", async () => {
      jest.spyOn(extensions, "getExtension").mockReturnValue(undefined)

      const generateCommitMessage = getCommand("diffCommit.generateCommitMessage")
      await generateCommitMessage()

      expect(window.showErrorMessage).toHaveBeenCalledWith("Git extension not found")
    })

    it("should handle Git extension without API", async () => {
      jest.spyOn(extensions, "getExtension").mockReturnValue({
        exports: undefined,
      } as any)

      const generateCommitMessage = getCommand("diffCommit.generateCommitMessage")
      await generateCommitMessage()

      expect(window.showErrorMessage).toHaveBeenCalledWith("Git extension not found")
    })
  })

  describe("Repository Management", () => {
    it("should handle no repositories", async () => {
      jest.spyOn(extensions, "getExtension").mockReturnValue({
        exports: {
          getAPI: jest.fn().mockReturnValue({ repositories: [] }),
        },
      } as any)

      const generateCommitMessage = getCommand("diffCommit.generateCommitMessage")
      await generateCommitMessage()

      expect(window.showErrorMessage).toHaveBeenCalledWith("No Git repository found")
    })

    it("should handle multiple repositories", async () => {
      const mockRepos = [
        { ...mockGitRepo, rootUri: { path: "/repo1" }, diff: jest.fn() },
        { ...mockGitRepo, rootUri: { path: "/repo2" }, diff: jest.fn() },
      ]

      mockRepos[0].diff.mockResolvedValue("test diff")

      jest.spyOn(extensions, "getExtension").mockReturnValue({
        exports: {
          getAPI: jest.fn().mockReturnValue({ repositories: mockRepos }),
        },
      } as any)

      const generateCommitMessage = getCommand("diffCommit.generateCommitMessage")
      await generateCommitMessage()

      expect(mockRepos[0].diff).toHaveBeenCalled()
      expect(mockRepos[1].diff).not.toHaveBeenCalled()
      expect(mockAnthropicCreate).toHaveBeenCalled()
    })
  })

  describe("Diff Handling", () => {
    it("should handle empty diff", async () => {
      mockGitRepo.diff.mockResolvedValue("")

      const generateCommitMessage = getCommand("diffCommit.generateCommitMessage")
      await generateCommitMessage()

      expect(window.showErrorMessage).toHaveBeenCalledWith("No changes detected")
      expect(mockAnthropicCreate).not.toHaveBeenCalled()
    })

    it("should handle diff parsing errors", async () => {
      const error = new Error("Diff error")
      mockGitRepo.diff.mockRejectedValue(error)

      const generateCommitMessage = getCommand("diffCommit.generateCommitMessage")
      await generateCommitMessage()

      expect(window.showErrorMessage).toHaveBeenCalledWith("Failed to write to SCM:\n\nDiff error")
      expect(mockAnthropicCreate).not.toHaveBeenCalled()
    })

    it("should handle staged changes", async () => {
      mockGitRepo.state.indexChanges = [{ uri: { path: "/file1" }, status: 1 }]
      mockGitRepo.diff.mockResolvedValue("staged changes")

      const generateCommitMessage = getCommand("diffCommit.generateCommitMessage")
      await generateCommitMessage()

      expect(mockGitRepo.diff).toHaveBeenCalledWith(true)
      expect(mockAnthropicCreate).toHaveBeenCalledWith({
        model: "claude-3-5-sonnet-20241022",
        max_tokens: 1024,
        temperature: 0.4,
        system: expect.any(String),
        messages: expect.arrayContaining([
          expect.objectContaining({
            role: "user",
            content: expect.stringContaining("staged changes"),
          }),
        ]),
      })
    })

    it("should handle unstaged changes", async () => {
      mockGitRepo.state.workingTreeChanges = [{ uri: { path: "/file1" }, status: 1 }]
      mockGitRepo.diff.mockResolvedValue("unstaged changes")

      const generateCommitMessage = getCommand("diffCommit.generateCommitMessage")
      await generateCommitMessage()

      expect(mockGitRepo.diff).toHaveBeenCalledWith(true)
      expect(mockAnthropicCreate).toHaveBeenCalledWith({
        model: "claude-3-5-sonnet-20241022",
        max_tokens: 1024,
        temperature: 0.4,
        system: expect.any(String),
        messages: expect.arrayContaining([
          expect.objectContaining({
            role: "user",
            content: expect.stringContaining("unstaged changes"),
          }),
        ]),
      })
    })
  })
})
