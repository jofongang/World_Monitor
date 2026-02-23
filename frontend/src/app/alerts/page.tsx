"use client";

import { FormEvent, useEffect, useState } from "react";

import Panel from "@/components/ui/Panel";
import {
  ackAlert,
  fetchAlertInbox,
  fetchAlertRules,
  resolveAlert,
  saveAlertRule,
  type AlertInboxItem,
  type AlertRule,
} from "@/lib/api";

const CATEGORY_OPTIONS = [
  "conflict",
  "diplomacy",
  "sanctions",
  "cyber",
  "disaster",
  "markets",
  "other",
] as const;

type RuleDraft = {
  name: string;
  severity_threshold: number;
  categories: string;
  keywords: string;
  enabled: boolean;
};

export default function AlertsPage() {
  const [rules, setRules] = useState<AlertRule[]>([]);
  const [inbox, setInbox] = useState<AlertInboxItem[]>([]);
  const [status, setStatus] = useState<"new" | "acked" | "resolved" | "all">("new");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<RuleDraft>({
    name: "Custom Rule",
    severity_threshold: 70,
    categories: "conflict,disaster",
    keywords: "attack,earthquake",
    enabled: true,
  });

  const load = async () => {
    setLoading(true);
    try {
      setError(null);
      const [rulesPayload, inboxPayload] = await Promise.all([
        fetchAlertRules(),
        fetchAlertInbox({ status: status === "all" ? undefined : status, limit: 300 }),
      ]);
      setRules(rulesPayload.items);
      setInbox(inboxPayload.items);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load alerts");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  const onSaveRule = async (event: FormEvent) => {
    event.preventDefault();
    const categories = draft.categories
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean)
      .filter((item) => CATEGORY_OPTIONS.includes(item as (typeof CATEGORY_OPTIONS)[number]));
    const keywords = draft.keywords
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);

    await saveAlertRule({
      name: draft.name,
      enabled: draft.enabled,
      severity_threshold: draft.severity_threshold,
      categories,
      keywords,
      countries: [],
      regions: [],
      spike_detection: false,
      action_in_app: true,
    });
    await load();
  };

  const onAck = async (alertEventId: string) => {
    await ackAlert(alertEventId);
    await load();
  };

  const onResolve = async (alertEventId: string) => {
    await resolveAlert(alertEventId);
    await load();
  };

  return (
    <div className="space-y-4">
      <Panel
        title="Alert Inbox"
        subtitle="Acknowledge and resolve rule-triggered events"
        contentClassName="px-4 pb-4"
      >
        <div className="flex flex-wrap items-center gap-1.5">
          {(["new", "acked", "resolved", "all"] as const).map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setStatus(value)}
              className={`rounded-full border px-2.5 py-1 text-[10px] font-mono uppercase tracking-wider ${
                status === value
                  ? "border-accent/45 bg-accent/15 text-accent"
                  : "border-border text-muted hover:border-accent/35 hover:text-foreground"
              }`}
            >
              {value}
            </button>
          ))}
        </div>
      </Panel>

      {error ? (
        <Panel title="Error" subtitle="Alert engine warning" contentClassName="px-4 pb-4">
          <p className="text-sm font-mono text-danger">{error}</p>
        </Panel>
      ) : null}

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <Panel title="Inbox Items" subtitle={`${inbox.length} items`} contentClassName="px-4 pb-4">
            {loading ? (
              <p className="text-xs font-mono text-muted">Loading alert inbox...</p>
            ) : inbox.length === 0 ? (
              <p className="text-xs font-mono text-muted">No alerts in this state.</p>
            ) : (
              <div className="terminal-scroll max-h-[640px] space-y-2 overflow-y-auto pr-1">
                {inbox.map((item) => (
                  <article
                    key={item.alert_event_id}
                    className="rounded border border-border bg-background/45 p-2.5"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <a
                        href={item.source_url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-sm leading-snug text-foreground hover:text-accent"
                      >
                        {item.title}
                      </a>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-mono uppercase tracking-wide ${
                          item.status === "new"
                            ? "border border-warning/45 bg-warning/20 text-warning"
                            : item.status === "acked"
                            ? "border border-accent/45 bg-accent/20 text-accent"
                            : "border border-positive/45 bg-positive/20 text-positive"
                        }`}
                      >
                        {item.status}
                      </span>
                    </div>
                    <div className="mt-1 text-[10px] font-mono text-muted">
                      {item.rule_name} | {item.country} | {item.category} | sev {item.severity}
                    </div>
                    <div className="mt-2 flex items-center gap-2">
                      {item.status === "new" ? (
                        <button
                          type="button"
                          onClick={() => void onAck(item.alert_event_id)}
                          className="rounded border border-accent/40 px-2 py-1 text-[10px] font-mono uppercase tracking-wider text-accent hover:bg-accent/10"
                        >
                          Ack
                        </button>
                      ) : null}
                      {item.status !== "resolved" ? (
                        <button
                          type="button"
                          onClick={() => void onResolve(item.alert_event_id)}
                          className="rounded border border-positive/40 px-2 py-1 text-[10px] font-mono uppercase tracking-wider text-positive hover:bg-positive/10"
                        >
                          Resolve
                        </button>
                      ) : null}
                    </div>
                  </article>
                ))}
              </div>
            )}
          </Panel>
        </div>

        <div>
          <Panel title="Rule Builder" subtitle="Create deterministic alert rules" contentClassName="px-4 pb-4">
            <form onSubmit={onSaveRule} className="space-y-2">
              <label className="block text-[10px] font-mono uppercase tracking-wider text-muted">
                Name
                <input
                  value={draft.name}
                  onChange={(event) =>
                    setDraft((value) => ({ ...value, name: event.target.value }))
                  }
                  className="mt-1 w-full rounded border border-border bg-background/65 px-2 py-1.5 text-sm text-foreground outline-none focus:border-accent"
                />
              </label>
              <label className="block text-[10px] font-mono uppercase tracking-wider text-muted">
                Severity Threshold
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={draft.severity_threshold}
                  onChange={(event) =>
                    setDraft((value) => ({
                      ...value,
                      severity_threshold: Number(event.target.value),
                    }))
                  }
                  className="mt-1 w-full rounded border border-border bg-background/65 px-2 py-1.5 text-sm text-foreground outline-none focus:border-accent"
                />
              </label>
              <label className="block text-[10px] font-mono uppercase tracking-wider text-muted">
                Categories (comma)
                <input
                  value={draft.categories}
                  onChange={(event) =>
                    setDraft((value) => ({ ...value, categories: event.target.value }))
                  }
                  className="mt-1 w-full rounded border border-border bg-background/65 px-2 py-1.5 text-sm text-foreground outline-none focus:border-accent"
                />
              </label>
              <label className="block text-[10px] font-mono uppercase tracking-wider text-muted">
                Keywords (comma)
                <input
                  value={draft.keywords}
                  onChange={(event) =>
                    setDraft((value) => ({ ...value, keywords: event.target.value }))
                  }
                  className="mt-1 w-full rounded border border-border bg-background/65 px-2 py-1.5 text-sm text-foreground outline-none focus:border-accent"
                />
              </label>

              <label className="inline-flex items-center gap-2 text-[10px] font-mono uppercase tracking-wider text-muted">
                <input
                  type="checkbox"
                  checked={draft.enabled}
                  onChange={(event) =>
                    setDraft((value) => ({ ...value, enabled: event.target.checked }))
                  }
                  className="accent-[#2D7BFF]"
                />
                Enabled
              </label>

              <button
                type="submit"
                className="w-full rounded border border-accent/40 px-2.5 py-1.5 text-[10px] font-mono uppercase tracking-wider text-accent hover:bg-accent/10"
              >
                Save Rule
              </button>
            </form>

            <div className="mt-4 border-t border-border pt-3">
              <p className="mb-2 text-[10px] font-mono uppercase tracking-wider text-muted">
                Existing Rules
              </p>
              <div className="space-y-1">
                {rules.map((rule) => (
                  <div
                    key={rule.id}
                    className="rounded border border-border bg-background/45 px-2 py-1 text-[11px] font-mono text-muted"
                  >
                    {rule.name} (sev {rule.severity_threshold})
                  </div>
                ))}
              </div>
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}
