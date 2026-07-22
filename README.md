# Bulk Mapper — HRIS Import Normalizer

Turn any attendance export into the exact upload format your HRIS expects.
**Set it up once, reuse it forever.**

The core idea:

- The **target file** defines the final structure and format.
- The **source file** provides the data.
- A saved **conversion template** connects the two (mappings + rules + validation + output settings).

## Two roles

- **Super Admin** — creates companies and, for each, builds the target template
  + conversion rules once. This is the full guided builder ("Admin Studio").
- **HR** — scoped to one company. Picks the prepared template, uploads a source
  file, reviews, and downloads in the saved target format. Never sees the rule
  machinery.

## Key decisions

- **Client-side conversion (ExcelJS in the browser):** employee attendance data
  never leaves the user's machine. Supabase stores only config + templates + a
  light audit log — **not** raw source rows.
- **Target-faithful output:** downloads are generated *from* the saved target
  workbook — worksheet name/order, header position, static rows, column
  names/order, widths, date/time/number formats and frozen panes are preserved.
  Only the data area below the header is populated.
- **Nothing hardcoded:** every column name, condition value, worksheet, format
  and filename is configuration.

## Tech stack

Next.js (App Router) · TypeScript · Tailwind + atomic design · Framer Motion ·
Supabase (Postgres + Auth + RLS) · ExcelJS · Zod · Vitest + Playwright · Vercel.

## Project layout

```
src/
  app/                 # routes (login, /admin, /hr, auth, api)
  lib/
    engine/            # framework-agnostic conversion engine (no hardcoding)
      fileParser.ts               # parse target/source workbooks
      configurableAttendanceTransform.ts  # rule matching, In→Out, missing-value logic
      employeeDateIndex.ts        # exact next/previous calendar-day lookup
      targetFileGenerator.ts      # byte-faithful target-format output
      formulaEngine.ts            # safe formula evaluator (+ NEXT_CALENDAR_DAY)
      normalize.ts / format.ts    # matching + output formatting
    supabase/          # browser/server/admin clients + middleware
    auth.ts            # session + profile helper
supabase/migrations/   # schema + RLS
tests/unit/            # engine tests (62 spec cases)
```

## Getting started

See [SETUP.md](SETUP.md). Short version: `pnpm install`, create a Supabase
project, fill `.env.local`, run the migration, `pnpm dev`.

## Status

| Phase | Area | State |
| ----- | ---- | ----- |
| 1 | Project foundation | ✅ Done |
| 2 | Schema, RLS, auth | ✅ Done |
| 3 | Conversion engine + tests | ✅ Done (52/52) |
| 4 | Design system & wizard shell | ✅ Done |
| 5 | Admin Studio (8-step template builder) | ✅ Done |
| 6 | HR Quick Convert | ✅ Done |
| 7 | Dashboards & template management | ✅ Done |
| 8 | E2E tests + live deploy | ⏳ Needs a provisioned Supabase (see SETUP.md) |

Verified locally: `pnpm test` (52/52), `pnpm typecheck`, `pnpm lint`, `pnpm build` all green.

## Screens

- **/login** — secure sign-in (Supabase Auth).
- **/admin** — super-admin dashboard (companies, templates, recent conversions).
- **/admin/companies** — create companies, invite HR users.
- **/admin/templates** — manage templates (edit / duplicate / delete, status, version).
- **/admin/templates/new** and **/…/[id]/edit** — the 8-step Admin Studio builder.
- **/hr** — HR picks a published template.
- **/hr/convert/[templateId]** — upload source → review → download in the saved target format.
