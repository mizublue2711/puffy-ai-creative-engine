# RUNBOOK_HOTFIXES.md — Operational Edge-Cases & Hotfixes

> Living runbook for `puffy-ai-creative-engine`. Record real pipeline failures and verified fixes here.

---

## HF-001: Cloudflare Workers Builds / Preview Failing on Branch Builds (Nov 2026)

- **Affected Components**: `wrangler.jsonc` (root and `webapp/`), `package.json` (root and `webapp/`), `package-lock.json`, `webapp/dist/`
- **Context**: Cloud Antigravity workers iterated on Cloudflare PR-preview builds and pushed ~13 consecutive "fix(cf)/fix(ci)" commits, each hitting a different error.

### Failure chain, root cause, fix

| # | Error in Cloudflare log | Root cause | Fix |
|---|---|---|---|
| 1 | `✘ [ERROR] Your Wrangler configuration is missing a "previews" block to run this command.` | Wrangler 4.x requires a `previews` block in the config to run `wrangler preview` on non-main branches. | Add `"previews": {}` to `webapp/wrangler.jsonc` and to the root `wrangler.jsonc`. |
| 2 | Wrangler config not found / wrong assets dir | Cloudflare builds from the repo root, but the only config lived in `webapp/`. | Added a root `wrangler.jsonc` with `assets.directory = ./webapp/dist` (the `webapp/` one keeps `./dist`). |
| 3 | `assets directory ./dist does not exist` | `dist/` is not built before `wrangler preview`, and no build command was configured. | Root `build` script (`npm --prefix webapp run build`) plus `prepreview` hooks so the build runs first. |
| 4 | `npm clean-install` fails with `EUSAGE`: `Missing: three, zustand, vite, ... from lock file` | Bots edited `package.json` (added `workspaces: ["webapp"]`, scripts) without regenerating the lock. With workspaces, the **root** `package-lock.json` is the authoritative lock; it was out of sync. | Run `npm install` at the **repo root**, commit `package-lock.json`. Verify with `npm ci --dry-run` (no `EUSAGE`). |

### Side effects left by the bot commits (cleaned up)

- Built `webapp/dist/` output and heavy test images (`test_artifacts/test_runner_*`, `test_wall_*`, `webapp/public/test_wall_*`, `webapp/dist/assets/3d/aistudio/*`, up to ~2.4 MB each) were committed to git. Removed the test/dist copies; originals in `webapp/public/assets/3d/aistudio/` are kept because the app references them.
- Root `package.json` has a duplicated `"build"` key (harmless, should be deduplicated).
- `webapp` build script changed from `tsc -b && vite build` to `tsc && vite build`.

### Prevention checklist

1. After any `package.json` change, run `npm install` at the repo root and commit the lock together with it.
2. Before pushing, run `npm ci --dry-run` and `npm run build`; both must pass.
3. Cloud workers must not edit `package.json` directly or commit `webapp/dist/` or test screenshots.
4. Keep `previews: {}` in every `wrangler.jsonc` used by Cloudflare.
