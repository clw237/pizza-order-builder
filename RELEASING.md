# Releasing

Versions follow [Semantic Versioning](https://semver.org/): `MAJOR.MINOR.PATCH`. Before 1.0, a minor
version can change behaviour; a patch only fixes things.

Releases happen only when the owner asks. Claude never tags on its own.

## Steps
1. **Release pull request.** On a branch `release/X.Y.Z`, rename `## [Unreleased]` in `CHANGELOG.md`
   to `## [X.Y.Z] - YYYY-MM-DD`, add a fresh empty `## [Unreleased]` above it, and bump the version
   wherever the project keeps one (`pyproject.toml`, `package.json`, `Cargo.toml`...). Title the pull
   request "Release X.Y.Z".
2. **Merge it** once CI is green.
3. **Tag the merge commit and publish:** on GitHub, **Releases → Draft a new release**, create tag
   `vX.Y.Z` on `main`, paste that version's `CHANGELOG.md` section as the notes, and publish. Tick
   "Set as a pre-release" while the project is below 1.0 if you like.

## Rules
- **Never edit a released section** of `CHANGELOG.md`. Corrections go in a new release. If merging
  `main` moves an `[Unreleased]` line into a released section, move it back.
- A tag is never moved or reused. A bad release is fixed by the next one.
