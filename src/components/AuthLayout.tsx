import type { ReactNode } from "react"
import { LogoMark } from "./Brand.tsx"

export function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="auth">
      <aside className="auth-brand">
        <div className="auth-logo">
          <LogoMark size={40} />
          <span>Vozear</span>
        </div>
        <svg className="auth-art" viewBox="0 0 520 240" aria-hidden="true" preserveAspectRatio="xMidYMid slice">
          <g fill="none" strokeLinecap="round">
            <path d="M-20 70C90 20 170 120 270 80S440 30 540 80" stroke="#fff" strokeOpacity="0.16" strokeWidth="1.5" />
            <path d="M-20 100C90 50 170 150 270 110S440 60 540 110" stroke="#fff" strokeOpacity="0.16" strokeWidth="1.5" />
            <path d="M-20 130C90 80 170 180 270 140S440 90 540 140" stroke="#fff" strokeOpacity="0.16" strokeWidth="1.5" />
            <path d="M-20 160C90 110 170 210 270 170S440 120 540 170" stroke="#fff" strokeOpacity="0.16" strokeWidth="1.5" />
            <path d="M-20 190C90 140 170 240 270 200S440 150 540 200" stroke="#fff" strokeOpacity="0.16" strokeWidth="1.5" />
          </g>
          <circle cx="152" cy="111" r="6" fill="#F2B84B" />
          <circle cx="338" cy="84" r="4.5" fill="#fff" fillOpacity="0.85" />
          <circle cx="418" cy="130" r="3.5" fill="#E58AA2" />
        </svg>
        <div className="auth-pitch">
          <h2>Cada aula no ritmo certo.</h2>
          <ul>
            <li>Agenda semanal por professor</li>
            <li>Recados e links em cada aula</li>
            <li>Mensalidade com Pix e WhatsApp</li>
          </ul>
        </div>
      </aside>
      <div className="auth-main">
        <div className="auth-mobile-logo">
          <LogoMark size={34} />
          <span>Vozear</span>
        </div>
        {children}
      </div>
    </div>
  )
}
