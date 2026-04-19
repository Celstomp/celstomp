# Security Policy

## Supported Versions

The following versions of Celstomp are currently being supported with security updates:

| Version | Supported          |
| ------- | ------------------ |
| latest  | :white_check_mark: |
| < 1.0   | :x:                |

## Reporting a Vulnerability

We take the security of Celstomp seriously. If you believe you have found a security vulnerability, please report it to us as described below.

### How to Report

**Please do not report security vulnerabilities through public GitHub issues.**

Instead, please report security vulnerabilities by creating a private security advisory:

1. Go to the [Security Advisories](https://github.com/Celstomp/celstomp/security/advisories) page
2. Click "New draft security advisory"
3. Fill in the details about the vulnerability
4. Submit the advisory

Alternatively, you can contact the maintainers directly via GitHub.

### What to Include

When reporting a vulnerability, please include:

- **Description**: A clear description of the vulnerability
- **Steps to reproduce**: Detailed steps to reproduce the issue
- **Impact**: The potential impact of the vulnerability
- **Affected versions**: Which versions are affected
- **Proof of concept**: If applicable, provide a proof of concept
- **Suggested fix**: Any suggestions for fixing the vulnerability (optional)

### Response Timeline

We will acknowledge receipt of your vulnerability report within 48 hours and will send a more detailed response within 72 hours indicating the next steps in handling your report.

After the initial reply to your report, we will endeavor to keep you informed of the progress towards a fix and full announcement, and may ask for additional information or guidance.

### Disclosure Policy

When we receive a security bug report, we will:

1. Confirm the problem and determine the affected versions
2. Audit code to find any potential similar problems
3. Prepare fixes for all supported versions
4. Release new versions with the fixes

We will coordinate the disclosure of the vulnerability with you and will credit you in the release notes unless you prefer to remain anonymous.

## Security Best Practices for Users

### Running Locally

When running Celstomp locally:

- Only run the development server on trusted networks
- Do not expose the development server to the public internet
- Use a firewall if necessary

### Data Safety

- Regularly save your work using the built-in save feature
- Export your projects as JSON files for backup
- Be cautious when importing project files from untrusted sources

## Security-Related Configuration

### Content Security Policy

Celstomp uses standard browser security features. Ensure your browser is up to date for the best security.

### Dependencies

This project has minimal dependencies:
- Modern web browser with JavaScript enabled
- Python 3.x (optional, for the legacy local development server)
- Node.js + npm (optional, for the Vite development/build workflow)

The core application runs entirely in the browser; the Node/Python tooling is for local development only.

## Known Security Considerations

### Client-Side Only

Celstomp is a client-side only application. All data processing happens in the browser:

- No server-side processing of user data
- No user accounts or authentication
- No data collection or tracking
- All projects are stored locally in your browser

### File Imports

When importing files (palettes, projects):

- Only import files from trusted sources
- JSON files are parsed but not executed
- Always verify the content of imported files

### Browser Storage

The application uses browser localStorage for:
- Autosave functionality
- User preferences
- Palette storage

Clear your browser data to remove all stored information.

## Updates and Security Patches

Security updates will be released as part of regular updates. Users are encouraged to:

- Use the latest version of the application
- Keep their browsers updated
- Report any security concerns promptly

## Questions

If you have any questions about this security policy, please open an issue or contact the maintainers.
