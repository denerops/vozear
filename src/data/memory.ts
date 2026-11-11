const box = new Map<string, unknown>()

export function peek<T>(key: string): T | undefined {
  return box.get(key) as T | undefined
}

export function remember<T>(key: string, value: T): T {
  box.set(key, value)
  return value
}

export function forgetAll() {
  box.clear()
}
