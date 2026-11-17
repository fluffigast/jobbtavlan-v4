import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Haptics from "expo-haptics";
import { State } from "./domain/types";
import { demoState } from "./domain/demo";
import { stamp } from "./domain/dates";
import { Roll } from "./domain/roles";
import { beskriv, invers, Op, tillampa } from "./domain/ops";
import { hamta, loggaIn, loggaUt, Session, skicka } from "./sync";

const KEY = "jobbtavlan-v4";
const SESSION_KEY = "jobbtavlan-v4-session";
const UNDO_DJUP = 15;
const POLL_MS = 5000;

export type Toast = { text: string; undo: boolean };
export type Nat = "lokalt" | "synkar" | "synkat" | "offline";

type Ctx = {
  s: State;
  ready: boolean;
  /* Allt som ändrar något går genom kor(). Samma handling lokalt som mot
     servern, så demot beter sig som en firma med server. */
  kor: (op: Op) => void;
  undo: () => void;
  canUndo: boolean;
  reset: () => void;
  toast: Toast | null;
  clearToast: () => void;
  say: (text: string) => void;
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

  const angra = useRef<Op[]>([]);
  const rev = useRef(0);
  const skriver = useRef(false);
  const sRef = useRef(s);
  sRef.current = s;
  const sessRef = useRef<Session | null>(null);
  sessRef.current = session;

  useEffect(() => {
    (async () => {
      try {
        const rad = await AsyncStorage.getItem(SESSION_KEY);
        if (rad) {
          const sess: Session = JSON.parse(rad);
          const svar = await hamta(sess);
          if (svar) { setSession(sess); setS(svar.state); rev.current = svar.rev; setNat("synkat"); setReady(true); return; }
          await AsyncStorage.removeItem(SESSION_KEY);
        }
        const lokal = await AsyncStorage.getItem(KEY);
        if (lokal) setS(JSON.parse(lokal));
      } catch { /* trasig lagring ska inte hindra start */ }
      setReady(true);
    })();
  }, []);

  const sparaLokalt = (d: State) => { AsyncStorage.setItem(KEY, JSON.stringify(d)).catch(() => {}); };

  useEffect(() => {
    if (!session) return;
    let levande = true;
    const id = setInterval(async () => {
      if (skriver.current) return;
      const svar = await hamta(session);
      if (!levande) return;
      if (!svar) { setNat("offline"); return; }
      setNat("synkat");
      if (svar.rev !== rev.current) { rev.current = svar.rev; setS(svar.state); sRef.current = svar.state; }
    }, POLL_MS);
    return () => { levande = false; clearInterval(id); };
  }, [session]);

  /* Lokalt först, så skärmen svarar direkt, och sedan upp till servern.
     Krock löses genom att göra om handlingen på det servern har. */
  const upp = useCallback(async (op: Op) => {
    const sess = sessRef.current;
    if (!sess) return;
    skriver.current = true;
    setNat("synkar");
    try {
      for (let forsok = 0; forsok < 2; forsok++) {
        const svar = await skicka(sess, rev.current, op);
        if (svar.typ === "ok") {
          rev.current = svar.rev; setS(svar.state); sRef.current = svar.state; setNat("synkat"); return;
        }
        if (svar.typ === "krock") {
          rev.current = svar.rev;
          const pa_nytt = kopia(svar.state);
          tillampa(pa_nytt, op, { nu: stamp(), migId: sess.personId, namn: sess.namn });
          setS(pa_nytt); sRef.current = pa_nytt;
          continue;
        }
        if (svar.typ === "nekat" || svar.typ === "obegriplig") {
          const server = await hamta(sess);
          if (server) { rev.current = server.rev; setS(server.state); sRef.current = server.state; }
          setToast({ text: svar.typ === "nekat" ? "Det där får bara arbetsledaren göra." : "Servern begrep inte handlingen.", undo: false });
          setNat("synkat");
          return;
        }
        if (svar.typ === "utloggad") {
          setSession(null); setNat("lokalt"); rev.current = 0;
          AsyncStorage.removeItem(SESSION_KEY).catch(() => {});
          setToast({ text: "Du loggades ut. Logga in igen.", undo: false });
          return;
        }
        setNat("offline");
        setToast({ text: "Ingen kontakt med servern. Ändringen ligger kvar här.", undo: false });
        return;
      }
      setNat("offline");
    } finally {
      skriver.current = false;
    }
  }, []);

  const utfor = useCallback((op: Op, sparaAngra: boolean, prefix = "") => {
    const fore = sRef.current;
    const text = beskriv(fore, op);
    const inv = sparaAngra ? invers(fore, op) : null;
    const sess = sessRef.current;

    const d = kopia(fore);
    tillampa(d, op, { nu: stamp(), migId: sess?.personId ?? null, namn: sess?.namn ?? null });
    d.log = [{ ts: stamp(), text, ...(sess ? { by: sess.namn } : {}) }, ...(d.log || [])].slice(0, 40);
    d.rev = Date.now();
    setS(d); sRef.current = d; sparaLokalt(d);

    if (inv) { angra.current.push(inv); if (angra.current.length > UNDO_DJUP) angra.current.shift(); setCanUndo(true); }
    setToast({ text: prefix + (prefix ? text.charAt(0).toLowerCase() + text.slice(1) : text), undo: !!inv });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    if (sess) upp(op);
  }, [upp]);

  const kor = useCallback((op: Op) => utfor(op, true), [utfor]);

  const undo = useCallback(() => {
    const inv = angra.current.pop();
    setCanUndo(angra.current.length > 0);
    if (!inv) return;
    utfor(inv, false, "Ångrat: ");
  }, [utfor]);

  const reset = useCallback(() => {
    const d = demoState();
    angra.current = []; setCanUndo(false);
    setS(d); sRef.current = d; sparaLokalt(d);
    setToast({ text: "Demodata återställd", undo: false });
  }, []);

  const say = useCallback((text: string) => setToast({ text, undo: false }), []);

  const login = useCallback(async (bas: string, namn: string, pin: string) => {
    const svar = await loggaIn(bas, namn, pin);
    if (!svar.ok) return { ok: false, fel: svar.fel };
    setSession(svar.session); sessRef.current = svar.session;
    setS(svar.state); sRef.current = svar.state;
    rev.current = svar.rev;
    angra.current = []; setCanUndo(false);
    setNat("synkat");
    await AsyncStorage.setItem(SESSION_KEY, JSON.stringify(svar.session)).catch(() => {});
    setToast({ text: "Inloggad som " + svar.session.namn, undo: false });
    return { ok: true };
  }, []);

  const logout = useCallback(() => {
    if (session) loggaUt(session);
    setSession(null); sessRef.current = null; setNat("lokalt"); rev.current = 0;
    AsyncStorage.removeItem(SESSION_KEY).catch(() => {});
    const d = demoState();
    angra.current = []; setCanUndo(false);
    setS(d); sRef.current = d; sparaLokalt(d);
    setToast({ text: "Utloggad. Du ser demot igen.", undo: false });
  }, [session]);

  const value = useMemo(() => ({
    s, ready, kor, undo, canUndo, reset, toast, clearToast: () => setToast(null), say,
    session, roll: (session?.roll ?? "ledare") as Roll, migId: session?.personId ?? null, nat,
    login, logout,
  }), [s, ready, kor, undo, canUndo, reset, toast, say, session, nat, login, logout]);

  return <C.Provider value={value}>{children}</C.Provider>;
}

export function useStore() {
  const v = useContext(C);
  if (!v) throw new Error("useStore utanför Store");
  return v;
}

export function useLedare() { return useStore().roll === "ledare"; }
