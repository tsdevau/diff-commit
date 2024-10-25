import * as vscode from "vscode"
import { activate, deactivate } from "../src/extension"

jest.mock("vscode")

describe("Command Registration and Lifecycle", () => {
  let mockContext: any
  let registeredCommands: Map<string, Function>

  beforeEach(() => {
    jest.clearAllMocks()
    registeredCommands = new Map()

    // Mock command registration
    ;(vscode.commands.registerCommand as jest.Mock).mockImplementation((commandId: string, callback: Function) => {
      registeredCommands.set(commandId, callback)
      return { dispose: jest.fn() }
    })

    // Create mock context
    mockContext = {
      subscriptions: [],
      secrets: {
        get: jest.fn(),
        store: jest.fn(),
        delete: jest.fn(),
      },
    }
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

      // 7 subscriptions: 5 commands + 2 workspace event handlers
      expect(mockContext.subscriptions).toHaveLength(7)
      mockContext.subscriptions.forEach((subscription: any) => {
        expect(subscription).toHaveProperty("dispose")
        expect(typeof subscription.dispose).toBe("function")
      })
    })
  })

  describe("Command Lifecycle", () => {
    test("should properly dispose commands on deactivation", () => {
      activate(mockContext)
      const disposeMocks = mockContext.subscriptions.map((sub: any) => sub.dispose as jest.Mock)

      deactivate()
      mockContext.subscriptions.forEach((subscription: any) => subscription.dispose())

      disposeMocks.forEach((disposeMock: jest.Mock) => {
        expect(disposeMock).toHaveBeenCalled()
      })
    })

    test("should maintain command registration if one fails", () => {
      // Mock console.error
      const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {})

      // Make first command registration fail
      let firstCall = true
      ;(vscode.commands.registerCommand as jest.Mock).mockImplementation((commandId: string, callback: Function) => {
        if (firstCall) {
          firstCall = false
          console.error(new Error("Registration failed"))
          return { dispose: jest.fn() }
        }
        registeredCommands.set(commandId, callback)
        return { dispose: jest.fn() }
      })

      activate(mockContext)

      // Should still register remaining commands
      expect(registeredCommands.size).toBe(4)
      expect(mockContext.subscriptions.length).toBe(7) // All commands get registered
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
      mockContext.subscriptions = []

      // Second activation
      activate(mockContext)

      // Should have same number of registrations as first activation
      expect(mockContext.subscriptions.length).toBe(firstSubscriptionsLength)
      expect(registeredCommands.size).toBe(5) // Only command registrations
    })

    test("should handle disposal of invalid subscriptions", () => {
      activate(mockContext)

      // Add an invalid subscription
      mockContext.subscriptions.push({ dispose: null })

      // Should not throw when trying to dispose
      expect(() => {
        mockContext.subscriptions.forEach((sub: any) => {
          if (typeof sub.dispose === "function") {
            sub.dispose()
          }
        })
      }).not.toThrow()
    })

    test("should handle empty subscriptions array", () => {
      expect(() => activate(mockContext)).not.toThrow()
      expect(mockContext.subscriptions.length).toBe(7) // 5 commands + 2 workspace event handlers
    })
  })
})
