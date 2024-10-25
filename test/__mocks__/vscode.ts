export const window = {
  showInputBox: jest.fn(),
  showInformationMessage: jest.fn(),
  showErrorMessage: jest.fn(),
  showWarningMessage: jest.fn(),
  showTextDocument: jest.fn(),
}

export const workspace = {
  getConfiguration: jest.fn(),
  openTextDocument: jest.fn(),
  workspaceFolders: [],
}

export const commands = {
  registerCommand: jest.fn().mockReturnValue({ dispose: jest.fn() }),
}

export const extensions = {
  getExtension: jest.fn(),
}

export const ExtensionContext = jest.fn().mockImplementation(() => ({
  subscriptions: [],
  secrets: {
    get: jest.fn(),
    store: jest.fn(),
    delete: jest.fn(),
  },
}))

export const Uri = {
  file: jest.fn(),
}

// Add any other VSCode APIs that your tests need
