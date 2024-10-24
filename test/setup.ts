import { afterEach, beforeEach, vi } from "vitest"

// Setup fetch mock
const globalFetch = global.fetch
beforeEach(() => {
  global.fetch = vi.fn()
})

afterEach(() => {
  global.fetch = globalFetch
  vi.resetAllMocks()
})

// Create mock functions
export const mockAnthropicCreate = vi.fn()

// Mock AnthropicError
export class MockAnthropicError extends Error {
  constructor(message: string, info?: any) {
    super(message)
    this.name = "AnthropicError"
  }
}

// Mock Anthropic SDK error module
vi.mock("@anthropic-ai/sdk/error", () => ({
  AnthropicError: MockAnthropicError,
}))

// Mock Anthropic SDK
vi.mock("@anthropic-ai/sdk", () => ({
  __esModule: true,
  default: function () {
    return {
      messages: {
        create: mockAnthropicCreate,
      },
    }
  },
}))

// Mock vscode namespace with functions that can be mocked per test
vi.mock("vscode", () => {
  const mockShowErrorMessage = vi.fn()
  const mockShowInputBox = vi.fn()
  const mockGetExtension = vi.fn()
  const mockGetConfiguration = vi.fn()
  let mockWorkspaceFolders = undefined

  return {
    window: {
      showErrorMessage: mockShowErrorMessage,
      showInputBox: mockShowInputBox,
    },
    workspace: {
      get workspaceFolders() {
        return mockWorkspaceFolders
      },
      set workspaceFolders(value) {
        mockWorkspaceFolders = value
      },
      getConfiguration: mockGetConfiguration.mockReturnValue({
        get: vi.fn(),
      }),
    },
    commands: {
      registerCommand: vi.fn().mockReturnValue({ dispose: vi.fn() }),
      executeCommand: vi.fn(),
    },
    extensions: {
      getExtension: mockGetExtension,
    },
  }
})
