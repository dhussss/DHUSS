import type { LucideIcon } from "lucide-react";

export function SummaryCard({
  label,
  value,
  note,
  icon: Icon
}: {
  label: string;
  value: string;
  note?: string;
  icon: LucideIcon;
}) {
  return (
    <article className="card flex min-h-32 flex-col justify-between">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-bold text-moss">{label}</p>
        <span className="grid size-10 place-items-center rounded-lg bg-mint/10 text-mint">
          <Icon size={20} aria-hidden="true" />
        </span>
      </div>
      <div>
        <p className="mt-4 text-3xl font-black tracking-normal text-ink">{value}</p>
        {note ? <p className="mt-1 text-sm text-moss">{note}</p> : null}
      </div>
    </article>
  );
}
