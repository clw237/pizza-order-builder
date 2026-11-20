# Security policy

## Reporting a vulnerability
Please **don't open a public issue**. Use GitHub's private reporting instead: the repository's
**Security** tab → **Report a vulnerability**. You'll get a reply as soon as the maintainer can, and
credit in the fix's release notes if you'd like it.

## What's in place
- **Secrets stay out of git.** `.env` is ignored, and `.env.example` lists the variable names only.
  The Security workflow runs gitleaks on every push and pull request.
- **If a secret is committed,** rotate it first (revoke it with whoever issued it), then remove it.
  Deleting it from the code doesn't remove it from git history.
- **The files Claude follows are scanned.** `CLAUDE.md` and `.claude/` are checked for hidden
  characters, HTML comments, encoded payloads, download-and-run lines and unexpected hooks.
- **Claude Code permissions** deny force-pushes, pushes to `main`, recursive force deletes and reading
  key or `.env` files, and ask before installing dependencies (`.claude/settings.json`).
- **Dependencies:** Dependabot keeps pinned GitHub Actions (and, once added, the project's packages)
  current. Fix a high or critical advisory by upgrading, not by ignoring it.

## Recommended repository settings
Settings → **Code security**: turn on secret scanning, push protection, Dependabot alerts and private
vulnerability reporting.
