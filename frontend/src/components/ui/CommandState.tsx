"use client";

import {
  createContext,
  useContext,
  useMemo,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from "react";

export type OpsWindow = "1h" | "6h" | "24h" | "7d" | "30d";

type CommandStateValue = {
  searchQuery: string;
  setSearchQuery: Dispatch<SetStateAction<string>>;
  opsWindow: OpsWindow;
  setOpsWindow: Dispatch<SetStateAction<OpsWindow>>;
  watchlistOnly: boolean;
  setWatchlistOnly: Dispatch<SetStateAction<boolean>>;
  highSeverityOnly: boolean;
  setHighSeverityOnly: Dispatch<SetStateAction<boolean>>;
  severityThreshold: number;
  setSeverityThreshold: Dispatch<SetStateAction<number>>;
  selectedEventId: string | null;
  setSelectedEventId: Dispatch<SetStateAction<string | null>>;
  commandPaletteOpen: boolean;
  setCommandPaletteOpen: Dispatch<SetStateAction<boolean>>;
};

const CommandStateContext = createContext<CommandStateValue | null>(null);

export function CommandStateProvider({ children }: { children: ReactNode }) {
  const [searchQuery, setSearchQuery] = useState("");
  const [opsWindow, setOpsWindow] = useState<OpsWindow>("24h");
  const [watchlistOnly, setWatchlistOnly] = useState(false);
  const [highSeverityOnly, setHighSeverityOnly] = useState(false);
  const [severityThreshold, setSeverityThreshold] = useState(70);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);

  const value = useMemo(
    () => ({
      searchQuery,
      setSearchQuery,
      opsWindow,
      setOpsWindow,
      watchlistOnly,
      setWatchlistOnly,
      highSeverityOnly,
      setHighSeverityOnly,
      severityThreshold,
      setSeverityThreshold,
      selectedEventId,
      setSelectedEventId,
      commandPaletteOpen,
      setCommandPaletteOpen,
    }),
    [
      searchQuery,
      opsWindow,
      watchlistOnly,
      highSeverityOnly,
      severityThreshold,
      selectedEventId,
      commandPaletteOpen,
    ]
  );

  return (
    <CommandStateContext.Provider value={value}>
      {children}
    </CommandStateContext.Provider>
  );
}

export function useCommandState(): CommandStateValue {
  const context = useContext(CommandStateContext);
  if (!context) {
    throw new Error("useCommandState must be used inside CommandStateProvider");
  }
  return context;
}
