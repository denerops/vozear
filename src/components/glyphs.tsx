import type { ReactNode } from "react"

export type GlyphName =
  | "plus"
  | "people"
  | "cap"
  | "calendar"
  | "clock"
  | "list"
  | "grid"
  | "dots"
  | "note"
  | "piano"
  | "chat"
  | "pencil"
  | "coin"
  | "bars"
  | "user"
  | "mail"
  | "phone"
  | "cake"

const paths: Record<GlyphName, ReactNode> = {
  plus: <path d="M12 5v14M5 12h14" />,
  people: (
    <>
      <circle cx="9" cy="8" r="2.4" />
      <path d="M4.5 18.5c.6-2.6 2.4-4 4.5-4s3.9 1.4 4.5 4" />
      <circle cx="16" cy="8.5" r="2" />
      <path d="M16 14.5c1.6.2 2.9 1.2 3.5 3" />
    </>
  ),
  cap: (
    <>
      <path d="M3 10 12 6l9 4-9 4z" />
      <path d="M7 12.2V16c1.5 1.3 3.1 2 5 2s3.5-.7 5-2v-3.8" />
    </>
  ),
  calendar: (
    <>
      <rect x="4" y="5" width="16" height="15" rx="2" />
      <path d="M8 3.5V7M16 3.5V7M4 10h16" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="8" />
      <path d="M12 8v4.5l3 2" />
    </>
  ),
  list: (
    <>
      <path d="M9 7h11M9 12h11M9 17h11" />
      <path d="M4.5 7h.01M4.5 12h.01M4.5 17h.01" />
    </>
  ),
  grid: (
    <>
      <rect x="4" y="4" width="6.5" height="6.5" rx="1.2" />
      <rect x="13.5" y="4" width="6.5" height="6.5" rx="1.2" />
      <rect x="4" y="13.5" width="6.5" height="6.5" rx="1.2" />
      <rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.2" />
    </>
  ),
  dots: (
    <>
      <circle cx="6" cy="12" r="1" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" />
      <circle cx="18" cy="12" r="1" fill="currentColor" stroke="none" />
    </>
  ),
  note: (
    <>
      <path d="M9 18V6l10-2v12" />
      <circle cx="7" cy="18" r="2" />
      <circle cx="17" cy="16" r="2" />
    </>
  ),
  piano: (
    <>
      <rect x="4" y="5" width="16" height="14" rx="2" />
      <path d="M8 5v6M12 5v6M16 5v6" />
    </>
  ),
  chat: (
    <>
      <path d="M6 17.5 4 20V7.5A2.5 2.5 0 0 1 6.5 5h11A2.5 2.5 0 0 1 20 7.5v7A2.5 2.5 0 0 1 17.5 17H8z" />
    </>
  ),
  pencil: <path d="M4 20h4l10-10-4-4L4 16zM12 6l4 4" />,
  coin: (
    <>
      <ellipse cx="12" cy="7" rx="7" ry="3" />
      <path d="M5 7v10c0 1.7 3.1 3 7 3s7-1.3 7-3V7" />
      <path d="M5 12c0 1.7 3.1 3 7 3s7-1.3 7-3" />
    </>
  ),
  bars: (
    <>
      <path d="M5 19V11M12 19V5M19 19v-6" />
    </>
  ),
  user: (
    <>
      <circle cx="12" cy="8" r="3" />
      <path d="M6 19c.8-3 2.8-4.5 6-4.5s5.2 1.5 6 4.5" />
    </>
  ),
  mail: (
    <>
      <rect x="4" y="6" width="16" height="12" rx="2" />
      <path d="m5 8 7 5 7-5" />
    </>
  ),
  phone: <path d="M8 4h3l1 4-2 1a12 12 0 0 0 5 5l1-2 4 1v3c0 1-1 2-2 2A14 14 0 0 1 6 6c0-1 1-2 2-2z" />,
  cake: (
    <>
      <path d="M4 20h16v-7H4zM4 13c1.2-1.5 2.5-1.5 4 0s2.8 1.5 4 0 2.8-1.5 4 0 2.8 1.5 4 0" />
      <path d="M8 13V9M12 13V9M16 13V9M8 7.5V6M12 7.5V6M16 7.5V6" />
    </>
  ),
}

export function Glyph({ name, size = 18 }: { name: GlyphName; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name]}
    </svg>
  )
}

export function instrumentGlyph(name: string): GlyphName {
  const key = name.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase()
  if (key.includes("piano") || key.includes("teclado")) return "piano"
  return "note"
}
