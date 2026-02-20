"use client";

type BadgeSeverity = "high" | "medium" | "low";

type BadgeProps = {
  severity: BadgeSeverity;
  label?: string;
};

const SEVERITY_CLASS: Record<BadgeSeverity, string> = {
  high: "bg-danger/20 text-danger border border-danger/45",
  medium: "bg-warning/20 text-warning border border-warning/45",
  low: "bg-accent/20 text-accent border border-accent/45",
};

export default function Badge({ severity, label }: BadgeProps) {
  const text = label ?? severity.toUpperCase();
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-mono tracking-wide ${SEVERITY_CLASS[severity]}`}>
      {text}
    </span>
  );
}
