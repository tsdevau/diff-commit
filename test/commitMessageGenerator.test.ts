import * as vscode from "vscode"

jest.mock("vscode")
jest.mock("@anthropic-ai/sdk")
jest.mock("ollama")

import { CommitMessageGenerator } from "../src/commitMessageGenerator"
import type { CommitConfig } from "../src/configManager"

describe("CommitMessageGenerator Constructor", () => {
  let mockShowErrorMessage: jest.Mock
  let mockConsoleError: jest.SpyInstance

  beforeEach(() => {
    jest.clearAllMocks()

    // Mock vscode.window.showErrorMessage
    mockShowErrorMessage = jest.fn()
    ;(vscode.window as any).showErrorMessage = mockShowErrorMessage

    // Mock console.error
    mockConsoleError = jest.spyOn(console, "error").mockImplementation(() => {})
  })

  afterEach(() => {
    mockConsoleError.mockRestore()
  })

  describe("Anthropic Constructor", () => {
    it("should initialise successfully with valid API key", () => {
      expect(() => {
        new CommitMessageGenerator("sk-ant-api-valid-key")
      }).not.toThrow()

      expect(mockShowErrorMessage).not.toHaveBeenCalled()
      expect(mockConsoleError).not.toHaveBeenCalled()
    })

    it("should throw error with API key that doesn't start with 'sk-'", () => {
      expect(() => {
        new CommitMessageGenerator("invalid-api-key")
      }).toThrow(
        "Invalid constructor arguments. Configure either an API key for Anthropic or a hostname and model for Ollama.",
      )

      expect(mockConsoleError).toHaveBeenCalledWith("Error initializing CommitMessageGenerator:", expect.any(Error))
      expect(mockShowErrorMessage).toHaveBeenCalledWith(
        "Failed to initialize CommitMessageGenerator. Please check your configuration.",
      )
    })

    it("should throw error with empty API key", () => {
      expect(() => {
        new CommitMessageGenerator("")
      }).toThrow(
        "Invalid constructor arguments. Configure either an API key for Anthropic or a hostname and model for Ollama.",
      )

      expect(mockConsoleError).toHaveBeenCalledWith("Error initializing CommitMessageGenerator:", expect.any(Error))
      expect(mockShowErrorMessage).toHaveBeenCalledWith(
        "Failed to initialize CommitMessageGenerator. Please check your configuration.",
      )
    })

    it("should throw error with null argument", () => {
      expect(() => {
        new CommitMessageGenerator(null as any)
      }).toThrow(
        "Invalid constructor arguments. Configure either an API key for Anthropic or a hostname and model for Ollama.",
      )

      expect(mockConsoleError).toHaveBeenCalledWith("Error initializing CommitMessageGenerator:", expect.any(Error))
      expect(mockShowErrorMessage).toHaveBeenCalledWith(
        "Failed to initialize CommitMessageGenerator. Please check your configuration.",
      )
    })

    it("should throw error with undefined argument", () => {
      expect(() => {
        new CommitMessageGenerator(undefined as any)
      }).toThrow(
        "Invalid constructor arguments. Configure either an API key for Anthropic or a hostname and model for Ollama.",
      )

      expect(mockConsoleError).toHaveBeenCalledWith("Error initializing CommitMessageGenerator:", expect.any(Error))
      expect(mockShowErrorMessage).toHaveBeenCalledWith(
        "Failed to initialize CommitMessageGenerator. Please check your configuration.",
      )
    })
  })

  describe("Ollama Constructor", () => {
    it("should initialise successfully with valid hostname and model", () => {
      expect(() => {
        new CommitMessageGenerator("http://localhost:11434", "llama3.2")
      }).not.toThrow()

      expect(mockShowErrorMessage).not.toHaveBeenCalled()
      expect(mockConsoleError).not.toHaveBeenCalled()
    })

    it("should initialise successfully with https hostname", () => {
      expect(() => {
        new CommitMessageGenerator("https://ollama.example.com", "codellama")
      }).not.toThrow()

      expect(mockShowErrorMessage).not.toHaveBeenCalled()
      expect(mockConsoleError).not.toHaveBeenCalled()
    })

    it("should throw error with hostname that doesn't start with 'http'", () => {
      expect(() => {
        new CommitMessageGenerator("localhost:11434", "llama3.2")
      }).toThrow(
        "Invalid constructor arguments. Configure either an API key for Anthropic or a hostname and model for Ollama.",
      )

      expect(mockConsoleError).toHaveBeenCalledWith("Error initializing CommitMessageGenerator:", expect.any(Error))
      expect(mockShowErrorMessage).toHaveBeenCalledWith(
        "Failed to initialize CommitMessageGenerator. Please check your configuration.",
      )
    })

    it("should throw error with empty hostname", () => {
      expect(() => {
        new CommitMessageGenerator("", "llama3.2")
      }).toThrow(
        "Invalid constructor arguments. Configure either an API key for Anthropic or a hostname and model for Ollama.",
      )

      expect(mockConsoleError).toHaveBeenCalledWith("Error initializing CommitMessageGenerator:", expect.any(Error))
      expect(mockShowErrorMessage).toHaveBeenCalledWith(
        "Failed to initialize CommitMessageGenerator. Please check your configuration.",
      )
    })

    it("should throw error with empty model", () => {
      expect(() => {
        new CommitMessageGenerator("http://localhost:11434", "")
      }).toThrow(
        "Invalid constructor arguments. Configure either an API key for Anthropic or a hostname and model for Ollama.",
      )

      expect(mockConsoleError).toHaveBeenCalledWith("Error initializing CommitMessageGenerator:", expect.any(Error))
      expect(mockShowErrorMessage).toHaveBeenCalledWith(
        "Failed to initialize CommitMessageGenerator. Please check your configuration.",
      )
    })

    it("should throw error with null hostname", () => {
      expect(() => {
        new CommitMessageGenerator(null as any, "llama3.2")
      }).toThrow(
        "Invalid constructor arguments. Configure either an API key for Anthropic or a hostname and model for Ollama.",
      )

      expect(mockConsoleError).toHaveBeenCalledWith("Error initializing CommitMessageGenerator:", expect.any(Error))
      expect(mockShowErrorMessage).toHaveBeenCalledWith(
        "Failed to initialize CommitMessageGenerator. Please check your configuration.",
      )
    })

    it("should throw error with null model", () => {
      expect(() => {
        new CommitMessageGenerator("http://localhost:11434", null as any)
      }).toThrow(
        "Invalid constructor arguments. Configure either an API key for Anthropic or a hostname and model for Ollama.",
      )

      expect(mockConsoleError).toHaveBeenCalledWith("Error initializing CommitMessageGenerator:", expect.any(Error))
      expect(mockShowErrorMessage).toHaveBeenCalledWith(
        "Failed to initialize CommitMessageGenerator. Please check your configuration.",
      )
    })
  })

  describe("Invalid Constructor Arguments", () => {
    it("should throw error with no arguments", () => {
      expect(() => {
        new (CommitMessageGenerator as any)()
      }).toThrow(
        "Invalid constructor arguments. Configure either an API key for Anthropic or a hostname and model for Ollama.",
      )

      expect(mockConsoleError).toHaveBeenCalledWith("Error initializing CommitMessageGenerator:", expect.any(Error))
      expect(mockShowErrorMessage).toHaveBeenCalledWith(
        "Failed to initialize CommitMessageGenerator. Please check your configuration.",
      )
    })

    it("should throw error with too many arguments", () => {
      expect(() => {
        new (CommitMessageGenerator as any)("arg1", "arg2", "arg3")
      }).toThrow(
        "Invalid constructor arguments. Configure either an API key for Anthropic or a hostname and model for Ollama.",
      )

      expect(mockConsoleError).toHaveBeenCalledWith("Error initializing CommitMessageGenerator:", expect.any(Error))
      expect(mockShowErrorMessage).toHaveBeenCalledWith(
        "Failed to initialize CommitMessageGenerator. Please check your configuration.",
      )
    })

    it("should throw error with mixed invalid arguments", () => {
      expect(() => {
        new CommitMessageGenerator("sk-api-key", "extra-argument" as any)
      }).toThrow(
        "Invalid constructor arguments. Configure either an API key for Anthropic or a hostname and model for Ollama.",
      )

      expect(mockConsoleError).toHaveBeenCalledWith("Error initializing CommitMessageGenerator:", expect.any(Error))
      expect(mockShowErrorMessage).toHaveBeenCalledWith(
        "Failed to initialize CommitMessageGenerator. Please check your configuration.",
      )
    })

    it("should throw error with non-string arguments", () => {
      expect(() => {
        new CommitMessageGenerator(123 as any)
      }).toThrow(
        "Invalid constructor arguments. Configure either an API key for Anthropic or a hostname and model for Ollama.",
      )

      expect(mockConsoleError).toHaveBeenCalledWith("Error initializing CommitMessageGenerator:", expect.any(Error))
      expect(mockShowErrorMessage).toHaveBeenCalledWith(
        "Failed to initialize CommitMessageGenerator. Please check your configuration.",
      )
    })

    it("should throw error when first argument is object", () => {
      expect(() => {
        new CommitMessageGenerator({} as any)
      }).toThrow(
        "Invalid constructor arguments. Configure either an API key for Anthropic or a hostname and model for Ollama.",
      )

      expect(mockConsoleError).toHaveBeenCalledWith("Error initializing CommitMessageGenerator:", expect.any(Error))
      expect(mockShowErrorMessage).toHaveBeenCalledWith(
        "Failed to initialize CommitMessageGenerator. Please check your configuration.",
      )
    })
  })

  describe("Error Handling", () => {
    it("should log error and show error message when exception occurs", () => {
      expect(() => {
        new CommitMessageGenerator("invalid-key")
      }).toThrow(
        "Invalid constructor arguments. Configure either an API key for Anthropic or a hostname and model for Ollama.",
      )

      expect(mockConsoleError).toHaveBeenCalledWith(
        "Error initializing CommitMessageGenerator:",
        expect.objectContaining({
          message:
            "Invalid constructor arguments. Configure either an API key for Anthropic or a hostname and model for Ollama.",
        }),
      )
      expect(mockShowErrorMessage).toHaveBeenCalledWith(
        "Failed to initialize CommitMessageGenerator. Please check your configuration.",
      )
    })
  })
})

describe("CommitMessageGenerator Message Generation", () => {
  let mockShowErrorMessage: jest.Mock
  let mockShowWarningMessage: jest.Mock
  let generator: CommitMessageGenerator

  beforeEach(() => {
    jest.clearAllMocks()

    // Mock vscode.window methods
    mockShowErrorMessage = jest.fn()
    mockShowWarningMessage = jest.fn()
    ;(vscode.window as any).showErrorMessage = mockShowErrorMessage
    ;(vscode.window as any).showWarningMessage = mockShowWarningMessage
  })

  describe("Ollama Message Generation", () => {
    let mockOllamaGenerate: jest.Mock

    beforeEach(() => {
      // Mock the Ollama class and its generate method
      const { Ollama } = jest.requireMock("ollama")
      mockOllamaGenerate = jest.fn()
      Ollama.mockImplementation(() => ({
        generate: mockOllamaGenerate,
      }))
    })

    it("should show error message and return undefined when Ollama model is not specified", async () => {
      // Create generator with valid hostname but then set ollamaModel to undefined
      generator = new CommitMessageGenerator("http://localhost:11434", "test-model")

      // Manually set ollamaModel to undefined to simulate the error condition
      ;(generator as any).ollamaModel = undefined

      const config: CommitConfig = {
        provider: "ollama",
        allowedTypes: ["feat", "fix", "chore"],
        maxTokens: 1024,
        model: "claude-sonnet-4-0", // This is ignored for Ollama
        temperature: 0.3,
        ollamaHostname: "http://localhost:11434",
        ollamaModel: "", // This should trigger the error
      }

      const result = await generator.generateMessage("test diff", config)

      expect(result).toBeUndefined()
      expect(mockShowErrorMessage).toHaveBeenCalledWith("Ollama model not specified")
      expect(mockShowWarningMessage).not.toHaveBeenCalled()
    })

    it("should show warning message and return undefined when Ollama returns empty response", async () => {
      generator = new CommitMessageGenerator("http://localhost:11434", "test-model")

      // Mock Ollama to return empty response
      mockOllamaGenerate.mockResolvedValue({
        response: "",
        done: true,
        done_reason: "stop",
      })

      const config: CommitConfig = {
        provider: "ollama",
        allowedTypes: ["feat", "fix", "chore"],
        maxTokens: 1024,
        model: "claude-sonnet-4-0",
        temperature: 0.3,
        ollamaHostname: "http://localhost:11434",
        ollamaModel: "test-model",
      }

      const result = await generator.generateMessage("test diff", config)

      expect(result).toBeUndefined()
      expect(mockShowWarningMessage).toHaveBeenCalledWith("No commit message was generated")
      expect(mockShowErrorMessage).not.toHaveBeenCalled()
    })

    it("should show warning message and return commit message when Ollama response is incomplete", async () => {
      generator = new CommitMessageGenerator("http://localhost:11434", "test-model")

      const incompleteMessage = "feat(api): add user authentication"

      // Mock Ollama to return incomplete response
      mockOllamaGenerate.mockResolvedValue({
        response: incompleteMessage,
        done: false, // This indicates incomplete response
        done_reason: "length",
      })

      const config: CommitConfig = {
        provider: "ollama",
        allowedTypes: ["feat", "fix", "chore"],
        maxTokens: 1024,
        model: "claude-sonnet-4-0",
        temperature: 0.3,
        ollamaHostname: "http://localhost:11434",
        ollamaModel: "test-model",
      }

      const result = await generator.generateMessage("test diff", config)

      expect(result).toBe(incompleteMessage)
      expect(mockShowWarningMessage).toHaveBeenCalledWith(
        "Ollama response was marked as incomplete. Review the commit message and ensure it meets your requirements.",
      )
      expect(mockShowErrorMessage).not.toHaveBeenCalled()
    })

    it("should return commit message successfully when Ollama response is complete", async () => {
      generator = new CommitMessageGenerator("http://localhost:11434", "test-model")

      const completeMessage =
        "feat(auth): implement user authentication system\n\n- Add login and registration endpoints\n- Implement JWT token handling"

      // Mock Ollama to return complete response
      mockOllamaGenerate.mockResolvedValue({
        response: completeMessage,
        done: true,
        done_reason: "stop",
        prompt_eval_count: 100,
        eval_count: 50,
      })

      const config: CommitConfig = {
        provider: "ollama",
        allowedTypes: ["feat", "fix", "chore"],
        maxTokens: 1024,
        model: "claude-sonnet-4-0",
        temperature: 0.3,
        ollamaHostname: "http://localhost:11434",
        ollamaModel: "test-model",
      }

      const result = await generator.generateMessage("test diff", config)

      expect(result).toBe(completeMessage)
      expect(mockShowWarningMessage).not.toHaveBeenCalled()
      expect(mockShowErrorMessage).not.toHaveBeenCalled()
    })

    it("should handle whitespace-only response as empty", async () => {
      generator = new CommitMessageGenerator("http://localhost:11434", "test-model")

      // Mock Ollama to return whitespace-only response
      mockOllamaGenerate.mockResolvedValue({
        response: "   \n\n  \t  ",
        done: true,
        done_reason: "stop",
      })

      const config: CommitConfig = {
        provider: "ollama",
        allowedTypes: ["feat", "fix", "chore"],
        maxTokens: 1024,
        model: "claude-sonnet-4-0",
        temperature: 0.3,
        ollamaHostname: "http://localhost:11434",
        ollamaModel: "test-model",
      }

      const result = await generator.generateMessage("test diff", config)

      expect(result).toBeUndefined()
      expect(mockShowWarningMessage).toHaveBeenCalledWith("No commit message was generated")
      expect(mockShowErrorMessage).not.toHaveBeenCalled()
    })
  })
})
