import * as vscode from "vscode"

export interface CommitConfig {
  customInstructions?: string
  allowedTypes: string[]
  model: string
  maxTokens: number
  temperature: number
}

export class ConfigManager {
  private static readonly defaultModel = "claude-3-5-sonnet-latest"
  private static readonly defaultMaxTokens = 1024
  private static readonly defaultTemperature = 0.4
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

  getConfig(): CommitConfig {
    const config = vscode.workspace.getConfiguration("diffCommit")

    return {
      customInstructions: config.get<string>("customInstructions"),
      allowedTypes: config.get<string[]>("allowedTypes") || ConfigManager.defaultAllowedTypes,
      model: config.get<string>("model") || ConfigManager.defaultModel,
      maxTokens: config.get<number>("maxTokens") || ConfigManager.defaultMaxTokens,
      temperature: config.get<number>("temperature") || ConfigManager.defaultTemperature,
    }
  }
}
