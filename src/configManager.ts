import { workspace } from "vscode"

export interface CommitConfig {
  allowedTypes: string[]
  customInstructions?: string
  maxTokens: number
  model: string
  temperature: number
}

export class ConfigManager {
  private static readonly defaultAllowedTypes = [
    "feat",
    "fix",
    "refactor",
    "chore",
    "docs",
    "style",
    "test",
    "perf",
    "ci",
  ]
  private static readonly defaultMaxTokens = 1024
  private static readonly defaultModel = "claude-3-5-sonnet-latest"
  private static readonly defaultTemperature = 0.3

  getConfig(): CommitConfig {
    const config = workspace.getConfiguration("diffCommit")

    return {
      allowedTypes: config.get<string[]>("allowedTypes") || ConfigManager.defaultAllowedTypes,
      customInstructions: config.get<string>("customInstructions"),
      maxTokens: config.get<number>("maxTokens") || ConfigManager.defaultMaxTokens,
      model: config.get<string>("model") || ConfigManager.defaultModel,
      temperature: config.get<number>("temperature") || ConfigManager.defaultTemperature,
    }
  }
}
