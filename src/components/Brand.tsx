import { useId } from "react"

export function LogoMark({ size = 36 }: { size?: number }) {
  const id = useId()
  return (
    <svg className="logo-mark" width={size} height={size} viewBox="0 0 40 40" aria-hidden="true">
      <defs>
        <linearGradient id={`${id}-bg`} x1="6" y1="2" x2="34" y2="40" gradientUnits="userSpaceOnUse">
          <stop stopColor="#B02A4D" />
          <stop offset="1" stopColor="#5B0F26" />
        </linearGradient>
      </defs>
      <rect width="40" height="40" rx="11" fill={`url(#${id}-bg)`} />
      <rect x="0.5" y="0.5" width="39" height="39" rx="10.5" fill="none" stroke="#fff" strokeOpacity="0.18" />
      <path
        d="M11.5 12.5 20 28.5l8.5-16"
        fill="none"
        stroke="#FFF4EC"
        strokeWidth="3.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="28.5" cy="9.5" r="2.4" fill="#F2B84B" />
    </svg>
  )
}
