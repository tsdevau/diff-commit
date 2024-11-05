import { commands, ProgressLocation, window, workspace, type ExtensionContext } from "vscode"
import { APIKeyManager } from "../src/apiKeyManager"
import { CommitMessageGenerator } from "../src/commitMessageGenerator"
import { ConfigManager } from "../src/configManager"
import { activate } from "../src/extension"
import { GitManager } from "../src/gitManager"

jest.mock("../src/gitManager")
jest.mock("../src/apiKeyManager")
jest.mock("../src/commitMessageGenerator")
jest.mock("../src/configManager")

describe("Progress API Integration", () => {
  let context: ExtensionContext
  let mockProgress: { report: jest.Mock }
  let mockGitManager: jest.Mocked<GitManager>

  beforeEach(() => {
    context = {
      subscriptions: [],
      secrets: {
        get: jest.fn(),
        store: jest.fn(),
        delete: jest.fn(),
      },
    } as unknown as ExtensionContext

    mockProgress = {
      report: jest.fn(),
    }

    jest.clearAllMocks()

    // Setup mock git manager instance
    mockGitManager = {
      getDiff: jest.fn().mockResolvedValue(undefined),
      setCommitMessage: jest.fn(),
      getRepo: jest.fn().mockReturnValue(undefined),
    } as jest.Mocked<GitManager>

    // Mock the constructor
    ;(GitManager as jest.MockedClass<typeof GitManager>).mockImplementation(() => mockGitManager)

    // Mock workspace folders
    ;(workspace.workspaceFolders as any) = [
      {
        uri: { fsPath: "/test/workspace" },
        name: "test",
        index: 0,
      },
    ]

    // Setup window.withProgress mock
    ;(window.withProgress as jest.Mock).mockImplementation(async (options, task) => {
      const result = await task(mockProgress)
      return result
    })
  })

  describe("generateCommitMessage command", () => {
    it("should show progress with correct options", async () => {
      activate(context)
      await commands.executeCommand("diffCommit.generateCommitMessage")

      expect(window.withProgress).toHaveBeenCalledWith(
        {
          location: ProgressLocation.Notification,
          title: "Generating commit message...",
          cancellable: false,
        },
        expect.any(Function),
      )
    })

    it("should report correct progress messages in sequence", async () => {
      // Setup successful mocks
      const mockDiff = "test diff"
      const mockApiKey = "test-api-key"
      const mockMessage = "test commit message"

      mockGitManager.getDiff.mockResolvedValue(mockDiff)
      ;(APIKeyManager.prototype.getAPIKey as jest.Mock).mockResolvedValue(mockApiKey)
      ;(CommitMessageGenerator.prototype.generateMessage as jest.Mock).mockResolvedValue(mockMessage)

      activate(context)
      await commands.executeCommand("diffCommit.generateCommitMessage")

      // Verify progress messages in order
      expect(mockProgress.report.mock.calls).toEqual([
        [{ message: "Getting git diff..." }],
        [{ message: "Checking API key..." }],
        [{ message: "Generating message..." }],
      ])
    })

    it("should handle no git changes scenario", async () => {
      // Mock no changes
      mockGitManager.getDiff.mockResolvedValue(undefined)

      activate(context)
      await commands.executeCommand("diffCommit.generateCommitMessage")

      // Should only show first progress message
      expect(mockProgress.report).toHaveBeenCalledTimes(1)
      expect(mockProgress.report).toHaveBeenCalledWith({ message: "Getting git diff..." })

      // Should show error message
      expect(window.showErrorMessage).toHaveBeenCalledWith("No changes detected")
    })

    it("should handle missing API key scenario", async () => {
      // Setup mocks
      mockGitManager.getDiff.mockResolvedValue("test diff")
      ;(APIKeyManager.prototype.getAPIKey as jest.Mock).mockResolvedValue(null)
      ;(APIKeyManager.prototype.setAPIKey as jest.Mock).mockResolvedValue(null)

      activate(context)
      await commands.executeCommand("diffCommit.generateCommitMessage")

      // Should show first two progress messages
      expect(mockProgress.report.mock.calls).toEqual([
        [{ message: "Getting git diff..." }],
        [{ message: "Checking API key..." }],
      ])

      // Should show error message
      expect(window.showErrorMessage).toHaveBeenCalledWith("API Key is required")
    })

    it("should handle API key prompt cancellation", async () => {
      // Setup mocks
      mockGitManager.getDiff.mockResolvedValue("test diff")
      ;(APIKeyManager.prototype.getAPIKey as jest.Mock).mockResolvedValue(null)
      ;(APIKeyManager.prototype.setAPIKey as jest.Mock).mockResolvedValue(undefined)

      activate(context)
      await commands.executeCommand("diffCommit.generateCommitMessage")

      // Should show first two progress messages
      expect(mockProgress.report.mock.calls).toEqual([
        [{ message: "Getting git diff..." }],
        [{ message: "Checking API key..." }],
      ])

      // Should show error message
      expect(window.showErrorMessage).toHaveBeenCalledWith("API Key is required")
    })

    it("should complete full progress sequence on successful generation", async () => {
      // Setup successful mocks
      const mockDiff = "test diff"
      const mockApiKey = "test-api-key"
      const mockMessage = "test commit message"
      const mockConfig = { someConfig: "value" }

      mockGitManager.getDiff.mockResolvedValue(mockDiff)
      ;(APIKeyManager.prototype.getAPIKey as jest.Mock).mockResolvedValue(mockApiKey)
      ;(ConfigManager.prototype.getConfig as jest.Mock).mockReturnValue(mockConfig)
      ;(CommitMessageGenerator.prototype.generateMessage as jest.Mock).mockImplementation(() =>
        Promise.resolve(mockMessage),
      )

      activate(context)
      await commands.executeCommand("diffCommit.generateCommitMessage")

      // Verify all progress messages shown
      expect(mockProgress.report.mock.calls).toEqual([
        [{ message: "Getting git diff..." }],
        [{ message: "Checking API key..." }],
        [{ message: "Generating message..." }],
      ])

      // Verify commit message was set
      expect(mockGitManager.setCommitMessage).toHaveBeenCalledWith(mockMessage)
    })
  })
})
