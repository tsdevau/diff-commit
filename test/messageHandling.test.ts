import { commands, extensions, Uri, workspace, type ExtensionContext, type WorkspaceConfiguration } from "vscode"
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

// Define the mock workspace type
type MockWorkspace = {
  workspaceFolders: { uri: Uri; name: string; index: number }[] | undefined
  getConfiguration: jest.Mock
  openTextDocument: jest.Mock
}

jest.mock("vscode", () => {
  const original = jest.requireActual("vscode")

  // Create mock Uri
  const mockUri = {
    scheme: "file",
    authority: "",
    path: "/test/workspace",
    query: "",
    fragment: "",
    fsPath: "/test/workspace",
    with: jest.fn(),
    toJSON: jest.fn(),
  } as Uri

  // Create mock workspace
  const mockWorkspace: MockWorkspace = {
    workspaceFolders: [{ uri: mockUri, name: "test", index: 0 }],
    getConfiguration: jest.fn(),
    openTextDocument: jest.fn(),
  }

  return {
    ...original,
    workspace: mockWorkspace,
  }
})

// Get the mocked workspace
const mockWorkspace = workspace as unknown as MockWorkspace

describe("Message Handling", () => {
  let mockContext: ExtensionContext
  let registeredCommands: Map<string, Function>
  let configGetMock: jest.Mock
  let mockAnthropicSDK: any
  let mockGitRepo: any

  beforeEach(() => {
    jest.clearAllMocks()
    registeredCommands = new Map()

    // Mock command registration
    jest.spyOn(commands, "registerCommand").mockImplementation((commandId: string, callback: Function) => {
      registeredCommands.set(commandId, callback)
      return { dispose: jest.fn() }
    })

    // Mock context with secrets
    mockContext = {
      subscriptions: [],
      secrets: {
        get: jest.fn().mockResolvedValue("sk-ant-api-valid-key"),
        store: jest.fn(),
        delete: jest.fn(),
      },
    } as unknown as ExtensionContext

    // Reset workspace configuration mock
    configGetMock = jest.fn()
    const mockConfig: Partial<WorkspaceConfiguration> = {
      get: configGetMock,
    }
    mockWorkspace.getConfiguration.mockReturnValue(mockConfig)

    // Get reference to mocked Anthropic SDK
    mockAnthropicSDK = require("@anthropic-ai/sdk").default

    // Setup mock Git repo
    mockGitRepo = {
      diff: jest.fn().mockResolvedValue("test diff"),
      inputBox: { value: "" },
    }
    const mockGitAPI = { repositories: [mockGitRepo] }
    jest.spyOn(extensions, "getExtension").mockReturnValue({
      exports: { getAPI: jest.fn().mockReturnValue(mockGitAPI) },
    } as any)
  })

  describe("Message Formatting", () => {
    it("should replace asterisk bullet points with hyphens", async () => {
      const messageWithBullets = "feat(scope): changes\n* Change 1\n* Change 2"
      const expectedMessage = "feat(scope): changes\n- Change 1\n- Change 2"

      mockAnthropicSDK.mockImplementation(() => ({
        messages: {
          create: jest.fn().mockResolvedValue({
            content: [{ type: "text", text: messageWithBullets }],
          }),
        },
      }))

      await activate(mockContext)
      const generateCommitMessage = registeredCommands.get("diffCommit.generateCommitMessage")
      await generateCommitMessage?.()

      expect(mockGitRepo.inputBox.value).toBe(expectedMessage)
    })

    it("should handle multiple bullet points", async () => {
      const messageWithBullets = "feat(scope): changes\n* Change 1\n* Change 2\n* Change 3"
      const expectedMessage = "feat(scope): changes\n- Change 1\n- Change 2\n- Change 3"

      mockAnthropicSDK.mockImplementation(() => ({
        messages: {
          create: jest.fn().mockResolvedValue({
            content: [{ type: "text", text: messageWithBullets }],
          }),
        },
      }))

      await activate(mockContext)
      const generateCommitMessage = registeredCommands.get("diffCommit.generateCommitMessage")
      await generateCommitMessage?.()

      expect(mockGitRepo.inputBox.value).toBe(expectedMessage)
    })
  })

  describe("Content Type Handling", () => {
    it("should handle non-text content type", async () => {
      mockAnthropicSDK.mockImplementation(() => ({
        messages: {
          create: jest.fn().mockResolvedValue({
            content: [{ type: "image", text: "some-image-data" }],
          }),
        },
      }))

      await activate(mockContext)
      const generateCommitMessage = registeredCommands.get("diffCommit.generateCommitMessage")
      await generateCommitMessage?.()

      expect(mockGitRepo.inputBox.value).toBe("")
    })

    it("should handle undefined message content", async () => {
      mockAnthropicSDK.mockImplementation(() => ({
        messages: {
          create: jest.fn().mockResolvedValue({
            content: undefined,
          }),
        },
      }))

      await activate(mockContext)
      const generateCommitMessage = registeredCommands.get("diffCommit.generateCommitMessage")
      await generateCommitMessage?.()

      expect(mockGitRepo.inputBox.value).toBe("")
    })

    it("should handle empty content array", async () => {
      mockAnthropicSDK.mockImplementation(() => ({
        messages: {
          create: jest.fn().mockResolvedValue({
            content: [],
          }),
        },
      }))

      await activate(mockContext)
      const generateCommitMessage = registeredCommands.get("diffCommit.generateCommitMessage")
      await generateCommitMessage?.()

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
          }),
        },
      }))

      await activate(mockContext)
      const generateCommitMessage = registeredCommands.get("diffCommit.generateCommitMessage")
      await generateCommitMessage?.()

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
          }),
        },
      }))

      await activate(mockContext)
      const generateCommitMessage = registeredCommands.get("diffCommit.generateCommitMessage")
      await generateCommitMessage?.()

      expect(mockGitRepo.inputBox.value).toBe("feat(scope): changes\n\n- Change 1")
    })
  })
})
