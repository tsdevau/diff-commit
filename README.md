# Diff Commit

Diff Commit is a VSCode extension that helps you generate commit messages following the conventional commits specification using Anthropic's AI models like Claude 3.5 Sonnet. Commit messages are generated using the diff of staged changes and entered directly into the SCM message input or previewed in a new editor window.

The generated commit messages are compatible with [googleapis/release-please](https://github.com/googleapis/release-please) and other tools that use conventional commits.

## Table of Contents

- [Diff Commit](#diff-commit)
  - [Table of Contents](#table-of-contents)
  - [Features](#features)
  - [Requirements](#requirements)
  - [Installation](#installation)
  - [Typical Workflow](#typical-workflow)
  - [Commands](#commands)
    - [`DiffCommit: Generate Commit Message`](#diffcommit-generate-commit-message)
      - [DiffCommit: Generate Commit Message Default Keyboard Shortcuts](#diffcommit-generate-commit-message-default-keyboard-shortcuts)
    - [`DiffCommit: Preview Commit Message`](#diffcommit-preview-commit-message)
      - [DiffCommit: Preview Commit Message Default Keyboard Shortcuts](#diffcommit-preview-commit-message-default-keyboard-shortcuts)
    - [`DiffCommit: Update API Key`](#diffcommit-update-api-key)
    - [`DiffCommit: Delete API Key`](#diffcommit-delete-api-key)
  - [Configuration](#configuration)
    - [`diffCommit.allowedTypes`](#diffcommitallowedtypes)
      - [allowedTypes Default Value](#allowedtypes-default-value)
      - [allowedTypes Options](#allowedtypes-options)
    - [`diffCommit.customInstructions`](#diffcommitcustominstructions)
      - [customInstructions Default Value](#custominstructions-default-value)
      - [customInstructions Options](#custominstructions-options)
    - [`diffCommit.model`](#diffcommitmodel)
      - [model Default Value](#model-default-value)
      - [model Options](#model-options)
    - [`diffCommit.maxTokens`](#diffcommitmaxtokens)
      - [maxTokens Default Value](#maxtokens-default-value)
      - [maxTokens Range](#maxtokens-range)
    - [`diffCommit.temperature`](#diffcommittemperature)
      - [temperature Default Value](#temperature-default-value)
      - [temperature Range](#temperature-range)
  - [Error Handling](#error-handling)
    - [Git Related](#git-related)
    - [API Key Related](#api-key-related)
    - [Anthropic API Errors](#anthropic-api-errors)
    - [Other Errors](#other-errors)
  - [Local Development](#local-development)
    - [Local Testing](#local-testing)
  - [Contributing](#contributing)
  - [License](#license)

## Features

- Generate commit messages based on the diff of staged changes using Anthropic's AI models like Claude 3.5 Sonnet
- Preview and edit generated commit messages before applying the commit
- Uses markdown formatting for commit messages
- Implements conventional commit format with type, scope, subject, and body

## Requirements

- VSCode 1.9.4 or higher
- Git installed and configured in your workspace
- An [Anthropic API key](https://console.anthropic.com/settings/keys)

## Installation

Install the extension directly from the [Visual Studio Code Marketplace](https://marketplace.visualstudio.com/items?itemName=tpsTech.diff-commit) or:

1. Open VSCode
2. Press <kbd>Cmd</kbd>/<kbd>Ctrl</kbd> + <kbd>P</kbd>
3. Type `ext install tpsTech.diff-commit`

## Typical Workflow

1. Stage the changes that you wish to commit as normal
2. Run the command: "DiffCommit: Generate Commit Message" (<kbd>Cmd</kbd>/<kbd>Ctrl</kbd> + <kbd>K</kbd> then <kbd>Cmd</kbd>/<kbd>Ctrl</kbd> + <kbd>G</kbd>)
3. Confirm or edit the generated commit message in the Source Control message input
4. Click 'Commit' to commit the changes with the generated message

## Commands

DiffCommit commands can be accessed from the Command Palette (<kbd>Cmd</kbd>/<kbd>Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>P</kbd>) or using the default keyboard shortcuts.

### `DiffCommit: Generate Commit Message`

This will generate a commit message for staged changes and enter it in the Source Control message input box. You can preview and edit the generated message before committing.

#### DiffCommit: Generate Commit Message Default Keyboard Shortcuts

- macOS: <kbd>Cmd</kbd> + <kbd>K</kbd> then <kbd>Cmd</kbd> + <kbd>G</kbd>
- Windows/Linux: <kbd>Ctrl</kbd> + <kbd>K</kbd> then <kbd>Ctrl</kbd> + <kbd>G</kbd>

### `DiffCommit: Preview Commit Message`

This will generate a commit message for staged changes and open it in a new editor window. You can preview and edit the generated message before committing.

#### DiffCommit: Preview Commit Message Default Keyboard Shortcuts

- macOS: <kbd>Cmd</kbd> + <kbd>K</kbd> then <kbd>Cmd</kbd> + <kbd>P</kbd>
- Windows/Linux: <kbd>Ctrl</kbd> + <kbd>K</kbd> then <kbd>Ctrl</kbd> + <kbd>P</kbd>

### `DiffCommit: Update API Key`

This will update the Anthropic API key used for API access. Enter your API key when prompted and press <kbd>Enter</kbd> to confirm or <kbd>Esc</kbd> to cancel.

### `DiffCommit: Delete API Key`

This will delete the stored API key from your system and prevent DiffCommit from accessing the API in the future.

## Configuration

DiffCommit provides the following settings to customise its behavior.

### `diffCommit.allowedTypes`

A list of allowed commit types. If provided, this replaces the default options.

#### allowedTypes Default Value

[ "feat", "fix", "refactor", "chore", "docs", "style", "test", "perf", "ci" ]

#### allowedTypes Options

**string[]** - A list (array) of any string you want to be able to use as a commit type.

### `diffCommit.customInstructions`

Add additional custom instructions to the commit generation prompt. Useful for providing context or specific requirements like 'Use Australian English spelling'.

#### customInstructions Default Value

""

#### customInstructions Options

**string** - Free formatted string that you want to included as custom instructions for the AI prompt.

### `diffCommit.model`

The Anthropic AI model to use for generating commit messages.

#### model Default Value

"claude-3-5-sonnet-latest"

#### model Options

**enum** - "claude-3-opus-latest" | "claude-3-sonnet-latest" | "claude-3-haiku-20240307"

### `diffCommit.maxTokens`

Maximum number of tokens to generate in the response. Higher values allow for longer commit messages but use more API tokens.

#### maxTokens Default Value

1024

#### maxTokens Range

**number** - 1 to 8192

### `diffCommit.temperature`

Controls randomness in the response. Lower values (like 0.4) produce more focused and consistent commit messages, while higher values introduce more variety.

#### temperature Default Value

0.4

#### temperature Range

**number** - 0 to 1

## Error Handling

Diff Commit accommodates error handling to provide clear feedback and assist in troubleshooting.  The following  are the common warning or error scenarios you might encounter.

### Git Related

- Git extension not found in VSCode
- No Git repository found in the current workspace
- No workspace folder found
- No staged changes detected

### API Key Related

- API key is missing or not provided
- Invalid API key format (should start with sk-ant-api)
- Failed to access or update secure storage

### Anthropic API Errors

- **400** - Bad Request: Review your prompt and try again
- **401** - Unauthorized: Invalid API key, update your API key and try again
- **403** - Forbidden: Permission denied, update your API key and try again
- **429** - Rate Limited: Too many requests, try again later
- **500** - Server Error: Anthropic API server error

### Other Errors

- Failed to write commit message to Source Control
- Failed to open commit message preview
- No commit message was generated by the API

If you encounter any of these errors, the extension will display a message with more details. For persistent issues, please check your setup and if appropriate, raise an issue on [GitHub](https://github.com/tsdevau/diff-commit/issues).

## Local Development

1. Clone the [repository](https://github.com/tsdevau/diff-commit)
2. Install dependencies: `pnpm install`
3. Build the extension: `pnpm compile`
4. Run the tests: `pnpm test`

### Local Testing

1. Press F5 (<kbd>Cmd</kbd>/<kbd>Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>P</kbd> and select `Debug: Start Debugging`) to start the debugger
2. This will open a new VSCode window with the extension loaded
3. Make changes to files and use the source control panel to test the extension

## Contributing

Feature requests, suggestions and contributions to Diff Commit are welcome! Please feel free to submit an idea or Pull Request.

## License

This project is licensed under the MIT License.
