import { commands, extensions, window, workspace, type ExtensionContext, type WorkspaceConfiguration } from "vscode"
import { activate } from "../src/extension"

// Define the mock workspace type
type MockWorkspace = {
  workspaceFolders: { uri: { fsPath: string }; name: string; index: number }[] | undefined
  getConfiguration: jest.Mock
}

jest.mock("vscode", () => {
  const original = jest.requireActual("vscode")

  // Create mock workspace inside jest.mock
  const mockWorkspace: MockWorkspace = {
    workspaceFolders: [{ uri: { fsPath: "/test/workspace" }, name: "test", index: 0 }],
    getConfiguration: jest.fn(),
  }

  return {
    ...original,
    workspace: mockWorkspace,
  }
})

// Get the mocked workspace
const mockWorkspace = workspace as unknown as MockWorkspace

describe("Configuration Handling", () => {
  let mockContext: ExtensionContext
  let registeredCommands: Map<string, Function>
  let configGetMock: jest.Mock

  beforeEach(() => {
    jest.clearAllMocks()
    registeredCommands = new Map()

    // Reset workspace folders
    mockWorkspace.workspaceFolders = [{ uri: { fsPath: "/test/workspace" }, name: "test", index: 0 }]

    // Create a trackable mock for configuration.get
    configGetMock = jest.fn()

    // Mock command registration
    jest.spyOn(commands, "registerCommand").mockImplementation((commandId: string, callback: Function) => {
      registeredCommands.set(commandId, callback)
      return { dispose: jest.fn() }
    })

    // Mock context
    mockContext = {
      subscriptions: [],
      secrets: {
        get: jest.fn().mockResolvedValue("sk-ant-api-valid-key"),
        store: jest.fn(),
        delete: jest.fn(),
      },
    } as unknown as ExtensionContext

    // Mock Git extension
    const mockGitRepo = {
      diff: jest.fn().mockResolvedValue("test diff"),
      inputBox: { value: "" },
    }
    const mockGitAPI = { repositories: [mockGitRepo] }
    const mockGitExtension = {
      exports: {
        getAPI: jest.fn().mockReturnValue(mockGitAPI),
      },
    }
    jest.spyOn(extensions, "getExtension").mockReturnValue(mockGitExtension as any)

    // Reset workspace configuration mock
    const mockConfig: Partial<WorkspaceConfiguration> = {
      get: configGetMock,
    }
    mockWorkspace.getConfiguration.mockReturnValue(mockConfig)
  })

  it("should use configured values when available", async () => {
    // Mock configuration values
    configGetMock.mockImplementation((key: string) => {
      switch (key) {
        case "model":
          return "claude-3-haiku-20240307"
        case "maxTokens":
          return 2048
        case "temperature":
          return 0.7
        default:
          return undefined
      }
    })

    await activate(mockContext)
    const generateCommitMessage = registeredCommands.get("diffCommit.generateCommitMessage")
    if (generateCommitMessage) {
      await generateCommitMessage()
    }

    expect(mockWorkspace.getConfiguration).toHaveBeenCalledWith("diffCommit")
    expect(configGetMock).toHaveBeenCalledWith("model")
    expect(configGetMock).toHaveBeenCalledWith("maxTokens")
    expect(configGetMock).toHaveBeenCalledWith("temperature")
  })

  it("should use default values when configuration is missing", async () => {
    // Mock all configuration values as undefined
    configGetMock.mockReturnValue(undefined)

    await activate(mockContext)
    const generateCommitMessage = registeredCommands.get("diffCommit.generateCommitMessage")
    if (generateCommitMessage) {
      await generateCommitMessage()
    }

    expect(mockWorkspace.getConfiguration).toHaveBeenCalledWith("diffCommit")
    expect(configGetMock).toHaveBeenCalledWith("model")
    expect(configGetMock).toHaveBeenCalledWith("maxTokens")
    expect(configGetMock).toHaveBeenCalledWith("temperature")
  })

  it("should handle custom instructions when provided", async () => {
    // Mock custom instructions
    configGetMock.mockImplementation((key: string) => {
      if (key === "customInstructions") return "Custom commit guidelines"
      return undefined
    })

    await activate(mockContext)
    const generateCommitMessage = registeredCommands.get("diffCommit.generateCommitMessage")
    if (generateCommitMessage) {
      await generateCommitMessage()
    }

    expect(mockWorkspace.getConfiguration).toHaveBeenCalledWith("diffCommit")
    expect(configGetMock).toHaveBeenCalledWith("customInstructions")
  })

  it("should handle missing workspace folder", async () => {
    // Mock missing workspace folder
    mockWorkspace.workspaceFolders = undefined

    await activate(mockContext)
    const generateCommitMessage = registeredCommands.get("diffCommit.generateCommitMessage")
    if (generateCommitMessage) {
      await generateCommitMessage()
    }

    expect(window.showErrorMessage).toHaveBeenCalledWith("No workspace folder found")
  })

  it("should handle missing Git extension", async () => {
    // Mock missing Git extension
    jest.spyOn(extensions, "getExtension").mockReturnValue(undefined)

    await activate(mockContext)
    const generateCommitMessage = registeredCommands.get("diffCommit.generateCommitMessage")
    if (generateCommitMessage) {
      await generateCommitMessage()
    }

    expect(window.showErrorMessage).toHaveBeenCalledWith("Git extension not found")
  })

  it("should handle empty Git repositories", async () => {
    // Mock Git extension with no repositories
    const mockGitExtension = {
      exports: {
        getAPI: jest.fn().mockReturnValue({ repositories: [] }),
      },
    }
    jest.spyOn(extensions, "getExtension").mockReturnValue(mockGitExtension as any)

    await activate(mockContext)
    const generateCommitMessage = registeredCommands.get("diffCommit.generateCommitMessage")
    if (generateCommitMessage) {
      await generateCommitMessage()
    }

    expect(window.showErrorMessage).toHaveBeenCalledWith("No Git repository found")
  })

  it("should handle no Git changes", async () => {
    // Mock Git repo with no changes
    const mockGitRepo = {
      diff: jest.fn().mockResolvedValue(""),
      inputBox: { value: "" },
    }
    const mockGitAPI = { repositories: [mockGitRepo] }
    const mockGitExtension = {
      exports: {
        getAPI: jest.fn().mockReturnValue(mockGitAPI),
      },
    }
    jest.spyOn(extensions, "getExtension").mockReturnValue(mockGitExtension as any)

    await activate(mockContext)
    const generateCommitMessage = registeredCommands.get("diffCommit.generateCommitMessage")
    if (generateCommitMessage) {
      await generateCommitMessage()
    }

    expect(window.showErrorMessage).toHaveBeenCalledWith("No changes detected")
  })
})
