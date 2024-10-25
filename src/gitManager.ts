import { extensions, window } from "vscode"
import { GitExtension } from "./git"

export class GitManager {
  getRepo() {
    const gitExtension = extensions.getExtension<GitExtension>("vscode.git")?.exports
    if (!gitExtension) {
      window.showErrorMessage("Git extension not found")
      return undefined
    }
    const gitAPI = gitExtension.getAPI(1)
    const gitRepo = gitAPI.repositories[0]
    if (!gitRepo) {
      window.showErrorMessage("No Git repository found")
      return undefined
    }
    return gitRepo
  }

  async getDiff() {
    const gitRepo = this.getRepo()
    if (!gitRepo) {
      return undefined
    }

    return await gitRepo.diff(true)
  }

  setCommitMessage(message: string) {
    const gitRepo = this.getRepo()
    if (gitRepo) {
      gitRepo.inputBox.value = message
    }
  }
}
