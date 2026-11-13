export const PALETTES = [
  { id: "cobalto", name: "Cobalto", description: "Cinza frio e azul", ink: "oklch(0.21 0.025 264)", primary: "oklch(0.44 0.16 264)", accent: "oklch(0.95 0.022 264)", soft: "oklch(0.978 0.003 262)" },
  { id: "grafite", name: "Grafite", description: "Quase preto, sem cor", ink: "oklch(0.18 0.01 260)", primary: "oklch(0.25 0.015 260)", accent: "oklch(0.94 0.008 260)", soft: "oklch(0.975 0.002 260)" },
  { id: "floresta", name: "Floresta", description: "Papel quente e verde", ink: "oklch(0.22 0.03 150)", primary: "oklch(0.4 0.08 158)", accent: "oklch(0.94 0.03 155)", soft: "oklch(0.978 0.008 145)" },
  { id: "ambar", name: "Âmbar", description: "Areia e barro", ink: "oklch(0.22 0.03 55)", primary: "oklch(0.42 0.1 55)", accent: "oklch(0.94 0.035 75)", soft: "oklch(0.98 0.008 85)" },
  { id: "oceano", name: "Oceano", description: "Cinza e verde-água", ink: "oklch(0.22 0.03 200)", primary: "oklch(0.42 0.09 195)", accent: "oklch(0.94 0.03 195)", soft: "oklch(0.98 0.006 200)" },
  { id: "violeta", name: "Violeta", description: "Cinza e roxo", ink: "oklch(0.22 0.03 300)", primary: "oklch(0.42 0.13 300)", accent: "oklch(0.94 0.03 300)", soft: "oklch(0.98 0.006 300)" },
] as const

export type PaletteId = (typeof PALETTES)[number]["id"]

const KEY = "vozear.paleta"
const THEME_KEY = "vozear.tema"

export type ThemeMode = "light" | "dark"

export function readTheme(): ThemeMode {
  try {
    return localStorage.getItem(THEME_KEY) === "dark" ? "dark" : "light"
  } catch {
    return "light"
  }
}

export function applyTheme(mode: ThemeMode) {
  document.documentElement.classList.toggle("dark", mode === "dark")
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", mode === "dark" ? "#17181f" : "#f6f7fb")
  try {
    localStorage.setItem(THEME_KEY, mode)
  } catch {
    /* the choice still applies for this visit */
  }
}

export function isPalette(value: string | null): value is PaletteId {
  return PALETTES.some((item) => item.id === value)
}

export function readPalette(): PaletteId {
  try {
    const stored = localStorage.getItem(KEY)
    return isPalette(stored) ? stored : "cobalto"
  } catch {
    return "cobalto"
  }
}

export function applyPalette(id: PaletteId) {
  if (id === "cobalto") delete document.documentElement.dataset.palette
  else document.documentElement.dataset.palette = id
  try {
    localStorage.setItem(KEY, id)
  } catch {
    /* the choice still applies for this visit */
  }
}
