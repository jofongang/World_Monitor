"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";

type ChipProps = {
  active?: boolean;
  children: ReactNode;
} & ButtonHTMLAttributes<HTMLButtonElement>;

export default function Chip({ active = false, children, className, ...props }: ChipProps) {
  return (
    <button
      type="button"
      className={[
        "chip",
        active ? "chip-active" : "",
        className ?? "",
      ]
        .join(" ")
        .trim()}
      {...props}
    >
      {children}
    </button>
  );
}
