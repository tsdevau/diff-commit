const mockUri = {
  scheme: "file",
  authority: "",
  path: "/test/workspace",
  query: "",
  fragment: "",
  fsPath: "/test/workspace",
  with: jest.fn(),
  toJSON: jest.fn(),
}

// Store registered commands
const registeredCommands = new Map()

const mockCommands = {
  registerCommand: jest.fn().mockImplementation((commandId: string, callback: Function) => {
    registeredCommands.set(commandId, callback)
    return { dispose: jest.fn() }
  }),
  executeCommand: jest.fn().mockImplementation((commandId: string, ...args: any[]) => {
    const callback = registeredCommands.get(commandId)
    if (callback) {
      return callback(...args)
    }
    return undefined
  }),
}

const mockWorkspace = {
  workspaceFolders: [{ uri: mockUri, name: "test", index: 0 }],
  getConfiguration: jest.fn(),
  openTextDocument: jest.fn(),
  onDidSaveTextDocument: jest.fn().mockReturnValue({ dispose: jest.fn() }),
  onDidCloseTextDocument: jest.fn().mockReturnValue({ dispose: jest.fn() }),
}

const mockWindow = {
  showInputBox: jest.fn(),
  showInformationMessage: jest.fn(),
  showErrorMessage: jest.fn(),
  showWarningMessage: jest.fn(),
  showTextDocument: jest.fn(),
  createOutputChannel: jest.fn().mockReturnValue({
    appendLine: jest.fn(),
    show: jest.fn(),
    dispose: jest.fn(),
  }),
}

const mockExtensions = {
  getExtension: jest.fn(),
}

const mockExtensionContext = {
  subscriptions: [],
  secrets: {
    get: jest.fn(),
    store: jest.fn(),
    delete: jest.fn(),
  },
}

// Export the mocked modules
export const workspace = mockWorkspace
export const window = mockWindow
export const commands = mockCommands
export const extensions = mockExtensions
export const ExtensionContext = jest.fn().mockImplementation(() => mockExtensionContext)
export const Uri = {
  file: jest.fn().mockReturnValue(mockUri),
  parse: jest.fn().mockReturnValue(mockUri),
}

// Export any additional VSCode APIs that tests need
export const EventEmitter = jest.fn()
export const TextDocument = jest.fn()
