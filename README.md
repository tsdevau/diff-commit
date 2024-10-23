# Diff Commit

Diff Commit is a VSCode extension that helps you generate conventional commit messages using Claude 3.5 AI.

## Features

- Generate commit messages based on staged changes using Claude 3.5 Sonnet
- Preview generated commit messages before applying
- Uses markdown formatting for commit messages
- Implements conventional commit format with type and scope

## Requirements

- VSCode 1.85.0 or higher
- Git installed and configured in your workspace
- An Anthropic API key for accessing Claude 3.5 AI

## Usage

1. Stage your changes in Git
2. Open the Command Palette (Ctrl+Shift+P)
3. Run the command: "DiffCommit :: Generate Commit Message"
4. Enter your Anthropic API key when prompted for message generation
5. Review the generated commit message in the preview window
6. Choose to either:
   - "Insert into SCM": Apply the message to the source control input
   - "Cancel": Discard the generated message

## Configuration

The extension provides the following settings:

- `diffCommit.maxTokens`: Maximum number of tokens to generate in the response. Higher values allow for longer commit messages but use more API tokens. (Default: 1024, Range: 1-8192)
- `diffCommit.temperature`: Controls randomness in the response. Lower values (like 0.4) produce more focused and consistent commit messages, while higher values introduce more variety. (Default: 0.4, Range: 0-1)

## Error Handling

Diff Commit includes comprehensive error handling to provide clear feedback and assist in troubleshooting. Here are some common error scenarios and their meanings:

- `GIT_EXTENSION_NOT_FOUND`: The VSCode Git extension is not installed or activated
- `NO_GIT_REPO`: No Git repository was found in the current workspace
- `NO_STAGED_CHANGES`: There are no staged changes to generate a commit message for
- `API_KEY_MISSING`: The Anthropic API key was not provided
- `API_REQUEST_FAILED`: The request to the Anthropic API failed. Check your internet connection and API key
- `API_NO_RESPONSE`: No response was received from the Anthropic API
- `API_REQUEST_SETUP_ERROR`: An error occurred while setting up the API request
- `UNKNOWN_ERROR`: An unexpected error occurred

If you encounter any of these errors, the extension will display a message with more details. For persistent issues, please check your setup or contact support.

## Development

### Setup

1. Clone the repository
2. Install dependencies:
```bash
pnpm install
```

### Running Tests

Run the tests using:
```bash
pnpm test
```

### Building

Build the extension:
```bash
pnpm compile
```

Watch for changes during development:
```bash
pnpm watch
```

### Local Testing

1. Press F5 in VSCode to start debugging
2. This will open a new VSCode window with the extension loaded
3. Make changes to files and use the source control panel to test the extension

## Contributing

Contributions to Diff Commit are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the MIT License.
