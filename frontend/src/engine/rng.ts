// Seeded PRNG (mulberry32) — every simulation is reproducible from its seed string.

export function hashSeed(str: string): number {
  let h = 1779033703 ^ str.length
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353)
    h = (h << 13) | (h >>> 19)
  }
  h = Math.imul(h ^ (h >>> 16), 2246822507)
  h = Math.imul(h ^ (h >>> 13), 3266489909)
  return (h ^ (h >>> 16)) >>> 0
}

export class Rng {
  private state: number
  constructor(seed: string | number) {
    this.state = typeof seed === 'number' ? seed >>> 0 : hashSeed(seed)
  }
  next(): number {
    this.state = (this.state + 0x6d2b79f5) >>> 0
    let t = this.state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
  chance(p: number): boolean {
    return this.next() < p
  }
  int(min: number, max: number): number {
    return min + Math.floor(this.next() * (max - min + 1))
  }
  /** pick an item with weights (weights ≥ 0) */
  weighted<T>(items: T[], weight: (t: T) => number): T {
    const ws = items.map((i) => Math.max(0, weight(i)))
    const total = ws.reduce((a, b) => a + b, 0)
    if (total <= 0) return items[Math.floor(this.next() * items.length)]
    let r = this.next() * total
    for (let i = 0; i < items.length; i++) {
      r -= ws[i]
      if (r <= 0) return items[i]
    }
    return items[items.length - 1]
  }
  /** Beta-ish shot quality draw with a given mean, in (0.01, 0.95) */
  xg(mean: number): number {
    // mixture of an exponential (most shots are poor) — mean preserved
    const v = -Math.log(1 - this.next() * 0.999) * mean
    return Math.min(0.95, Math.max(0.01, v))
  }
}

export function randomSeed(): string {
  return Math.floor(Math.random() * 0xffffffff).toString(36) + Date.now().toString(36).slice(-4)
}
