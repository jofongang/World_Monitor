"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { useCommandState } from "@/components/ui/CommandState";

const QUICK_COMMANDS = [
  "go nigeria",
  "filter severity > 70",
  "toggle disasters",
  "open event <id>",
  "create alert",
  "show last 6h",
  "status",
] as const;

export default function CommandPalette() {
  const router = useRouter();
  const {
    commandPaletteOpen,
    setCommandPaletteOpen,
    setSearchQuery,
    setOpsWindow,
    setSeverityThreshold,
    setHighSeverityOnly,
    setSelectedEventId,
  } = useCommandState();

  const [input, setInput] = useState("");
  const [lastResult, setLastResult] = useState<string | null>(null);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setCommandPaletteOpen((value) => !value);
      }
      if (event.key === "Escape") {
        setCommandPaletteOpen(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [setCommandPaletteOpen]);

  const placeholder = useMemo(
    () => "Type command (Ctrl+K) ... e.g. show last 6h",
    []
  );

  const execute = (raw: string) => {
    const command = raw.trim().toLowerCase();
    if (!command) {
      setLastResult("No command entered.");
      return;
    }

    if (command.startsWith("go ")) {
      const target = raw.slice(3).trim();
      if (target) {
        const normalizedTarget = target.toLowerCase();
        if (
          normalizedTarget === "prediction markets" ||
          normalizedTarget === "predictions" ||
          normalizedTarget === "polymarket" ||
          normalizedTarget === "kalshi"
        ) {
          router.push("/prediction-markets");
          setLastResult("Opening prediction markets.");
          return;
        }
        setSearchQuery(target);
        router.push("/dashboard");
        setLastResult(`Focused on ${target}.`);
      }
      return;
    }

    if (command.startsWith("filter severity >")) {
      const valueRaw = command.replace("filter severity >", "").trim();
      const value = Number(valueRaw);
      if (!Number.isNaN(value)) {
        setSeverityThreshold(Math.max(0, Math.min(100, value)));
        setHighSeverityOnly(true);
        setLastResult(`Severity threshold set to ${Math.round(value)}.`);
      } else {
        setLastResult("Invalid severity value.");
      }
      return;
    }

    if (command === "toggle disasters") {
      setSearchQuery("disaster");
      router.push("/dashboard");
      setLastResult("Applied disaster focus.");
      return;
    }

    if (command.startsWith("open event ")) {
      const eventId = raw.slice("open event ".length).trim();
      if (eventId) {
        setSelectedEventId(eventId);
        router.push("/dashboard");
        setLastResult(`Selected event ${eventId}.`);
      } else {
        setLastResult("Missing event id.");
      }
      return;
    }

    if (command === "create alert") {
      router.push("/alerts");
      setLastResult("Opening alert inbox.");
      return;
    }

    if (command === "status") {
      router.push("/health");
      setLastResult("Opening health dashboard.");
      return;
    }

    if (command.startsWith("show last ")) {
      const value = command.replace("show last ", "").trim();
      if (value === "1h" || value === "6h" || value === "24h" || value === "7d" || value === "30d") {
        setOpsWindow(value);
        setLastResult(`Time window set to ${value}.`);
      } else {
        setLastResult("Unsupported window. Use 1h/6h/24h/7d/30d.");
      }
      return;
    }

    setLastResult("Unknown command.");
  };

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    execute(input);
  };

  if (!commandPaletteOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-[1px]">
      <div className="mx-auto mt-20 w-[92%] max-w-2xl rounded-lg border border-border bg-panel shadow-[0_16px_40px_rgba(1,4,10,0.7)]">
        <header className="border-b border-border px-4 py-3">
          <p className="text-[11px] font-mono uppercase tracking-[0.14em] text-accent">
            Command Palette
          </p>
        </header>

        <form onSubmit={onSubmit} className="space-y-3 px-4 py-3">
          <input
            autoFocus
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder={placeholder}
            className="w-full rounded border border-border bg-background/70 px-3 py-2 text-sm font-mono text-foreground outline-none focus:border-accent"
          />
          <div className="flex flex-wrap gap-1.5">
            {QUICK_COMMANDS.map((command) => (
              <button
                key={command}
                type="button"
                onClick={() => execute(command)}
                className="rounded-full border border-border px-2.5 py-1 text-[10px] font-mono uppercase tracking-wider text-muted hover:border-accent/40 hover:text-foreground"
              >
                {command}
              </button>
            ))}
          </div>
          {lastResult ? (
            <p className="text-[11px] font-mono text-muted">{lastResult}</p>
          ) : null}
        </form>
      </div>
    </div>
  );
}

