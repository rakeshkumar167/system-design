import type { SectionDepth } from "@/lib/types";
import { DepthBadge } from "@/components/tutorial/depth-badge";

/**
 * A labeled wrapper that marks a block of content as belonging to a depth
 * (typically "advanced"), so readers can choose how deep to go. The label is
 * textual, never color-only.
 */
export function DepthSection({
  depth,
  children,
}: {
  depth: SectionDepth;
  children: React.ReactNode;
}) {
  return (
    <div className="not-prose my-6 rounded-xl border border-dashed border-border bg-surface-2/50 p-5">
      <div className="mb-3">
        <DepthBadge depth={depth} />
      </div>
      <div className="space-y-3 text-sm leading-relaxed text-ink [&_strong]:font-semibold [&_strong]:text-ink">
        {children}
      </div>
    </div>
  );
}
