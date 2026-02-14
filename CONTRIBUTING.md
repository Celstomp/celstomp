# Contributing to Celstomp

Thank you for your interest in contributing to Celstomp! This document provides guidelines and instructions for contributing to this project.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [How Can I Contribute?](#how-can-i-contribute)
- [Development Workflow](#development-workflow)
- [Style Guidelines](#style-guidelines)
- [Commit Messages](#commit-messages)
- [Pull Request Process](#pull-request-process)

## Code of Conduct

This project and everyone participating in it is governed by our [Code of Conduct](CODE_OF_CONDUCT.md). By participating, you are expected to uphold this code.

## Getting Started

1. Fork the repository
2. Clone your fork: `git clone https://github.com/YOUR_USERNAME/celstomp_v1.git`
3. Create a new branch for your feature or bug fix
4. Make your changes
5. Submit a pull request

## How Can I Contribute?

### Reporting Bugs

Before creating a bug report, please:

- Check the [existing issues](https://github.com/ginyoa/celstomp_v1/issues) to see if the problem has already been reported
- Use the latest version to verify the bug still exists

When submitting a bug report, please include:

- **Clear description** of the bug
- **Steps to reproduce** the issue
- **Expected behavior** vs **actual behavior**
- **Browser and version** (e.g., Chrome 120, Firefox 121)
- **Operating system** (Windows, macOS, Linux)
- **Screenshots** if applicable
- **Console errors** (press F12 → Console tab)

### Suggesting Features

Feature suggestions are welcome! Please:

- Check if the feature has already been suggested
- Provide a clear use case and description
- Explain why this feature would be useful to most users

### Pull Requests

1. Ensure your code follows the project's style guidelines
2. Update documentation if needed
3. Add comments to explain complex logic
4. Test your changes thoroughly
5. Reference any related issues in your PR description

## Development Workflow

### Setting Up Local Development

```bash
# Clone your fork
git clone https://github.com/YOUR_USERNAME/celstomp_v1.git
cd celstomp_v1

# Run the development server
./run-dev.command    # Linux/Mac
run-dev.bat          # Windows
```

The server will start at `http://localhost:8000`

### Project Structure

```
celstomp_v1/
├── celstomp/           # Main application
│   ├── css/           # Stylesheets
│   ├── js/            # JavaScript files
│   ├── icons/         # Icons and images
│   └── parts/         # HTML partials
├── LICENSE
└── README.md
```

## Style Guidelines

### JavaScript

- Use meaningful variable and function names
- Add comments for complex logic
- Keep functions focused and small
- Use consistent indentation (2 spaces)
- Follow existing code patterns

### CSS

- Use kebab-case for class names (e.g., `.timeline-grid`)
- Group related styles together
- Use CSS variables for colors and sizes when possible
- Comment sections clearly

### HTML

- Use semantic HTML elements
- Keep accessibility in mind (ARIA labels where needed)
- Use consistent indentation

## Commit Messages

Write clear, concise commit messages:

- Use present tense ("Add feature" not "Added feature")
- Use imperative mood ("Move cursor to..." not "Moves cursor to...")
- Limit the first line to 72 characters or less
- Reference issues and pull requests where appropriate

Examples:
```
Add keyboard shortcut for frame navigation

Fix onion skin opacity not updating correctly

Refactor timeline rendering for better performance
```

## Pull Request Process

1. **Create a branch** from `main` for your changes
2. **Make your changes** following the style guidelines
3. **Test thoroughly** in multiple browsers if possible
4. **Update documentation** if your changes affect usage
5. **Submit your PR** with a clear description

### PR Description Template

```markdown
## Description
Brief description of what this PR does

## Changes Made
- List specific changes
- Be clear and concise

## Testing
- How you tested these changes
- Browser/OS combinations tested

## Screenshots (if applicable)
Add screenshots for UI changes

## Related Issues
Fixes #123 or References #456
```

### Review Process

- Maintainers will review your PR as soon as possible
- Address any feedback or requested changes
- Once approved, a maintainer will merge your PR

## Questions?

If you have questions about contributing:

- Open an issue with the "question" label
- Reach out to the maintainers

Thank you for contributing to Celstomp!
