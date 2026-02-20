"use client";

import type { ReactNode } from "react";

type PanelProps = {
  title: string;
  subtitle?: string;
  rightSlot?: ReactNode;
  className?: string;
  contentClassName?: string;
  children: ReactNode;
};

export default function Panel({
  title,
  subtitle,
  rightSlot,
  className,
  contentClassName,
  children,
}: PanelProps) {
  return (
    <section className={["panel-frame", className ?? ""].join(" ").trim()}>
      <header className="panel-header">
        <div>
          <h2 className="panel-title">{title}</h2>
          {subtitle ? <p className="panel-subtitle">{subtitle}</p> : null}
        </div>
        {rightSlot ? <div className="panel-right">{rightSlot}</div> : null}
      </header>
      <div className={contentClassName}>{children}</div>
    </section>
  );
}
