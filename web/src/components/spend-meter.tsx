"use client";

import { usdToNumber } from "@/lib/run";

/**
 * How much of the authorised budget the agent has committed.
 *
 * State is carried by the numbers and the label, never by colour alone, so the
 * meter still reads correctly for a colour-blind operator or in monochrome print
 * (WCAG 2.2 AA, per `PRODUCT.md`).
 */
export function SpendMeter({
  limit,
  spent,
  remaining
}: {
  limit: string;
  spent: string;
  remaining: string;
}) {
  const limitValue = usdToNumber(limit);
  const spentValue = usdToNumber(spent);
  const percent = limitValue > 0 ? Math.min(100, (spentValue / limitValue) * 100) : 0;

  return (
    <div>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="text-xs font-semibold uppercase tracking-[0.12em] text-muted">
          Agent spend
        </span>
        <span className="font-mono text-sm">
          <span className="font-semibold">{spent}</span>
          <span className="text-muted"> of {limit}</span>
        </span>
      </div>

      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={limitValue}
        aria-valuenow={spentValue}
        aria-valuetext={`${spent} of ${limit} spent, ${remaining} remaining`}
        className="mt-2 h-2 w-full overflow-hidden rounded-full bg-line"
      >
        <div
          className="h-full rounded-full bg-violet transition-[width] duration-500"
          style={{ width: `${percent}%` }}
        />
      </div>

      <p className="mt-2 font-mono text-xs text-muted">{remaining} remaining</p>
    </div>
  );
}
