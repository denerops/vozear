import { useCallback, useEffect, useRef, useState } from "react"
import { humanError } from "../lib/errors.ts"
import { peek, remember } from "./memory.ts"

export function useQuery<T>(key: string | null, load: () => Promise<T>) {
  const loadRef = useRef(load)
  loadRef.current = load
  const [data, setData] = useState<T | undefined>(() => (key ? peek<T>(key) : undefined))
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(() => Boolean(key) && (key ? peek(key) : undefined) === undefined)

  const refresh = useCallback(async () => {
    if (!key) return undefined as T
    const value = await loadRef.current()
    remember(key, value)
    setData(value)
    setPending(false)
    setError(null)
    return value
  }, [key])

  useEffect(() => {
    if (!key) return
    let alive = true
    const cached = peek<T>(key)
    setData(cached)
    setError(null)
    setPending(cached === undefined)
    loadRef.current()
      .then((value) => {
        remember(key, value)
        if (!alive) return
        setData(value)
        setError(null)
      })
      .catch((reason: { message?: string }) => {
        if (alive) setError(humanError(reason))
      })
      .finally(() => {
        if (alive) setPending(false)
      })
    return () => {
      alive = false
    }
  }, [key])

  return { data, error, pending, refresh }
}
