# Versioning and releases

DiagramaHub follows [Semantic Versioning 2.0.0](https://semver.org/): `MAJOR.MINOR.PATCH`. The full policy is in [`VERSIONING.md`](https://github.com/diagramahub/diagramahub/blob/main/VERSIONING.md) (Spanish).

| Bump | When |
|---|---|
| **PATCH** | Fixes, polish, performance improvements, prompt tweaks, internal refactors: no new capability |
| **MINOR** | A new backwards-compatible feature or capability |
| **MAJOR** | Breaking changes to the API, data structures, import/export or frontend/backend contracts |

When in doubt: if it only fixes or polishes, it's PATCH; if it adds a capability, MINOR.

!!! info "Beta"
    While the version is `0.x`, APIs and data structures may change between versions. From `1.0.0` on, every breaking change will require a MAJOR bump.

## Branches and tags

- Each version is prepared on a **`release/<V>`** branch (e.g. `release/0.8.4`) and merged into `main` through a PR.
- Git tags **have no `v` prefix**: `0.8.3`, not `v0.8.3`.

## Files that carry the version

| File | Value |
|---|---|
| `frontend/package.json` | `"version": "<V>"` |
| `backend/pyproject.toml` | `version = "<V>"` |
| `frontend/.env.template` | `VITE_APP_VERSION=<V>` |
| `backend/app/core/config.py` | `VERSION: str = "<V>"` (reported by `GET /`, Swagger and Sentry) |
| `AGENTS.md` | current version, versioning section and environment example |
| `VERSIONING.md` | `Versión actual: **<V>**.` |

## Release checklist

1. Decide the bump (MAJOR, MINOR or PATCH).
2. Update the version in every file in the table above.
3. Write the notes `docs/es/release-notes/<V>.md` and `docs/en/release-notes/<V>.md`, split by change type (💥 Breaking Changes, ✨ Features, 🐛 Fixes, ♻️ Refactors, ⬆️ Upgrades, 📝 Docs, 🌐 Translations, 🔧 Internal; only those with entries).
4. Add the `[<V>](<V>.md)` row to `docs/{es,en}/release-notes/index.md`.
5. Add the pages to the `nav` in `mkdocs.yml` ("Notas de Versión" / "Release Notes" section, inside its minor-version group).
6. Add `## [<V>] - <date>` to `CHANGELOG.md` (in English, [Keep a Changelog](https://keepachangelog.com/) format).
7. Update the coverage badge in `README.md` with the total of the full run.
8. Create the `<V>` tag.
9. **Mandatory check**:

    ```bash
    bash scripts/check-version.sh <V>
    ```

    The script fails closed against every file that must carry the version (code, configuration, docs, release notes, MkDocs `nav` and CHANGELOG). If anything reports `FAIL`, the release is not merged.

!!! note
    Lockfiles (`backend/poetry.lock`, `frontend/pnpm-lock.yaml`) are never edited by hand and the script ignores them. If a new file starts carrying the version, add it to the checklist in `VERSIONING.md` and to the script.

## Documentation site

This site is built with MkDocs Material and published to GitHub Pages by the `.github/workflows/docs.yml` workflow whenever `docs/`, `overrides/` or `mkdocs.yml` change on `main` (pull requests only build it). To preview it locally:

```bash
pip install -r docs/requirements.txt
mkdocs serve            # http://127.0.0.1:8000
mkdocs build --strict   # fails on broken links, like CI
```
