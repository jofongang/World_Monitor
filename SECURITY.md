# Security Policy

## Supported Scope

This repository accepts security reports for:
- Backend API (`backend/`)
- Frontend application (`frontend/`)
- Build/CI configuration (`.github/`)

## Reporting a Vulnerability

Please do **not** open a public issue for security vulnerabilities.

Report privately with:
- A clear description of the issue
- Reproduction steps or proof of concept
- Impact assessment
- Suggested remediation (if available)

If private reporting is not available for your workflow, create a minimal public issue without exploit details and request a private contact channel.

## Secrets and Credentials

- Never commit `.env` files or API keys.
- Keep all secrets in environment variables only.
- If a secret is exposed:
1. Revoke/rotate it immediately.
2. Remove it from git history before publishing.
3. Audit related systems for misuse.

## Hardening Baseline

Before publishing changes:
1. Run secret scanning.
2. Run dependency audits.
3. Confirm no local logs/databases are tracked.
4. Verify health endpoints and basic app startup still work.
