/**
 * One field inside a line-item row (invoice / quotation items).
 *
 * Line-item grids show their column headers only from `sm:` up, so each cell
 * carries its own label below that breakpoint — without it the numeric inputs
 * render as unlabelled boxes on a phone and there is no way to tell Qty from
 * Rate from GST%.
 */
export function LineCell({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <span className="block text-xs font-medium text-muted-foreground sm:hidden">{label}</span>
      {children}
    </div>
  );
}

/** Column headers for a line-item grid; hidden on mobile where LineCell labels take over. */
export function LineHeader({ columns, className }: { columns: string[]; className: string }) {
  return (
    <div
      className={`hidden gap-2 px-1 text-xs font-medium text-muted-foreground sm:grid ${className}`}
    >
      {columns.map((c) => (
        <span key={c}>{c}</span>
      ))}
      <span />
    </div>
  );
}
