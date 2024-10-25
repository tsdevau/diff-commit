import * as vscode from "vscode"

export class GitManager {
  getRepo(): any | undefined {
    const gitExtension = vscode.extensions.getExtension("vscode.git")?.exports
    if (!gitExtension) {
      vscode.window.showErrorMessage("Git extension not found")
      return undefined
    }
    const gitAPI = gitExtension.getAPI(1)
    const gitRepo = gitAPI.repositories[0]
    if (!gitRepo) {
      vscode.window.showErrorMessage("No Git repository found")
      return undefined
    }
    return gitRepo
  }

  async getDiff(): Promise<string | undefined> {
    const gitRepo = this.getRepo()
    if (!gitRepo) {
      return undefined
    }

    return await gitRepo.diff(true)
  }

  setCommitMessage(message: string): void {
    const gitRepo = this.getRepo()
    if (gitRepo) {
      gitRepo.inputBox.value = message
    }
  }
}
