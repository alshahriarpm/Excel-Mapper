# Known limitations & notes

Honest list of current constraints and deferred work.

## Environment / setup

- **Live run needs Supabase.** The app can't authenticate or store templates until
  you create a Supabase project and run the migration (see [SETUP.md](SETUP.md)).
  All local checks (`test`, `typecheck`, `lint`, `build`) pass without it.
- **First super-admin and HR users** are bootstrapped via the Supabase dashboard +
  a one-line SQL role assignment; after that, HR users are created from the
  Admin → Companies screen.

## File handling

- **Legacy `.xls` cannot be read** (ExcelJS limitation). The parser rejects it with
  a friendly "re-save as .xlsx" message. Output for an `.xls`-origin template is
  written as `.xlsx`.
- **Target workbook snapshot** is stored as base64 inside the template row. Fine for
  typical blank/sample templates; very large target workbooks would be better held
  in Supabase Storage (straightforward future change).
- **Client-side ExcelJS** adds ~320 kB to the builder and convert routes. This is the
  deliberate trade for privacy (source data never leaves the browser).
- **Header-row override** in the builder re-detects column *types* from cell values
  (not the original number formats), since formats aren't retained after the first
  parse. The admin can adjust types/formats in the confirm step.

## Product scope deferred

- **Source-structure drift** on the HR side is detected and warned about, but the
  guided "pick a replacement column" remap (spec §29) is not yet built — HR is told
  which columns are missing and can proceed or ask the admin.
- **Correction traceability UI** (inline edits with original/corrected history,
  spec §26) is modeled in the engine types but not yet exposed as an editable review
  grid; the review screen is currently read-only with full provenance on hover.
- **`previous_calendar_day` and combined/formula value sources** are supported by the
  engine and rule editor, but the formula editor is a plain expression box (power
  users), not a guided builder.
- **E2E tests (Playwright)** are configured but not authored/run here, as they need a
  seeded live Supabase instance.

## Security notes

- RLS enforces two-role, per-company isolation at the database. The service-role key
  is used only in server actions for admin user provisioning and never reaches the
  browser.
- HR users can read only their own company's active/inactive templates; they cannot
  see or edit rules.
