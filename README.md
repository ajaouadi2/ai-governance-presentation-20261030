# Free Render hosting

The current v3.2 questionnaire, synthesis and report workflow uses JSON files, without PostgreSQL. `render.yaml` selects the free Node web service explicitly: no paid database or disk. Render supplies `PORT` and `RENDER_EXTERNAL_URL`; the latter is added to the API's exact origin allowlist.

Build: `npm ci --include=dev && npm run db:generate && npm run build`.
Start: `node scripts/hosting-start.mjs`.

The startup script binds to `0.0.0.0` and restores four explicitly selected fictional presentation examples and one current report per language from `hosting/presentation-seed`. It never overwrites existing files. The seed preserves the actual saved dossier revisions and signed decision records; it does not reconstruct examples from their original builders. Historical dossiers, local database, environment files, evidence uploads and backups are excluded. `scripts/export-hosting-seed.ts` exports the allowlisted four with confirmed decisions and integrity-checked current reports; inspect the export before publication.

The free service uses temporary storage. Edits, new dossiers and reports can disappear on restart/redeploy; the four bundled examples reappear. Users should download any report they want to keep. The service may sleep when idle. This is an academic demonstration with simulated roles, not an authenticated university service; only fictional information should be entered. Prepared examples are editable like other dossiers.

Only the current v3.2 workflow is provisioned. Historical database-backed workflows in Archives require the local PostgreSQL installation and are not included in this hosted dataset. No database connection string is needed for the current workflow.

Deploy the complete current source, including untracked implementation files and `hosting/presentation-seed`; do not deploy the old Git HEAD alone. A signed-in Render account and a reachable source repository are required. Never upload `.env*` (except the intentional example), `data/`, `backups/`, `.git/`, `node_modules/`, `.next/`, or presentation documents. No service has been created merely by adding these configuration files.

For isolated verification, set `CLAIR_V32_DATA_DIR` to an empty temporary directory and run the startup script on a separate `PORT`. Set `RENDER_EXTERNAL_URL` to the exact test origin. This does not touch the live local dossiers.
