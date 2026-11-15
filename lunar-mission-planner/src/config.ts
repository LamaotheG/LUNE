export type DataMode = "mock" | "api" | "fallback";

export const DATA_MODE: DataMode =
  (import.meta.env.VITE_DATA_MODE as DataMode) || "mock";
