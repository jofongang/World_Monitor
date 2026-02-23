# Open Source Security Checklist

Use this checklist right before making the repository public.

## Repository Hygiene

- [ ] `git status` is clean.
- [ ] No local-only files are tracked (`*.log`, databases, virtual envs, caches).
- [ ] `.env` files are not tracked.
- [ ] `.gitignore` includes runtime artifacts for backend and frontend.

## Secrets

- [ ] Run a secret scan (local and in CI).
- [ ] Rotate any credential that may have ever been committed.
- [ ] If credentials were committed historically, rewrite git history before publishing.

## Dependencies

- [ ] Run backend dependency audit.
- [ ] Run frontend dependency audit.
- [ ] Patch or document remaining vulnerabilities.

## Runtime Safety

- [ ] App boots with environment variables only (no hardcoded keys).
- [ ] Missing optional keys degrade gracefully.
- [ ] Health endpoints respond (`/health`, `/ready`).

## Compliance

- [ ] Data sources and attribution are documented (`SOURCES.md`).
- [ ] OSINT safety boundaries are documented (`SAFETY.md`).
- [ ] Vulnerability reporting policy exists (`SECURITY.md`).
