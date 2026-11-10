import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react"
import type { Session } from "@supabase/supabase-js"
import { isSupabaseConfigured, supabase } from "../lib/supabase.ts"
import type { Papel } from "../types.ts"

type SessionValue = {
  configured: boolean
  loading: boolean
  userId: string | null
  email: string | null
  nome: string
  papeis: Papel[]
  signOut: () => Promise<void>
}

const SessionContext = createContext<SessionValue | null>(null)

export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(isSupabaseConfigured)
  const [nome, setNome] = useState("")
  const [papeis, setPapeis] = useState<Papel[]>([])

  useEffect(() => {
    const client = supabase
    if (!client) return
    let alive = true
    let generation = 0

    const apply = (next: Session | null) => {
      const current = ++generation
      setSession(next)
      if (!next?.user) {
        setNome("")
        setPapeis([])
        setLoading(false)
        return
      }
      const userId = next.user.id
      void Promise.all([
        client.from("perfis").select("nome").eq("id", userId).maybeSingle(),
        client.from("papeis").select("papel").eq("user_id", userId),
      ])
        .then(([perfil, papeisResult]) => {
          if (!alive || current !== generation) return
          setNome((perfil.data?.nome as string | undefined) ?? "")
          setPapeis(((papeisResult.data ?? []) as { papel: Papel }[]).map((item) => item.papel))
          setLoading(false)
        })
        .catch(() => {
          if (alive && current === generation) setLoading(false)
        })
    }

    void client.auth.getSession().then(({ data }) => {
      if (alive) apply(data.session)
    })
    const { data } = client.auth.onAuthStateChange((_event, next) => {
      apply(next)
    })
    return () => {
      alive = false
      data.subscription.unsubscribe()
    }
  }, [])

  const value = useMemo<SessionValue>(
    () => ({
      configured: isSupabaseConfigured,
      loading,
      userId: session?.user.id ?? null,
      email: session?.user.email ?? null,
      nome,
      papeis,
      signOut: async () => {
        await supabase?.auth.signOut()
      },
    }),
    [loading, session, nome, papeis],
  )

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
}

export function useSession() {
  const value = useContext(SessionContext)
  if (!value) throw new Error("Sessão fora do provedor")
  return value
}
