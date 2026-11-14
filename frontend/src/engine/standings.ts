// League table computation with regulation-driven tiebreakers.

export type Tiebreaker = 'points' | 'wins' | 'goal_diff' | 'goals_for' | 'h2h_points' | 'h2h_goal_diff' | 'h2h_goals_for' | 'fair_play' | 'draw'

export interface ResultLike {
  homeId: string
  awayId: string
  homeGoals: number
  awayGoals: number
  /** disciplinary points per side (yellow = 1, red = 3), used by the fair-play criterion */
  homeCards?: number
  awayCards?: number
}

export interface StandingRow {
  clubId: string
  played: number
  won: number
  drawn: number
  lost: number
  goalsFor: number
  goalsAgainst: number
  goalDiff: number
  points: number
  fairPlay: number
  form: ('W' | 'D' | 'L')[]
  position: number
}

export interface PointsRule { win: number; draw: number; loss: number }

const emptyRow = (clubId: string): StandingRow => ({
  clubId, played: 0, won: 0, drawn: 0, lost: 0, goalsFor: 0, goalsAgainst: 0, goalDiff: 0, points: 0, fairPlay: 0, form: [], position: 0,
})

function aggregate(clubIds: string[], results: ResultLike[], pts: PointsRule): Map<string, StandingRow> {
  const rows = new Map(clubIds.map((id) => [id, emptyRow(id)]))
  for (const r of results) {
    const h = rows.get(r.homeId)
    const a = rows.get(r.awayId)
    if (!h || !a) continue
    h.played++
    a.played++
    h.goalsFor += r.homeGoals
    h.goalsAgainst += r.awayGoals
    a.goalsFor += r.awayGoals
    a.goalsAgainst += r.homeGoals
    h.fairPlay += r.homeCards ?? 0
    a.fairPlay += r.awayCards ?? 0
    if (r.homeGoals > r.awayGoals) {
      h.won++; a.lost++; h.points += pts.win; a.points += pts.loss; h.form.push('W'); a.form.push('L')
    } else if (r.homeGoals < r.awayGoals) {
      a.won++; h.lost++; a.points += pts.win; h.points += pts.loss; a.form.push('W'); h.form.push('L')
    } else {
      h.drawn++; a.drawn++; h.points += pts.draw; a.points += pts.draw; h.form.push('D'); a.form.push('D')
    }
  }
  for (const row of rows.values()) row.goalDiff = row.goalsFor - row.goalsAgainst
  return rows
}

/**
 * Sorts clubs by the tiebreakers in the order the competition rule lists them.
 * Head-to-head criteria are evaluated on a mini-table of the clubs still tied at that step.
 * `draw` (drawing of lots) is resolved by `drawOrder` when supplied, otherwise by the order of
 * `clubIds`, so a table is always deterministic. `results` must be in chronological order for form.
 */
export function computeStandings(
  clubIds: string[],
  results: ResultLike[],
  tiebreakers: Tiebreaker[],
  pts: PointsRule = { win: 3, draw: 1, loss: 0 },
  drawOrder: string[] = [],
): StandingRow[] {
  const rows = aggregate(clubIds, results, pts)

  const keyFor = (c: Tiebreaker, group: StandingRow[]): ((r: StandingRow) => number) => {
    if (c === 'h2h_points' || c === 'h2h_goal_diff' || c === 'h2h_goals_for') {
      const ids = new Set(group.map((r) => r.clubId))
      const mini = aggregate([...ids], results.filter((r) => ids.has(r.homeId) && ids.has(r.awayId)), pts)
      if (c === 'h2h_points') return (r) => mini.get(r.clubId)!.points
      if (c === 'h2h_goal_diff') return (r) => mini.get(r.clubId)!.goalDiff
      return (r) => mini.get(r.clubId)!.goalsFor
    }
    switch (c) {
      case 'points': return (r) => r.points
      case 'wins': return (r) => r.won
      case 'goal_diff': return (r) => r.goalDiff
      case 'goals_for': return (r) => r.goalsFor
      case 'fair_play': return (r) => -r.fairPlay
      case 'draw': {
        const order = drawOrder.length ? drawOrder : clubIds
        return (r) => {
          const i = order.indexOf(r.clubId)
          return i === -1 ? -Infinity : -i
        }
      }
    }
  }

  const sortGroup = (group: StandingRow[], criteria: Tiebreaker[]): StandingRow[] => {
    if (group.length <= 1) return group
    if (criteria.length === 0) return [...group].sort((a, b) => clubIds.indexOf(a.clubId) - clubIds.indexOf(b.clubId))
    const [c, ...rest] = criteria
    const key = keyFor(c, group)
    const buckets = new Map<number, StandingRow[]>()
    for (const r of group) {
      const k = key(r)
      const b = buckets.get(k)
      if (b) b.push(r)
      else buckets.set(k, [r])
    }
    return [...buckets.entries()].sort((a, b) => b[0] - a[0]).flatMap(([, g]) => sortGroup(g, rest))
  }

  const criteria: Tiebreaker[] = tiebreakers[0] === 'points' ? tiebreakers : ['points', ...tiebreakers]
  const sorted = sortGroup([...rows.values()], criteria)
  sorted.forEach((r, i) => {
    r.position = i + 1
    r.form = r.form.slice(-5)
  })
  return sorted
}

/** -1..1 form score from the last five results (W=1, D=0, L=-1, recent results weigh more). */
export function formScore(form: ('W' | 'D' | 'L')[]): number {
  const last = form.slice(-5)
  if (!last.length) return 0
  let s = 0
  let w = 0
  last.forEach((f, i) => {
    const wt = 1 + i * 0.25
    s += (f === 'W' ? 1 : f === 'L' ? -1 : 0) * wt
    w += wt
  })
  return s / w
}
