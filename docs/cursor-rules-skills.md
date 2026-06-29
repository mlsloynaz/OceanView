# Cursor rules and skills (OceanView)

How this repo configures the Cursor agent: **rules** (always-on or file-scoped guidance) and **skills** (workflows the agent loads when relevant).

**Location in repo:** `.cursor/rules/` and `.cursor/skills/`

---

## Project rules

Rules are `.mdc` files with YAML frontmatter (`description`, `globs`, `alwaysApply`).

| Rule | File | Scope | Purpose |
|------|------|-------|---------|
| **update-documentation** | `.cursor/rules/update-documentation.mdc` | Always apply | When fixing bugs or adding features, update the matching feature doc in the same task |

### update-documentation — doc map

| Code area | Doc |
|-----------|-----|
| `src/features/market/**` | [market-page.md](./market-page.md) |
| `src/features/premarket/**` | [premarket-page.md](./premarket-page.md) |
| `src/features/admin/candles/**` | [candles-pane.md](./candles-pane.md) |
| `.cursor/rules/**`, `.cursor/skills/**` | This file ([cursor-rules-skills.md](./cursor-rules-skills.md)) |

Cross-cutting docs (when relevant): [README.md](./README.md), [aws-urls.md](./aws-urls.md), [environment.md](./environment.md), [market-page.md](./market-page.md) (APIs section).

---

## Project skills

Skills are folders under `.cursor/skills/<name>/` with a `SKILL.md` file (YAML frontmatter: `name`, `description`).

| Skill | Path | When the agent uses it |
|-------|------|------------------------|
| **oceanview-dev-local** | `.cursor/skills/oceanview-dev-local/SKILL.md` | Run OceanView locally with UI + OceanView-API (SAM): `npm run dev:local`, proxy, health check |

### oceanview-dev-local — summary

- **Command:** `npm run dev:local` or `.\scripts\dev-local.ps1` from repo root
- **Starts:** SAM API on `http://127.0.0.1:3001` (new window) + Vite UI on `http://localhost:5173`
- **Requires:** Node, Docker, SAM CLI, sibling `OceanView-API` repo
- **Options:** `-ApiPort`, `-ApiRoot`, `-SkipApi` — see skill file for details

---

## User-level rules and skills (not in this repo)

Cursor also loads **global** config from your user profile. These are **not** committed to OceanView but appear in agent sessions:

| Location | Contents (examples) |
|----------|---------------------|
| `~/.cursor/skills/` | Domain skills (`angular`, `frontend-design`, `SQL`, …) |
| `~/.cursor/skills-cursor/` | Cursor meta-skills (`create-rule`, `create-skill`, `canvas`, …) |

Only **project** rules and skills under `.cursor/` in this repo should be documented here.

---

## Adding or changing rules / skills

1. **Rule** — add `.cursor/rules/<name>.mdc` with frontmatter; set `alwaysApply: true` or `globs` for file-scoped rules.
2. **Skill** — add `.cursor/skills/<name>/SKILL.md` with `name` and `description` in frontmatter.
3. **Update this file** — add a row to the tables above (required by the update-documentation rule).
4. If the new rule/skill affects feature workflows, also update the relevant feature doc.

For authoring help, use Cursor’s built-in **create-rule** and **create-skill** skills (user-level, not in this repo).

---

## Related docs

| Doc | Purpose |
|-----|---------|
| [README.md](./README.md) | Documentation index |
| [environment.md](./environment.md) | Local dev env vars and proxy |
| `.cursor/skills/oceanview-dev-local/SKILL.md` | Full local dev workflow |
| `.cursor/rules/update-documentation.mdc` | Agent rule enforcing doc updates |
