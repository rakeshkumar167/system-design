import {
  Info,
  MessageSquareQuote,
  AlertTriangle,
  Lightbulb,
  Mountain,
} from "lucide-react";

type Variant = "info" | "interview" | "warning" | "decision" | "advanced";

const config: Record<
  Variant,
  { icon: typeof Info; label: string; className: string; iconClass: string }
> = {
  info: {
    icon: Info,
    label: "Note",
    className: "border-accent/30 bg-accent-soft",
    iconClass: "text-accent",
  },
  interview: {
    icon: MessageSquareQuote,
    label: "In the interview",
    className: "border-interview/30 bg-interview/8",
    iconClass: "text-interview",
  },
  warning: {
    icon: AlertTriangle,
    label: "Watch out",
    className: "border-warning/40 bg-warning-soft",
    iconClass: "text-warning",
  },
  decision: {
    icon: Lightbulb,
    label: "Decision",
    className: "border-success/40 bg-success-soft",
    iconClass: "text-success",
  },
  advanced: {
    icon: Mountain,
    label: "Going deeper",
    className: "border-advanced/30 bg-advanced/8",
    iconClass: "text-advanced",
  },
};

export function Callout({
  variant = "info",
  title,
  children,
}: {
  variant?: Variant;
  title?: string;
  children: React.ReactNode;
}) {
  const { icon: Icon, label, className, iconClass } = config[variant];
  return (
    <aside className={`not-prose my-6 rounded-xl border p-5 ${className}`}>
      <div className="flex items-center gap-2">
        <Icon size={16} aria-hidden className={iconClass} />
        <p className={`text-xs font-semibold uppercase tracking-wide ${iconClass}`}>
          {title ?? label}
        </p>
      </div>
      <div className="mt-2 space-y-2 text-sm leading-relaxed text-ink [&_strong]:font-semibold [&_strong]:text-ink [&_code]:rounded [&_code]:bg-surface [&_code]:px-1 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-[0.85em]">
        {children}
      </div>
    </aside>
  );
}
