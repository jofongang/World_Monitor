"use client";

import {
  createContext,
  useContext,
  useMemo,
  useState,
  type ReactNode,
  type Dispatch,
  type SetStateAction,
} from "react";

type CommandStateValue = {
  searchQuery: string;
  setSearchQuery: Dispatch<SetStateAction<string>>;
};

const CommandStateContext = createContext<CommandStateValue | null>(null);

export function CommandStateProvider({ children }: { children: ReactNode }) {
  const [searchQuery, setSearchQuery] = useState("");

  const value = useMemo(
    () => ({
      searchQuery,
      setSearchQuery,
    }),
    [searchQuery]
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
