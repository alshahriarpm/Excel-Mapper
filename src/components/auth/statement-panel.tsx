const FACTS = ["Runs in your browser", "Admin-managed accounts", "Excel & CSV"];

export function StatementPanel() {
  return (
    <aside className="poster-ground relative hidden flex-col justify-between overflow-hidden px-11 py-12 text-white lg:flex xl:px-14 xl:py-14">
      <span aria-hidden className="poster-orb" />

      <div className="relative flex items-center gap-2.5">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/25 bg-white/10 text-sm font-bold">
          BM
        </span>
        <span className="text-sm font-semibold uppercase tracking-[0.14em]">Bulk Mapper</span>
      </div>

      <div className="relative flex flex-col gap-6">
        <span aria-hidden className="h-0.5 w-[30px] bg-white/70" />
        <p className="max-w-[20ch] text-balance text-3xl font-semibold leading-[1.22] tracking-tight lg:text-[2.25rem] xl:text-[2.625rem] 2xl:text-[3.25rem]">
          Every punch accounted for, every mapping traceable.
        </p>
        <div className="flex flex-wrap gap-x-6 gap-y-1.5 text-xs text-white/70">
          {FACTS.map((fact) => (
            <span key={fact}>{fact}</span>
          ))}
        </div>
      </div>
    </aside>
  );
}
