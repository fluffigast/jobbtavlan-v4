/* Tokens från Jobbtavlan v3 (src/app.css :root), omsatta till React Native.
   Regeln är densamma: sakligt verktyg, färg bara som små lägesmärken. */
export type Theme = ReturnType<typeof makeTheme>;

const light = {
  bg: "#F5F6F8", surface: "#FFFFFF", ink: "#1F2328", muted: "#5C6570",
  line: "#E3E7EB", hover: "#F0F2F5", accent: "#1B5E96", onAccent: "#FFFFFF",
  crit: "#B42318", critBg: "#FEF1F0", ok: "#0B6B41", okBg: "#EAF7F0",
  warn: "#8A4B0A", warnBg: "#FFF6E5",
  /* Länkfärg på en yta i ink-färg, som toasten. */
  onInk: "#9FD0FF",
};
const dark = {
  bg: "#15181C", surface: "#1C2026", ink: "#E6E9ED", muted: "#9AA4AF",
  line: "#2F363E", hover: "#252B32", accent: "#7DB7E8", onAccent: "#0E1620",
  crit: "#FF9A8F", critBg: "#3A1C19", ok: "#7AD3A4", okBg: "#16301F",
  warn: "#F1C27A", warnBg: "#3A2C12",
  onInk: "#1B5E96",
};

/* 4 px-rutnät, typskala 12/13/15/17/22/28. Radhöjd 56 px: v3 hade 48 px för mus,
   en tumme behöver mer (Apple 44 pt, Material 48 dp, plus luft). */
export const S = { x1: 4, x2: 8, x3: 12, x4: 16, x5: 20, x6: 24, row: 56, tap: 44, r: 10 };
/* Bredare än så här blir en listrad en text till vänster och en knapp långt
   därifrån. Gäller surfplattor och webbläsare under skrivbordsbredden. */
export const BREDD = 640;
export const F = { xs: 12, sm: 13, md: 15, lg: 17, xl: 22, xxl: 28 };

export function makeTheme(scheme: "light" | "dark" | null | undefined) {
  const c = scheme === "dark" ? dark : light;
  return { c, dark: scheme === "dark", S, F };
}
