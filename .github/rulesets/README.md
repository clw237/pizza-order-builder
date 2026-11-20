# Branch rules for `main`

`main.json` is the ruleset that protects `main`. GitHub doesn't apply it from this folder; it's kept
here so the settings are reviewed and versioned like code. Import it once by hand.

## What it enforces
- **Pull requests only:** no direct pushes, force-pushes or deletion of `main`.
- **CI must pass:** the `check` and `changelog` jobs from `.github/workflows/ci.yml` must succeed, on a
  branch that is up to date with `main` ("Require branches to be up to date"). Without this, a branch
  can merge after `main` was merged into it but before CI ran on the result, and `main` goes red.
- **Review threads resolved** before merging.
- **No required approvals.** GitHub doesn't let you approve your own pull request, and agent sessions
  push as your account, so a required approval would block every merge. Your review is the merge itself.
- **Emergency bypass:** repository admins can still merge a pull request that fails the rules by
  ticking the bypass box on the merge button. Use it only when CI itself is broken, and say why.

If you rename or add CI jobs, update `required_status_checks` here and re-import.

## How to apply it
1. GitHub → the repository → **Settings → Rules → Rulesets**.
2. **New ruleset → Import a ruleset**, choose `.github/rulesets/main.json`, then **Create**.
3. Check that the ruleset shows **Active** and targets the default branch.

GitHub enforces rulesets on public repositories on every plan. On a private repository it needs a
paid plan (Pro, Team or Enterprise); until then the "green on the merged head" rule in
`CONTRIBUTING.md` is what keeps `main` green.
