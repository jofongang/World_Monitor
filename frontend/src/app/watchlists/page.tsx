"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

import {
  fetchWatchlist,
  saveWatchlist,
  type Watchlist,
} from "@/lib/api";

const TOPIC_OPTIONS = [
  "Politics",
  "Geopolitics",
  "Economy",
  "Markets",
  "Conflict",
  "Energy",
  "Infrastructure",
] as const;

const KNOWN_COUNTRIES = [
  "Australia",
  "Brazil",
  "Canada",
  "China",
  "Democratic Republic of the Congo",
  "Egypt",
  "Ethiopia",
  "France",
  "Germany",
  "Ghana",
  "India",
  "Iran",
  "Israel",
  "Japan",
  "Kenya",
  "Nigeria",
  "Russia",
  "Saudi Arabia",
  "South Africa",
  "Turkey",
  "Ukraine",
  "United Arab Emirates",
  "United Kingdom",
  "United States",
] as const;

const EMPTY_WATCHLIST: Watchlist = {
  countries: [],
  topics: [],
  keywords: [],
};

export default function WatchlistsPage() {
  const [watchlist, setWatchlist] = useState<Watchlist>(EMPTY_WATCHLIST);
  const [keywordInput, setKeywordInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    const load = async () => {
      setLoading(true);
      try {
        setError(null);
        const payload = await fetchWatchlist();
        if (!active) {
          return;
        }
        setWatchlist(payload);
      } catch (err) {
        if (!active) {
          return;
        }
        setError(err instanceof Error ? err.message : "Unexpected error");
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    void load();
    return () => {
      active = false;
    };
  }, []);

  const countryOptions = useMemo(() => {
    const merged = new Set<string>([...KNOWN_COUNTRIES, ...watchlist.countries]);
    return Array.from(merged).sort((a, b) => a.localeCompare(b));
  }, [watchlist.countries]);

  const onSave = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setStatusMessage(null);

    try {
      setError(null);
      const payload = await saveWatchlist(watchlist);
      setWatchlist(payload);
      setStatusMessage("Watchlist saved.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unexpected error");
    } finally {
      setSaving(false);
    }
  };

  const onCountryChange = (selected: string[]) => {
    setWatchlist((prev) => ({
      ...prev,
      countries: selected,
    }));
  };

  const onTopicToggle = (topic: string, enabled: boolean) => {
    setWatchlist((prev) => {
      if (enabled) {
        if (prev.topics.includes(topic)) {
          return prev;
        }
        return {
          ...prev,
          topics: [...prev.topics, topic],
        };
      }

      return {
        ...prev,
        topics: prev.topics.filter((value) => value !== topic),
      };
    });
  };

  const addKeyword = () => {
    const value = keywordInput.trim().toLowerCase();
    if (!value) {
      return;
    }

    setWatchlist((prev) => {
      if (prev.keywords.includes(value)) {
        return prev;
      }
      return {
        ...prev,
        keywords: [...prev.keywords, value],
      };
    });
    setKeywordInput("");
  };

  const removeKeyword = (keyword: string) => {
    setWatchlist((prev) => ({
      ...prev,
      keywords: prev.keywords.filter((item) => item !== keyword),
    }));
  };

  return (
    <div className="space-y-4">
      <div className="glow-border rounded-lg bg-panel p-4">
        <h2 className="text-accent font-mono text-lg font-bold tracking-widest uppercase">
          Watchlists
        </h2>
        <p className="text-muted text-xs font-mono mt-1">
          Define countries, topics, and keywords that drive alerts.
        </p>
      </div>

      <form onSubmit={onSave} className="glow-border rounded-lg bg-panel p-4 space-y-5">
        {error ? (
          <div className="rounded border border-negative/40 bg-negative/10 p-2 text-xs font-mono text-negative">
            {error}
          </div>
        ) : null}
        {statusMessage ? (
          <div className="rounded border border-positive/30 bg-positive/10 p-2 text-xs font-mono text-positive">
            {statusMessage}
          </div>
        ) : null}

        <section>
          <h3 className="text-accent font-mono text-xs font-bold uppercase tracking-widest mb-2">
            Countries
          </h3>
          <p className="text-muted text-[11px] font-mono mb-2">
            Multi-select countries to monitor.
          </p>
          <select
            multiple
            size={10}
            value={watchlist.countries}
            onChange={(event) => {
              const selected = Array.from(event.target.selectedOptions).map((option) => option.value);
              onCountryChange(selected);
            }}
            disabled={loading}
            className="w-full bg-background border border-border rounded px-2 py-2 text-sm text-foreground font-mono focus:border-accent focus:outline-none"
          >
            {countryOptions.map((country) => (
              <option key={country} value={country}>
                {country}
              </option>
            ))}
          </select>
        </section>

        <section>
          <h3 className="text-accent font-mono text-xs font-bold uppercase tracking-widest mb-2">
            Topics
          </h3>
          <p className="text-muted text-[11px] font-mono mb-2">
            Select one or more signal categories.
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {TOPIC_OPTIONS.map((topic) => {
              const checked = watchlist.topics.includes(topic);
              return (
                <label
                  key={topic}
                  className="flex items-center gap-2 rounded border border-border bg-background/40 px-2 py-1.5"
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={(event) => onTopicToggle(topic, event.target.checked)}
                    className="accent-[#2D7BFF]"
                  />
                  <span className="text-xs font-mono text-foreground">{topic}</span>
                </label>
              );
            })}
          </div>
        </section>

        <section>
          <h3 className="text-accent font-mono text-xs font-bold uppercase tracking-widest mb-2">
            Keywords
          </h3>
          <p className="text-muted text-[11px] font-mono mb-2">
            Add free-text triggers such as sanctions, election, pipeline, or port.
          </p>

          <div className="flex gap-2">
            <input
              value={keywordInput}
              onChange={(event) => setKeywordInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  addKeyword();
                }
              }}
              placeholder="Type keyword and press Enter"
              className="flex-1 bg-background border border-border rounded px-2 py-1.5 text-sm text-foreground font-mono focus:border-accent focus:outline-none"
            />
            <button
              type="button"
              onClick={addKeyword}
              className="px-3 py-1.5 rounded border border-accent/40 text-accent text-xs font-mono uppercase tracking-wider hover:bg-accent/10"
            >
              Add
            </button>
          </div>

          <div className="mt-2 flex flex-wrap gap-2">
            {watchlist.keywords.map((keyword) => (
              <button
                key={keyword}
                type="button"
                onClick={() => removeKeyword(keyword)}
                className="inline-flex items-center gap-1 rounded-full border border-border px-2 py-0.5 text-[11px] font-mono text-muted hover:text-foreground hover:border-accent/40"
                title="Remove keyword"
              >
                <span>{keyword}</span>
                <span aria-hidden>×</span>
              </button>
            ))}
            {watchlist.keywords.length === 0 ? (
              <span className="text-xs font-mono text-muted">No keywords selected.</span>
            ) : null}
          </div>
        </section>

        <div className="pt-2 border-t border-border flex items-center justify-between">
          <span className="text-[11px] font-mono text-muted">
            Watchlist drives /alerts and the daily brief.
          </span>
          <button
            type="submit"
            disabled={saving || loading}
            className="px-4 py-1.5 rounded border border-accent/40 text-accent text-xs font-mono uppercase tracking-wider hover:bg-accent/10 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {saving ? "Saving..." : "Save Watchlist"}
          </button>
        </div>
      </form>
    </div>
  );
}
