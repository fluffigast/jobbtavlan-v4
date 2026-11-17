import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Haptics from "expo-haptics";
import { State } from "./domain/types";
import { demoState } from "./domain/demo";
import { stamp } from "./domain/dates";

const KEY = "jobbtavlan-v4";

type Ctx = {
  s: State;
  ready: boolean;
  /* Varje ändring går genom edit(): muteras i en kopia, loggas, sparas. Som commit() i v3. */
  edit: (msg: string, fn: (d: State) => void) => void;
  reset: () => void;
  toast: string | null;
  clearToast: () => void;
};

const C = createContext<Ctx | null>(null);

export function Store({ children }: { children: React.ReactNode }) {
  const [s, setS] = useState<State>(() => demoState());
  const [ready, setReady] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    AsyncStorage.getItem(KEY)
      .then(v => { if (v) setS(JSON.parse(v)); })
      .catch(() => {})
      .finally(() => setReady(true));
  }, []);

  const edit = useCallback((msg: string, fn: (d: State) => void) => {
    setS(prev => {
      const d: State = JSON.parse(JSON.stringify(prev));
      fn(d);
      if (msg) {
        d.log = d.log || [];
        d.log.unshift({ ts: stamp(), text: msg });
        d.log.length = Math.min(d.log.length, 40);
      }
      d.rev = Date.now();
      AsyncStorage.setItem(KEY, JSON.stringify(d)).catch(() => {});
      return d;
    });
    if (msg) {
      setToast(msg);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
  }, []);

  const reset = useCallback(() => {
    const d = demoState();
    setS(d);
    AsyncStorage.setItem(KEY, JSON.stringify(d)).catch(() => {});
    setToast("Demodata återställd");
  }, []);

  const value = useMemo(
    () => ({ s, ready, edit, reset, toast, clearToast: () => setToast(null) }),
    [s, ready, edit, reset, toast]
  );
  return <C.Provider value={value}>{children}</C.Provider>;
}

export function useStore() {
  const v = useContext(C);
  if (!v) throw new Error("useStore utanför Store");
  return v;
}
