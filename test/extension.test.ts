import * as vscode from "vscode"
import { APIKeyManager } from "../src/apiKeyManager"
import { CommitMessageGenerator } from "../src/commitMessageGenerator"
import { ConfigManager } from "../src/configManager"
import { activate, deactivate } from "../src/extension"
import { GitManager } from "../src/gitManager"
import { OllamaManager } from "../src/ollamaManager"

jest.mock("../src/apiKeyManager")
jest.mock("../src/commitMessageGenerator")
jest.mock("../src/configManager")
jest.mock("../src/gitManager")
jest.mock("../src/ollamaManager")
jest.mock("vscode")

describe("Extension Core Functionality", () => {
  let mockContext: vscode.ExtensionContext
  let mockApiKeyManager: jest.Mocked<APIKeyManager>
  let mockGitManager: jest.Mocked<GitManager>
  let mockConfigManager: jest.Mocked<ConfigManager>
  let mockOllamaManager: jest.Mocked<OllamaManager>
  let mockCommitMessageGenerator: jest.Mocked<CommitMessageGenerator>
  let registeredCommands: Map<string, Function>

  beforeEach(() => {
    jest.clearAllMocks()
    registeredCommands = new Map()

    // Mock console methods
    jest.spyOn(console, "error").mockImplementation()

    // Mock VS Code APIs
    ;(vscode.commands.registerCommand as jest.Mock).mockImplementation((commandId: string, callback: Function) => {
      registeredCommands.set(commandId, callback)
      return { dispose: jest.fn() }
    })
    ;(vscode.workspace.onDidSaveTextDocument as jest.Mock).mockReturnValue({ dispose: jest.fn() })
    ;(vscode.workspace.onDidCloseTextDocument as jest.Mock).mockReturnValue({ dispose: jest.fn() })
    ;(vscode.workspace.workspaceFolders as any) = [{ uri: { fsPath: "/test/workspace" } }]
    ;(vscode.window.withProgress as jest.Mock).mockImplementation(async (options, task) => {
      return await task({ report: jest.fn() })
    })

    // Create mock context
    mockContext = {
      subscriptions: [],
      secrets: {
        get: jest.fn(),
        store: jest.fn(),
        delete: jest.fn(),
      },
    } as unknown as vscode.ExtensionContext

    // Mock manager instances
    mockApiKeyManager = {
      getAPIKey: jest.fn(),
      setAPIKey: jest.fn(),
      deleteAPIKey: jest.fn(),
    } as unknown as jest.Mocked<APIKeyManager>

    mockGitManager = {
      getDiff: jest.fn(),
      setCommitMessage: jest.fn(),
    } as unknown as jest.Mocked<GitManager>

    mockConfigManager = {
      getConfig: jest.fn().mockReturnValue({
        provider: "anthropic",
        model: "claude-sonnet-4-0",
        maxTokens: 1024,
        temperature: 0.2,
        allowedTypes: ["feat", "fix", "refactor", "chore", "docs", "style", "test", "perf", "ci"],
        ollamaHostname: "http://localhost:11434",
        ollamaModel: "llama2",
      }),
    } as unknown as jest.Mocked<ConfigManager>

    mockOllamaManager = {
      configureOllamaModel: jest.fn(),
      changeOllamaModel: jest.fn(),
    } as unknown as jest.Mocked<OllamaManager>

    mockCommitMessageGenerator = {
      generateMessage: jest.fn(),
    } as unknown as jest.Mocked<CommitMessageGenerator>

    // Mock constructor implementations
    ;(APIKeyManager as jest.MockedClass<typeof APIKeyManager>).mockImplementation(() => mockApiKeyManager)
    ;(GitManager as jest.MockedClass<typeof GitManager>).mockImplementation(() => mockGitManager)
    ;(ConfigManager as jest.MockedClass<typeof ConfigManager>).mockImplementation(() => mockConfigManager)
    ;(OllamaManager as jest.MockedClass<typeof OllamaManager>).mockImplementation(() => mockOllamaManager)
    ;(CommitMessageGenerator as jest.MockedClass<typeof CommitMessageGenerator>).mockImplementation(
      () => mockCommitMessageGenerator,
    )
  })

  describe("Extension Activation", () => {
    it("should create all manager instances on activation", () => {
      activate(mockContext)

      expect(APIKeyManager).toHaveBeenCalledWith(mockContext)
      expect(GitManager).toHaveBeenCalled()
      expect(ConfigManager).toHaveBeenCalled()
      expect(OllamaManager).toHaveBeenCalled()
    })

    it("should register all expected commands", () => {
      activate(mockContext)

      const expectedCommands = [
        "diffCommit.updateAPIKey",
        "diffCommit.getAPIKey",
        "diffCommit.deleteAPIKey",
        "diffCommit.configureOllamaModel",
        "diffCommit.changeOllamaModel",
        "diffCommit.generateCommitMessage",
        "diffCommit.previewCommitMessage",
      ]

      expectedCommands.forEach((commandId) => {
        expect(registeredCommands.has(commandId)).toBe(true)
      })
    })

    it("should setup workspace event listeners", () => {
      activate(mockContext)

      expect(vscode.workspace.onDidSaveTextDocument).toHaveBeenCalled()
      expect(vscode.workspace.onDidCloseTextDocument).toHaveBeenCalled()
    })

    it("should add all subscriptions to context", () => {
      activate(mockContext)

      // 7 commands + 2 workspace event handlers = 9 subscriptions
      expect(mockContext.subscriptions).toHaveLength(9)
    })
  })

  describe("generateCommitMessage function", () => {
    beforeEach(() => {
      activate(mockContext)
    })

    it("should show error when no workspace folder is found", async () => {
      ;(vscode.workspace.workspaceFolders as any) = undefined

      const generateCommand = registeredCommands.get("diffCommit.generateCommitMessage")!
      await generateCommand()

      expect(vscode.window.showErrorMessage).toHaveBeenCalledWith("No workspace folder found")
    })

    it("should show error when no changes are detected", async () => {
      mockGitManager.getDiff.mockResolvedValue(undefined)

      const generateCommand = registeredCommands.get("diffCommit.generateCommitMessage")!
      await generateCommand()

      expect(vscode.window.showErrorMessage).toHaveBeenCalledWith("No changes detected")
    })

    it("should handle Ollama provider with missing model", async () => {
      mockGitManager.getDiff.mockResolvedValue("test diff")
      mockConfigManager.getConfig.mockReturnValue({
        provider: "ollama",
        ollamaHostname: "http://localhost:11434",
        ollamaModel: "",
        model: "claude-sonnet-4-0",
        maxTokens: 1024,
        temperature: 0.2,
        allowedTypes: ["feat", "fix", "refactor", "chore", "docs", "style", "test", "perf", "ci"],
      })

      const generateCommand = registeredCommands.get("diffCommit.generateCommitMessage")!
      await generateCommand()

      expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
        "No Ollama model selected. Please configure an Ollama model first.",
      )
    })

    it("should create Ollama CommitMessageGenerator for ollama provider", async () => {
      mockGitManager.getDiff.mockResolvedValue("test diff")
      mockConfigManager.getConfig.mockReturnValue({
        provider: "ollama",
        ollamaHostname: "http://localhost:11434",
        ollamaModel: "llama2",
        model: "claude-sonnet-4-0",
        maxTokens: 1024,
        temperature: 0.2,
        allowedTypes: ["feat", "fix", "refactor", "chore", "docs", "style", "test", "perf", "ci"],
      })
      mockCommitMessageGenerator.generateMessage.mockResolvedValue("feat: test commit")

      const generateCommand = registeredCommands.get("diffCommit.generateCommitMessage")!
      await generateCommand()

      expect(CommitMessageGenerator).toHaveBeenCalledWith("http://localhost:11434", "llama2")
      expect(mockCommitMessageGenerator.generateMessage).toHaveBeenCalled()
    })

    it("should handle Anthropic provider with missing API key", async () => {
      mockGitManager.getDiff.mockResolvedValue("test diff")
      mockApiKeyManager.getAPIKey.mockResolvedValue(undefined)
      mockApiKeyManager.setAPIKey.mockResolvedValue(undefined)

      const generateCommand = registeredCommands.get("diffCommit.generateCommitMessage")!
      await generateCommand()

      expect(vscode.window.showErrorMessage).toHaveBeenCalledWith("API Key is required")
    })

    it("should create Anthropic CommitMessageGenerator for anthropic provider", async () => {
      mockGitManager.getDiff.mockResolvedValue("test diff")
      mockApiKeyManager.getAPIKey.mockResolvedValue("sk-test-key")
      mockCommitMessageGenerator.generateMessage.mockResolvedValue("feat: test commit")

      const generateCommand = registeredCommands.get("diffCommit.generateCommitMessage")!
      await generateCommand()

      expect(CommitMessageGenerator).toHaveBeenCalledWith("sk-test-key")
      expect(mockCommitMessageGenerator.generateMessage).toHaveBeenCalled()
      expect(mockGitManager.setCommitMessage).toHaveBeenCalledWith("feat: test commit")
    })

    it("should fall back to setAPIKey when getAPIKey returns null", async () => {
      mockGitManager.getDiff.mockResolvedValue("test diff")
      mockApiKeyManager.getAPIKey.mockResolvedValue(undefined)
      mockApiKeyManager.setAPIKey.mockResolvedValue("sk-new-key")
      mockCommitMessageGenerator.generateMessage.mockResolvedValue("feat: test commit")

      const generateCommand = registeredCommands.get("diffCommit.generateCommitMessage")!
      await generateCommand()

      expect(mockApiKeyManager.setAPIKey).toHaveBeenCalled()
      expect(CommitMessageGenerator).toHaveBeenCalledWith("sk-new-key")
    })

    it("should show progress with correct options", async () => {
      mockGitManager.getDiff.mockResolvedValue("test diff")
      mockApiKeyManager.getAPIKey.mockResolvedValue("sk-test-key")
      mockCommitMessageGenerator.generateMessage.mockResolvedValue("feat: test commit")

      const generateCommand = registeredCommands.get("diffCommit.generateCommitMessage")!
      await generateCommand()

      expect(vscode.window.withProgress).toHaveBeenCalledWith(
        {
          location: vscode.ProgressLocation.Notification,
          title: "Diff Commit",
          cancellable: true,
        },
        expect.any(Function),
      )
    })

    it("should handle errors gracefully", async () => {
      mockGitManager.getDiff.mockRejectedValue(new Error("Git error"))

      const generateCommand = registeredCommands.get("diffCommit.generateCommitMessage")!
      await generateCommand()

      expect(console.error).toHaveBeenCalledWith("Error writing commit message to SCM:\n\nError: Git error")
      expect(vscode.window.showErrorMessage).toHaveBeenCalledWith("Failed to write to SCM:\n\nGit error")
    })
  })

  describe("Preview Command", () => {
    beforeEach(() => {
      activate(mockContext)
    })

    it("should open preview document for generated commit message", async () => {
      const mockDocument = { getText: jest.fn().mockReturnValue("feat: test commit") }
      mockGitManager.getDiff.mockResolvedValue("test diff")
      mockApiKeyManager.getAPIKey.mockResolvedValue("sk-test-key")
      mockCommitMessageGenerator.generateMessage.mockResolvedValue("feat: test commit")
      ;(vscode.workspace.openTextDocument as jest.Mock).mockResolvedValue(mockDocument)
      ;(vscode.window.showTextDocument as jest.Mock).mockResolvedValue(undefined)

      const previewCommand = registeredCommands.get("diffCommit.previewCommitMessage")!
      await previewCommand()

      expect(vscode.workspace.openTextDocument).toHaveBeenCalledWith({
        content: "feat: test commit",
        language: "markdown",
      })
      expect(vscode.window.showTextDocument).toHaveBeenCalledWith(mockDocument)
    })

    it("should handle preview errors gracefully", async () => {
      mockGitManager.getDiff.mockResolvedValue("test diff")
      mockApiKeyManager.getAPIKey.mockResolvedValue("sk-test-key")
      mockCommitMessageGenerator.generateMessage.mockResolvedValue("feat: test commit")
      ;(vscode.workspace.openTextDocument as jest.Mock).mockRejectedValue(new Error("Preview error"))

      const previewCommand = registeredCommands.get("diffCommit.previewCommitMessage")!
      await previewCommand()

      expect(console.error).toHaveBeenCalledWith("Error opening commit message preview:\n\nError: Preview error")
      expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
        "Failed to open commit message preview:\n\nPreview error",
      )
    })

    it("should not create preview if no commit message is generated", async () => {
      mockGitManager.getDiff.mockResolvedValue("test diff")
      mockApiKeyManager.getAPIKey.mockResolvedValue("sk-test-key")
      mockCommitMessageGenerator.generateMessage.mockResolvedValue(undefined)

      const previewCommand = registeredCommands.get("diffCommit.previewCommitMessage")!
      await previewCommand()

      expect(vscode.workspace.openTextDocument).not.toHaveBeenCalled()
      expect(vscode.window.showTextDocument).not.toHaveBeenCalled()
    })
  })

  describe("Document Event Handlers", () => {
    let saveCallback: Function
    let closeCallback: Function
    let mockPreviewDocument: any

    beforeEach(() => {
      ;(vscode.workspace.onDidSaveTextDocument as jest.Mock).mockImplementation((callback) => {
        saveCallback = callback
        return { dispose: jest.fn() }
      })
      ;(vscode.workspace.onDidCloseTextDocument as jest.Mock).mockImplementation((callback) => {
        closeCallback = callback
        return { dispose: jest.fn() }
      })

      mockPreviewDocument = { getText: jest.fn().mockReturnValue("feat: updated commit") }

      activate(mockContext)
    })

    it("should update git commit message when preview document is saved", () => {
      // First create a preview document
      mockGitManager.getDiff.mockResolvedValue("test diff")
      mockApiKeyManager.getAPIKey.mockResolvedValue("sk-test-key")
      mockCommitMessageGenerator.generateMessage.mockResolvedValue("feat: test commit")
      ;(vscode.workspace.openTextDocument as jest.Mock).mockResolvedValue(mockPreviewDocument)

      // Trigger preview command to set previewDocument
      const previewCommand = registeredCommands.get("diffCommit.previewCommitMessage")!
      return previewCommand().then(() => {
        // Now trigger save event
        saveCallback(mockPreviewDocument)

        expect(mockGitManager.setCommitMessage).toHaveBeenCalledWith("feat: updated commit")
      })
    })

    it("should not update git commit message when other document is saved", () => {
      const otherDocument = { getText: jest.fn().mockReturnValue("other content") }

      saveCallback(otherDocument)

      expect(mockGitManager.setCommitMessage).not.toHaveBeenCalled()
    })

    it("should clear preview document reference when preview document is closed", () => {
      // First create a preview document
      mockGitManager.getDiff.mockResolvedValue("test diff")
      mockApiKeyManager.getAPIKey.mockResolvedValue("sk-test-key")
      mockCommitMessageGenerator.generateMessage.mockResolvedValue("feat: test commit")
      ;(vscode.workspace.openTextDocument as jest.Mock).mockResolvedValue(mockPreviewDocument)

      // Trigger preview command to set previewDocument
      const previewCommand = registeredCommands.get("diffCommit.previewCommitMessage")!
      return previewCommand().then(() => {
        // Now trigger close event
        closeCallback(mockPreviewDocument)

        // Subsequent save should not trigger setCommitMessage
        saveCallback(mockPreviewDocument)
        expect(mockGitManager.setCommitMessage).not.toHaveBeenCalled()
      })
    })

    it("should not clear preview document reference when other document is closed", () => {
      const otherDocument = { getText: jest.fn().mockReturnValue("other content") }

      // First create a preview document
      mockGitManager.getDiff.mockResolvedValue("test diff")
      mockApiKeyManager.getAPIKey.mockResolvedValue("sk-test-key")
      mockCommitMessageGenerator.generateMessage.mockResolvedValue("feat: test commit")
      ;(vscode.workspace.openTextDocument as jest.Mock).mockResolvedValue(mockPreviewDocument)

      // Trigger preview command to set previewDocument
      const previewCommand = registeredCommands.get("diffCommit.previewCommitMessage")!
      return previewCommand().then(() => {
        // Now close other document
        closeCallback(otherDocument)

        // Save of preview document should still work
        saveCallback(mockPreviewDocument)
        expect(mockGitManager.setCommitMessage).toHaveBeenCalledWith("feat: updated commit")
      })
    })
  })

  describe("Command Delegation", () => {
    beforeEach(() => {
      activate(mockContext)
    })

    it("should delegate API key management commands correctly", () => {
      const updateKeyCommand = registeredCommands.get("diffCommit.updateAPIKey")!
      const getKeyCommand = registeredCommands.get("diffCommit.getAPIKey")!
      const deleteKeyCommand = registeredCommands.get("diffCommit.deleteAPIKey")!

      updateKeyCommand()
      getKeyCommand()
      deleteKeyCommand()

      expect(mockApiKeyManager.setAPIKey).toHaveBeenCalled()
      expect(mockApiKeyManager.getAPIKey).toHaveBeenCalled()
      expect(mockApiKeyManager.deleteAPIKey).toHaveBeenCalled()
    })

    it("should delegate Ollama model commands correctly", () => {
      const configureModelCommand = registeredCommands.get("diffCommit.configureOllamaModel")!
      const changeModelCommand = registeredCommands.get("diffCommit.changeOllamaModel")!

      configureModelCommand()
      changeModelCommand()

      expect(mockOllamaManager.configureOllamaModel).toHaveBeenCalledTimes(1)
      expect(mockOllamaManager.changeOllamaModel).toHaveBeenCalledTimes(1)
    })
  })

  describe("Error Handling Edge Cases", () => {
    beforeEach(() => {
      activate(mockContext)
    })

    it("should handle non-Error objects in generateCommitMessage", async () => {
      mockGitManager.getDiff.mockRejectedValue("String error")

      const generateCommand = registeredCommands.get("diffCommit.generateCommitMessage")!
      await generateCommand()

      expect(console.error).toHaveBeenCalledWith("Error writing commit message to SCM:\n\nString error")
      expect(vscode.window.showErrorMessage).toHaveBeenCalledWith("Failed to write to SCM:\n\nString error")
    })

    it("should handle non-Error objects in previewCommitMessage", async () => {
      mockGitManager.getDiff.mockResolvedValue("test diff")
      mockApiKeyManager.getAPIKey.mockResolvedValue("sk-test-key")
      mockCommitMessageGenerator.generateMessage.mockResolvedValue("feat: test commit")
      ;(vscode.workspace.openTextDocument as jest.Mock).mockRejectedValue("String error")

      const previewCommand = registeredCommands.get("diffCommit.previewCommitMessage")!
      await previewCommand()

      expect(console.error).toHaveBeenCalledWith("Error opening commit message preview:\n\nString error")
      expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
        "Failed to open commit message preview:\n\nString error",
      )
    })
  })

  describe("Extension Deactivation", () => {
    it("should handle deactivation gracefully", () => {
      expect(() => deactivate()).not.toThrow()
    })
  })
})
