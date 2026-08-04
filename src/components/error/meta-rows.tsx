export type MetaRow = { label: string; value: React.ReactNode };

export function MetaRows({ rows }: { rows: MetaRow[] }) {
  if (rows.length === 0) return null;
  return (
    <dl className="max-w-md border-t border-foreground/15">
      {rows.map((row) => (
        <div
          key={row.label}
          className="grid grid-cols-[6rem_1fr] items-center gap-4 border-b border-foreground/15 py-3"
        >
          <dt className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
            {row.label}
          </dt>
          <dd className="font-mono text-xs tabular-nums">{row.value}</dd>
        </div>
      ))}
    </dl>
  );
}
