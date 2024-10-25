import * as vscode from "vscode"

export function activate(context: vscode.ExtensionContext) {
  // Keep track of document content in memory
  const documentContent = new Map<string, string>()
  const originalContent = new Map<string, string>()

  // Create event emitter for content changes
  const onDidChangeEmitter = new vscode.EventEmitter<vscode.Uri>()

  // Register the content provider
  const provider = {
    onDidChange: onDidChangeEmitter.event,
    provideTextDocumentContent: (uri: vscode.Uri) => documentContent.get(uri.path) || "",
  }

  const registration = vscode.workspace.registerTextDocumentContentProvider("commit-preview", provider)

  const disposable = vscode.commands.registerCommand(
    "extension.previewCommitMessage",
    async (aiGeneratedMessage: string) => {
      // Create URI for this preview
      const uri = vscode.Uri.parse("commit-preview:Commit Message Preview")

      // Store initial content
      documentContent.set(uri.path, aiGeneratedMessage)
      originalContent.set(uri.path, aiGeneratedMessage)

      // Open the document
      const doc = await vscode.workspace.openTextDocument(uri)
      await vscode.window.showTextDocument(doc, {
        preview: true,
        preserveFocus: false,
      })

      // Handle saves
      const saveListener = vscode.workspace.onDidSaveTextDocument((savedDoc) => {
        if (savedDoc === doc) {
          const content = documentContent.get(uri.path)
          if (content) {
            vscode.scm.inputBox.value = content
            vscode.window.setStatusBarMessage("Commit message updated", 2000)
          }
        }
      })

      // Handle document changes
      const changeListener = vscode.workspace.onDidChangeTextDocument((e) => {
        if (e.document === doc) {
          documentContent.set(uri.path, e.document.getText())
          onDidChangeEmitter.fire(uri)
        }
      })

      // Handle closing
      const closeListener = vscode.workspace.onDidCloseTextDocument((closedDoc) => {
        if (closedDoc === doc) {
          const current = documentContent.get(uri.path)
          const original = originalContent.get(uri.path)

          // Only update SCM if content was modified
          if (current && original && current !== original) {
            vscode.scm.inputBox.value = current
          }

          // Cleanup
          documentContent.delete(uri.path)
          originalContent.delete(uri.path)
          saveListener.dispose()
          changeListener.dispose()
          closeListener.dispose()
        }
      })

      context.subscriptions.push(saveListener, changeListener, closeListener)
    },
  )

  context.subscriptions.push(disposable, registration)
}

export function deactivate() {}
