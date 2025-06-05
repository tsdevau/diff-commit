import { workspace } from "vscode"

export interface CommitConfig {
  allowedTypes: string[]
  customInstructions?: string
  maxTokens: number
  model: string
  temperature: number
  provider: "anthropic" | "ollama"
  ollamaHostname: string
  ollamaModel: string
}

export class ConfigManager {
  private static readonly defaultAllowedTypes = [
    "chore",
    "ci",
    "docs",
    "feat",
    "fix",
    "perf",
    "refactor",
    "style",
    "test",
  ]
  private static readonly defaultMaxTokens = 1024
  private static readonly defaultModel = "claude-sonnet-4-0"
  private static readonly defaultTemperature = 0.3
  private static readonly defaultProvider = "anthropic"
  private static readonly defaultOllamaHostname = "http://localhost:11434"
  private static readonly defaultOllamaModel = ""

  getConfig(): CommitConfig {
    const config = workspace.getConfiguration("diffCommit")

    return {
      allowedTypes: config.get<string[]>("allowedTypes") || ConfigManager.defaultAllowedTypes,
      customInstructions: config.get<string>("customInstructions"),
      maxTokens: config.get<number>("maxTokens") || ConfigManager.defaultMaxTokens,
      model: config.get<string>("model") || ConfigManager.defaultModel,
      temperature: config.get<number>("temperature") || ConfigManager.defaultTemperature,
      provider: config.get<"anthropic" | "ollama">("provider") || ConfigManager.defaultProvider,
      ollamaHostname: config.get<string>("ollamaHostname") || ConfigManager.defaultOllamaHostname,
      ollamaModel: config.get<string>("ollamaModel") || ConfigManager.defaultOllamaModel,
    }
  }
}
