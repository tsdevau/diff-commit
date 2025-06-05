import * as vscode from "vscode"
import { activate } from "../src/extension"

jest.mock("vscode")

describe("Configuration Handling", () => {
  let mockContext: any
  let configGetMock: jest.Mock

  beforeEach(() => {
    jest.clearAllMocks()

    // Mock context
    mockContext = {
      subscriptions: [],
      secrets: {
        get: jest.fn().mockResolvedValue("sk-ant-api-valid-key"),
        store: jest.fn(),
        delete: jest.fn(),
      },
    }

    // Mock workspace configuration
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

    // Mock workspace event handlers
    ;(vscode.workspace.onDidSaveTextDocument as jest.Mock).mockReturnValue({ dispose: jest.fn() })
    ;(vscode.workspace.onDidCloseTextDocument as jest.Mock).mockReturnValue({ dispose: jest.fn() })

    // Mock Git extension
    const mockGitRepo = {
      state: {
        HEAD: {
          name: "main",
        },
      },
      inputBox: { value: "" },
      diff: jest.fn().mockResolvedValue("test diff"),
    }

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

    // Mock workspace folders
    ;(vscode.workspace.workspaceFolders as any) = [{ uri: { fsPath: "/test/workspace" } }]
  })

  it("should use configured values when available", async () => {
    configGetMock.mockImplementation((key: string) => {
      const config: { [key: string]: any } = {
        model: "claude-3",
        maxTokens: 2000,
        temperature: 0.5,
        allowedTypes: ["feat", "fix"],
        customInstructions: "custom instructions",
        provider: "anthropic",
        ollamaHostname: "http://localhost:11434",
        ollamaModel: "",
      }
      return config[key]
    })

    activate(mockContext)
    await vscode.commands.executeCommand("diffCommit.generateCommitMessage")

    expect(configGetMock).toHaveBeenCalledWith("model")
    expect(configGetMock).toHaveBeenCalledWith("maxTokens")
    expect(configGetMock).toHaveBeenCalledWith("temperature")
    expect(configGetMock).toHaveBeenCalledWith("allowedTypes")
    expect(configGetMock).toHaveBeenCalledWith("customInstructions")
    expect(configGetMock).toHaveBeenCalledWith("provider")
    expect(configGetMock).toHaveBeenCalledWith("ollamaHostname")
    expect(configGetMock).toHaveBeenCalledWith("ollamaModel")
  })

  it("should use default values when configuration is missing", async () => {
    configGetMock.mockReturnValue(undefined)

    activate(mockContext)
    await vscode.commands.executeCommand("diffCommit.generateCommitMessage")

    expect(configGetMock).toHaveBeenCalled()
  })

  it("should handle custom instructions when provided", async () => {
    configGetMock.mockImplementation((key: string) => {
      if (key === "customInstructions") {
        return "custom instructions"
      }
      return undefined
    })

    activate(mockContext)
    await vscode.commands.executeCommand("diffCommit.generateCommitMessage")

    expect(configGetMock).toHaveBeenCalledWith("customInstructions")
  })

  it("should handle Ollama provider configuration", async () => {
    configGetMock.mockImplementation((key: string) => {
      const config: { [key: string]: any } = {
        provider: "ollama",
        ollamaHostname: "http://localhost:11434",
        ollamaModel: "llama2",
        model: "claude-sonnet-4-0", // Not used for Ollama but still configured
        maxTokens: 1000,
        temperature: 0.3,
      }
      return config[key]
    })

    activate(mockContext)
    await vscode.commands.executeCommand("diffCommit.generateCommitMessage")

    expect(configGetMock).toHaveBeenCalledWith("provider")
    expect(configGetMock).toHaveBeenCalledWith("ollamaHostname")
    expect(configGetMock).toHaveBeenCalledWith("ollamaModel")
  })

  it("should show error when Ollama model is not configured", async () => {
    configGetMock.mockImplementation((key: string) => {
      const config: { [key: string]: any } = {
        provider: "ollama",
        ollamaHostname: "http://localhost:11434",
        ollamaModel: "", // Empty model
      }
      return config[key]
    })

    activate(mockContext)
    await vscode.commands.executeCommand("diffCommit.generateCommitMessage")

    expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
      "No Ollama model selected. Please configure an Ollama model first.",
    )
  })

  it("should handle missing workspace folder", async () => {
    ;(vscode.workspace.workspaceFolders as any) = undefined

    activate(mockContext)
    await vscode.commands.executeCommand("diffCommit.generateCommitMessage")

    expect(vscode.window.showErrorMessage).toHaveBeenCalledWith("No workspace folder found")
  })

  it("should handle missing Git extension", async () => {
    ;(vscode.extensions.getExtension as jest.Mock).mockReturnValue(undefined)

    activate(mockContext)
    await vscode.commands.executeCommand("diffCommit.generateCommitMessage")

    expect(vscode.window.showErrorMessage).toHaveBeenCalledWith("Git extension not found")
  })

  it("should handle empty Git repositories", async () => {
    const mockGitExtension = {
      exports: {
        getAPI: (version: number) => ({
          repositories: [],
        }),
      },
    }

    ;(vscode.extensions.getExtension as jest.Mock).mockImplementation((extensionId: string) => {
      if (extensionId === "vscode.git") {
        return mockGitExtension
      }
      return undefined
    })

    activate(mockContext)
    await vscode.commands.executeCommand("diffCommit.generateCommitMessage")

    expect(vscode.window.showErrorMessage).toHaveBeenCalledWith("No Git repository found")
  })

  it("should handle no Git changes", async () => {
    const mockGitRepo = {
      state: {
        HEAD: {
          name: "main",
        },
      },
      inputBox: { value: "" },
      diff: jest.fn().mockResolvedValue(""),
    }

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

    activate(mockContext)
    await vscode.commands.executeCommand("diffCommit.generateCommitMessage")

    expect(vscode.window.showErrorMessage).toHaveBeenCalledWith("No changes detected")
  })
})
