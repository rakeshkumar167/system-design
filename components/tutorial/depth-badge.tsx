import type { SectionDepth } from "@/lib/types";

const config: Record<SectionDepth, { label: string; className: string }> = {
  fundamentals: {
    label: "Fundamentals",
    className: "text-fundamentals border-fundamentals/30 bg-fundamentals/8",
  },
  "interview-ready": {
    label: "Interview-ready",
    className: "text-interview border-interview/30 bg-interview/8",
  },
  advanced: {
    label: "Advanced",
    className: "text-advanced border-advanced/30 bg-advanced/8",
  },
};

export function DepthBadge({ depth }: { depth: SectionDepth }) {
  const { label, className } = config[depth];
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${className}`}
    >
      {label}
    </span>
  );
}
