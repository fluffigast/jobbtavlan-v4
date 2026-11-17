import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Haptics from "expo-haptics";
import { State } from "./domain/types";
import { demoState } from "./domain/demo";
import { stamp } from "./domain/dates";

const KEY = "jobbtavlan-v4";
const UNDO_DJUP = 15;

export type Toast = { text: string; undo: boolean };

type Ctx = {
  s: State;
  ready: boolean;
  /* Varje ändring går genom edit(): muteras i en kopia, loggas, sparas, går att ångra. */
  edit: (msg: string, fn: (d: State) => void) => void;
  undo: () => void;
  canUndo: boolean;
  reset: () => void;
  toast: Toast | null;
  clearToast: () => void;
  say: (text: string) => void;
};

const C = createContext<Ctx | null>(null);

const kopia = (s: State): State => JSON.parse(JSON.stringify(s));

export function Store({ children }: { children: React.ReactNode }) {
  const [s, setS] = useState<State>(() => demoState());
  const [ready, setReady] = useState(false);
  const [toast, setToast] = useState<Toast | null>(null);
  /* Ångra-högen ligger i en ref: den ska inte rita om något när den växer. */
  const bakat = useRef<{ state: State; msg: string }[]>([]);
  const [canUndo, setCanUndo] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(KEY)
      .then(v => { if (v) setS(JSON.parse(v)); })
      .catch(() => {})
      .finally(() => setReady(true));
  }, []);

  const spara = (d: State) => { AsyncStorage.setItem(KEY, JSON.stringify(d)).catch(() => {}); };

  const edit = useCallback((msg: string, fn: (d: State) => void) => {
    setS(prev => {
      bakat.current.push({ state: kopia(prev), msg });
      if (bakat.current.length > UNDO_DJUP) bakat.current.shift();
      const d = kopia(prev);
      fn(d);
      if (msg) {
        d.log = d.log || [];
        d.log.unshift({ ts: stamp(), text: msg });
        d.log.length = Math.min(d.log.length, 40);
      }
      d.rev = Date.now();
      spara(d);
      return d;
    });
    setCanUndo(true);
    if (msg) {
      setToast({ text: msg, undo: true });
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
  }, []);

  const undo = useCallback(() => {
    const steg = bakat.current.pop();
    setCanUndo(bakat.current.length > 0);
    if (!steg) return;
    setS(steg.state);
    spara(steg.state);
    setToast({ text: "Ångrat: " + steg.msg.toLowerCase(), undo: false });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
  }, []);

  const reset = useCallback(() => {
    setS(prev => {
      bakat.current.push({ state: kopia(prev), msg: "Demodata återställd" });
      const d = demoState();
      spara(d);
      return d;
    });
    setCanUndo(true);
    setToast({ text: "Demodata återställd", undo: true });
  }, []);

  /* För meddelanden som inte ändrar något, till exempel när inget gick att göra. */
  const say = useCallback((text: string) => setToast({ text, undo: false }), []);

  const value = useMemo(
    () => ({ s, ready, edit, undo, canUndo, reset, toast, clearToast: () => setToast(null), say }),
    [s, ready, edit, undo, canUndo, reset, toast, say]
  );
  return <C.Provider value={value}>{children}</C.Provider>;
}

export function useStore() {
  const v = useContext(C);
  if (!v) throw new Error("useStore utanför Store");
  return v;
}
