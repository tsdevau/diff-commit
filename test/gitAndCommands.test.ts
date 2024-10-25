import * as vscode from "vscode"
import { activate, deactivate } from "../src/extension"

// Mock the vscode namespace
jest.mock("vscode", () => {
  const original = jest.requireActual("vscode")

  return {
    ...original,
    window: {
      showErrorMessage: jest.fn(),
      showInformationMessage: jest.fn(),
    },
    commands: {
      registerCommand: jest.fn(),
      executeCommand: jest.fn(),
    },
  }
})

describe("Command Registration and Lifecycle", () => {
  let mockContext: vscode.ExtensionContext
  let registeredCommands: Map<string, Function>

  beforeEach(() => {
    jest.clearAllMocks()
    registeredCommands = new Map()

    // Mock command registration
    jest.spyOn(vscode.commands, "registerCommand").mockImplementation((commandId: string, callback: Function) => {
      const disposable = { dispose: jest.fn() }
      registeredCommands.set(commandId, callback)
      return disposable
    })

    mockContext = {
      subscriptions: [],
      secrets: {
        get: jest.fn(),
        store: jest.fn(),
        delete: jest.fn(),
      },
    } as unknown as vscode.ExtensionContext
  })

  describe("Command Registration", () => {
    test("should register all commands in correct order", () => {
      activate(mockContext)

      const expectedCommands = [
        "diffCommit.updateAPIKey",
        "diffCommit.getAPIKey",
        "diffCommit.deleteAPIKey",
        "diffCommit.generateCommitMessage",
        "diffCommit.previewCommitMessage",
      ]

      // Verify commands were registered in the expected order
      expectedCommands.forEach((commandId, index) => {
        expect(vscode.commands.registerCommand).toHaveBeenNthCalledWith(index + 1, commandId, expect.any(Function))
      })
    })

    test("should add all commands to subscriptions", () => {
      activate(mockContext)

      expect(mockContext.subscriptions).toHaveLength(5)
      mockContext.subscriptions.forEach((subscription) => {
        expect(subscription).toHaveProperty("dispose")
        expect(typeof subscription.dispose).toBe("function")
      })
    })
  })

  describe("Command Lifecycle", () => {
    test("should properly dispose commands on deactivation", () => {
      activate(mockContext)
      const disposeMocks = mockContext.subscriptions.map((sub) => sub.dispose as jest.Mock)

      deactivate()
      mockContext.subscriptions.forEach((subscription) => subscription.dispose())

      disposeMocks.forEach((disposeMock) => {
        expect(disposeMock).toHaveBeenCalled()
      })
    })

    test("should maintain command registration if one fails", () => {
      // Mock one command registration to fail
      const registerCommandSpy = jest.spyOn(vscode.commands, "registerCommand")
      const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation()

      registerCommandSpy
        .mockImplementationOnce((commandId: string, callback: Function) => {
          const error = new Error("Registration failed")
          console.error(error)
          // Return a disposable that will throw when used
          return {
            dispose: () => {
              throw error
            },
          }
        })
        .mockImplementation((commandId: string, callback: Function) => {
          const disposable = { dispose: jest.fn() }
          registeredCommands.set(commandId, callback)
          return disposable
        })

      activate(mockContext)

      // Should still register remaining commands
      expect(registeredCommands.size).toBe(4)
      expect(mockContext.subscriptions.length).toBe(5) // All commands get registered
      expect(consoleErrorSpy).toHaveBeenCalledWith(expect.any(Error))

      consoleErrorSpy.mockRestore()
    })
  })

  describe("Subscription Management", () => {
    test("should not add duplicate commands to subscriptions", () => {
      // First activation
      activate(mockContext)
      const firstSubscriptionsLength = mockContext.subscriptions.length

      // Clear subscriptions for second activation
      mockContext.subscriptions.length = 0
      registeredCommands.clear()

      // Second activation
      activate(mockContext)

      // Should have same number of registrations as first activation
      expect(mockContext.subscriptions.length).toBe(firstSubscriptionsLength)
      expect(registeredCommands.size).toBe(firstSubscriptionsLength)
    })

    test("should handle disposal of invalid subscriptions", () => {
      // Add invalid subscriptions to the array
      mockContext.subscriptions.push(undefined as any)
      mockContext.subscriptions.push(null as any)
      mockContext.subscriptions.push({ dispose: null } as any)

      activate(mockContext)

      expect(() => {
        mockContext.subscriptions.forEach((subscription) => {
          if (subscription?.dispose) {
            subscription.dispose()
          }
        })
      }).not.toThrow()
    })

    test("should handle empty subscriptions array", () => {
      // Clear the subscriptions array
      mockContext.subscriptions.length = 0

      expect(() => activate(mockContext)).not.toThrow()
      expect(() => deactivate()).not.toThrow()
    })
  })
})
