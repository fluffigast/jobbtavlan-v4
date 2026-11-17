/* Rollerna. Vad var och en får göra står i ops.ts, hos handlingarna själva,
   så att regeln ligger bredvid det den reglerar. */
export type Roll = "ledare" | "snickare";

export const ROLLNAMN: Record<Roll, string> = {
  ledare: "Arbetsledare",
  snickare: "Snickare",
};

export const serAllt = (roll: Roll) => roll === "ledare";
