"use client";

import { useEffect, useMemo, useState } from "react";

import Panel from "@/components/ui/Panel";

const STORAGE_KEY = "world-monitor.operator-notes";

export default function OperatorNotesPanel() {
  const [notes, setNotes] = useState("");
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        setNotes(saved);
      }
    } catch {
      // Best-effort local-only notes.
    } finally {
      setHydrated(true);
    }
  }, []);

  useEffect(() => {
    if (!hydrated) {
      return;
    }
    try {
      localStorage.setItem(STORAGE_KEY, notes);
    } catch {
      // Ignore storage quota/browser mode errors.
    }
  }, [hydrated, notes]);

  const wordCount = useMemo(() => {
    if (!notes.trim()) {
      return 0;
    }
    return notes.trim().split(/\s+/).length;
  }, [notes]);

  return (
    <Panel
      title="Operator Notes"
      subtitle="Local-only scratchpad for shift handoff."
      rightSlot={
        <span className="text-[10px] font-mono text-muted uppercase tracking-wider">
          {wordCount} words
        </span>
      }
      className="h-full"
      contentClassName="px-4 pb-4"
    >
      <textarea
        value={notes}
        onChange={(event) => setNotes(event.target.value)}
        placeholder="Type operational notes, assumptions, and follow-ups..."
        className="min-h-[160px] w-full resize-y rounded-md border border-border bg-background/50 px-3 py-2 text-sm leading-relaxed text-foreground font-mono outline-none focus:border-accent"
      />
    </Panel>
  );
}
