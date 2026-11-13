import type { ReactNode } from "react"
import { NavLink, Outlet, useMatch } from "react-router-dom"
import {
  Calendar,
  CreditCard,
  GraduationCap,
  Home,
  LogOut,
  Settings,
  Users,
} from "lucide-react"
import { useSession } from "../auth/session.tsx"
import { LogoMark } from "./Brand.tsx"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarRail,
  SidebarSeparator,
  SidebarTrigger,
} from "@/components/ui/sidebar"

type IconName = "home" | "calendar" | "people" | "cap" | "card" | "gear"

type NavItem = { to: string; label: string; end: boolean; icon: IconName }

const icons: Record<IconName, ReactNode> = {
  home: <Home />,
  calendar: <Calendar />,
  people: <Users />,
  cap: <GraduationCap />,
  card: <CreditCard />,
  gear: <Settings />,
}

export function Shell() {
  const session = useSession()
  const admin = session.papeis.includes("administrador")
  const professor = session.papeis.includes("professor")
  const aluno = session.papeis.includes("aluno")

  const links: NavItem[] = [
    admin ? { to: "/escola", label: "Hoje", end: true, icon: "home" } : null,
    admin ? { to: "/escola/agenda", label: "Agenda", end: false, icon: "calendar" } : null,
    admin ? { to: "/escola/alunos", label: "Alunos", end: false, icon: "people" } : null,
    admin ? { to: "/escola/professores", label: "Professores", end: false, icon: "cap" } : null,
    admin ? { to: "/escola/mensalidades", label: "Mensalidades", end: false, icon: "card" } : null,
    professor ? { to: "/professor", label: "Minha semana", end: true, icon: "calendar" } : null,
    aluno ? { to: "/aluno", label: "Agenda", end: true, icon: "calendar" } : null,
    aluno ? { to: "/aluno/pagamentos", label: "Pagamentos", end: false, icon: "card" } : null,
  ].filter((item): item is NavItem => item !== null)

  const settings: NavItem | null = admin
    ? { to: "/escola/configuracao", label: "Configurações", end: false, icon: "gear" }
    : null

  const who = session.nome || session.email || ""
  const initials =
    who
      .split(/[\s@.]+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part.charAt(0).toUpperCase())
      .join("") || "?"
  const roleLabel = admin ? "Administração" : professor ? "Professor" : "Aluno"

  return (
    <SidebarProvider>
      <Sidebar collapsible="icon">
        <SidebarHeader>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton className="[&_svg]:size-8" size="lg" render={<NavLink to="/" end />}>
                <LogoMark size={32} />
                <span className="font-heading text-base font-medium">Vozear</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarHeader>
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel>Menu</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {links.map((link) => (
                  <NavItemLink key={link.to} item={link} />
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
        <SidebarFooter>
          {settings ? (
            <SidebarMenu>
              <NavItemLink item={settings} />
            </SidebarMenu>
          ) : null}
          <SidebarSeparator />
          <div className="flex items-center gap-2 px-1 py-1">
            <Avatar className="size-8">
              <AvatarFallback>{initials}</AvatarFallback>
            </Avatar>
            <span className="grid min-w-0 flex-1 text-sm leading-tight group-data-[collapsible=icon]:hidden">
              <strong className="truncate font-medium">{who}</strong>
              <small className="truncate text-muted-foreground">{roleLabel}</small>
            </span>
            <Button variant="ghost" size="icon" aria-label="Sair" onClick={() => session.signOut()}>
              <LogOut />
            </Button>
          </div>
        </SidebarFooter>
        <SidebarRail />
      </Sidebar>
      <SidebarInset>
        <header className="flex h-12 shrink-0 items-center gap-2 border-b px-3">
          <SidebarTrigger />
          <span className="text-sm font-medium">Vozear</span>
        </header>
        <div className="flex flex-1 flex-col p-4 md:p-6">
          <Outlet />
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}

function NavItemLink({ item }: { item: NavItem }) {
  const match = useMatch({ path: item.to, end: item.end })
  return (
    <SidebarMenuItem>
      <SidebarMenuButton isActive={Boolean(match)} tooltip={item.label} render={<NavLink to={item.to} end={item.end} />}>
        {icons[item.icon]}
        <span>{item.label}</span>
      </SidebarMenuButton>
    </SidebarMenuItem>
  )
}
