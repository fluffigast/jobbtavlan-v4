import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Haptics from "expo-haptics";
import { State } from "./domain/types";
import { demoState } from "./domain/demo";
import { stamp } from "./domain/dates";
import { Roll } from "./domain/roles";
import { hamta, loggaIn, loggaUt, Session, skriv } from "./sync";

const KEY = "jobbtavlan-v4";
const SESSION_KEY = "jobbtavlan-v4-session";
const UNDO_DJUP = 15;
const POLL_MS = 5000;

export type Toast = { text: string; undo: boolean };
export type Nat = "lokalt" | "synkar" | "synkat" | "offline";

type Ctx = {
  s: State;
  ready: boolean;
  /* Varje ändring går genom edit(): lokalt först, sedan till servern om vi är inloggade. */
  edit: (msg: string, fn: (d: State) => void) => void;
  undo: () => void;
  canUndo: boolean;
  reset: () => void;
  toast: Toast | null;
  clearToast: () => void;
  say: (text: string) => void;
  /* Delad plan */
  session: Session | null;
  roll: Roll;
  migId: string | null;
  nat: Nat;
  login: (bas: string, namn: string, pin: string) => Promise<{ ok: boolean; fel?: string }>;
  logout: () => void;
};

const C = createContext<Ctx | null>(null);
const kopia = (s: State): State => JSON.parse(JSON.stringify(s));

export function Store({ children }: { children: React.ReactNode }) {
  const [s, setS] = useState<State>(() => demoState());
  const [ready, setReady] = useState(false);
  const [toast, setToast] = useState<Toast | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [nat, setNat] = useState<Nat>("lokalt");
  const [canUndo, setCanUndo] = useState(false);

  const bakat = useRef<{ state: State; msg: string }[]>([]);
  const rev = useRef(0);
  const skriver = useRef(false);
  const sRef = useRef(s);
  sRef.current = s;

  useEffect(() => {
    (async () => {
      try {
        const rad = await AsyncStorage.getItem(SESSION_KEY);
        if (rad) {
          const sess: Session = JSON.parse(rad);
          const svar = await hamta(sess);
          if (svar) { setSession(sess); setS(svar.state); rev.current = svar.rev; setNat("synkat"); setReady(true); return; }
          await AsyncStorage.removeItem(SESSION_KEY);   // token dog, börja om lokalt
        }
        const lokal = await AsyncStorage.getItem(KEY);
        if (lokal) setS(JSON.parse(lokal));
      } catch { /* trasig lagring ska inte hindra start */ }
      setReady(true);
    })();
  }, []);

  const sparaLokalt = (d: State) => { AsyncStorage.setItem(KEY, JSON.stringify(d)).catch(() => {}); };

  /* Hämtar om planen med jämna mellanrum. Den som fyller en lucka i bilen ska
     synas hos den som står på taket, utan att någon trycker uppdatera. */
  useEffect(() => {
    if (!session) return;
    let levande = true;
    const id = setInterval(async () => {
      if (skriver.current) return;
      const svar = await hamta(session);
      if (!levande) return;
      if (!svar) { setNat("offline"); return; }
      setNat("synkat");
      if (svar.rev !== rev.current) { rev.current = svar.rev; setS(svar.state); }
    }, POLL_MS);
    return () => { levande = false; clearInterval(id); };
  }, [session]);

  /* Skickar upp en ändring. Krockar löses genom att göra om samma handling på
     det servern har, inte genom att skriva över någon annans arbete. */
  const skicka = useCallback(async (sess: Session, fn: (d: State) => void, msg: string) => {
    skriver.current = true;
    setNat("synkar");
    try {
      for (let forsok = 0; forsok < 2; forsok++) {
        const svar = await skriv(sess, rev.current, sRef.current);
        if (svar.typ === "ok") { rev.current = svar.rev; setNat("synkat"); return; }
        if (svar.typ === "krock") {
          const pa_nytt = kopia(svar.state);
          fn(pa_nytt);
          pa_nytt.log = [{ ts: stamp(), text: msg, by: sess.namn }, ...(svar.state.log || [])].slice(0, 40);
          rev.current = svar.rev;
          setS(pa_nytt);
          sRef.current = pa_nytt;
          continue;
        }
        if (svar.typ === "nekat") {
          const server = await hamta(sess);
          if (server) { rev.current = server.rev; setS(server.state); }
          setToast({ text: "Det där får bara arbetsledaren ändra.", undo: false });
          setNat("synkat");
          return;
        }
        if (svar.typ === "utloggad") { await lokalUtloggning(); setToast({ text: "Du loggades ut. Logga in igen.", undo: false }); return; }
        setNat("offline");
        setToast({ text: "Ingen kontakt med servern. Ändringen ligger kvar här.", undo: false });
        return;
      }
      setNat("offline");
    } finally {
      skriver.current = false;
    }
  }, []);

  const lokalUtloggning = async () => {
    setSession(null); setNat("lokalt"); rev.current = 0;
    await AsyncStorage.removeItem(SESSION_KEY).catch(() => {});
  };

  const edit = useCallback((msg: string, fn: (d: State) => void) => {
    let nasta: State | null = null;
    setS(prev => {
      bakat.current.push({ state: kopia(prev), msg });
      if (bakat.current.length > UNDO_DJUP) bakat.current.shift();
      const d = kopia(prev);
      fn(d);
      if (msg) {
        d.log = d.log || [];
        // Med inloggning vet vi vem. Utan den vore ett namn en gissning.
        d.log.unshift({ ts: stamp(), text: msg, ...(session ? { by: session.namn } : {}) });
        d.log.length = Math.min(d.log.length, 40);
      }
      d.rev = Date.now();
      sparaLokalt(d);
      nasta = d;
      sRef.current = d;
      return d;
    });
    setCanUndo(true);
    if (msg) {
      setToast({ text: msg, undo: true });
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
    if (session && nasta) skicka(session, fn, msg);
  }, [session, skicka]);

  const undo = useCallback(() => {
    const steg = bakat.current.pop();
    setCanUndo(bakat.current.length > 0);
    if (!steg) return;
    setS(steg.state);
    sRef.current = steg.state;
    sparaLokalt(steg.state);
    setToast({ text: "Ångrat: " + steg.msg.toLowerCase(), undo: false });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    if (session) skicka(session, () => {}, "Ångrat");
  }, [session, skicka]);

  const reset = useCallback(() => {
    const d = demoState();
    bakat.current.push({ state: kopia(sRef.current), msg: "Demodata återställd" });
    setS(d); sRef.current = d; sparaLokalt(d); setCanUndo(true);
    setToast({ text: "Demodata återställd", undo: true });
  }, []);

  const say = useCallback((text: string) => setToast({ text, undo: false }), []);

  const login = useCallback(async (bas: string, namn: string, pin: string) => {
    const svar = await loggaIn(bas, namn, pin);
    if (!svar.ok) return { ok: false, fel: svar.fel };
    setSession(svar.session);
    setS(svar.state); sRef.current = svar.state;
    rev.current = svar.rev;
    bakat.current = [];
    setCanUndo(false);
    setNat("synkat");
    await AsyncStorage.setItem(SESSION_KEY, JSON.stringify(svar.session)).catch(() => {});
    setToast({ text: "Inloggad som " + svar.session.namn, undo: false });
    return { ok: true };
  }, []);

  const logout = useCallback(() => {
    if (session) loggaUt(session);
    lokalUtloggning();
    const d = demoState();
    setS(d); sRef.current = d; sparaLokalt(d);
    setToast({ text: "Utloggad. Du ser demot igen.", undo: false });
  }, [session]);

  const value = useMemo(() => ({
    s, ready, edit, undo, canUndo, reset, toast, clearToast: () => setToast(null), say,
    session, roll: (session?.roll ?? "ledare") as Roll, migId: session?.personId ?? null, nat,
    login, logout,
  }), [s, ready, edit, undo, canUndo, reset, toast, say, session, nat, login, logout]);

  return <C.Provider value={value}>{children}</C.Provider>;
}

export function useStore() {
  const v = useContext(C);
  if (!v) throw new Error("useStore utanför Store");
  return v;
}

/* Kortform som skärmarna använder för att gömma det som ändå skulle nekas. */
export function useLedare() { return useStore().roll === "ledare"; }
