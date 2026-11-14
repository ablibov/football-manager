/**
 * Caspian Match Simulator Match Engine — minute-by-minute event simulation.
 *
 * Model: each side has an expected-goals rate λ (per 90') derived from the strength of the
 * players currently on the pitch (attack vs opposing defence, midfield control, goalkeeper),
 * home advantage, formation, tactics, form, weather, fatigue, red cards and game state.
 * λ is converted into a per-minute shot rate; every shot carries an xG value and is converted
 * with a probability proportional to its xG and the shooter's finishing (normalised so the
 * expectation equals λ). Goals therefore follow a (time-inhomogeneous) Poisson-binomial
 * process whose mean is λ — the score is never drawn independently from the events.
 * All randomness flows from one seeded RNG, so a seed + config reproduces the match exactly.
 */
import { FORMATIONS } from './formations'
import { CALIBRATION } from './calibration'
import { lineOf, overall, positionFit, ratingFor, slotRating } from './ratings'
import { Rng } from './rng'
import type {
  Lineup, MatchConfig, MatchEvent, MatchResult, Player, PlayerMatchLine, Position, Side, Tactics, TeamStats,
} from './types'

export type Phase = 'pre' | 'first' | 'half_time' | 'second' | 'et_break' | 'et_first' | 'et_half' | 'et_second' | 'penalties' | 'finished'

interface PState {
  p: Player
  role: Position
  stamina: number
  yellow: number
  line: PlayerMatchLine
}

interface TeamState {
  side: Side
  lineup: Lineup
  tactics: Tactics
  onPitch: PState[]
  bench: Player[]
  usedBench: Set<string>
  subsUsed: number
  windowsUsed: number
  lastWindowMinute: number
  plannedWindows: number[]
  lines: Map<string, PlayerMatchLine>
  acc: { possession: number; minutes: number; passes: number; completed: number; fouls: number; corners: number; shots: number; sot: number; xg: number; yellow: number; red: number; saves: number; offsides: number }
  goals: number
  auto: boolean
}

export const MAX_SUBS = 5
export const MAX_WINDOWS = 3

const ATT_W: Record<string, number> = { GK: 0, DEF: 0.12, MID: 0.5, ATT: 1 }
const MID_W: Record<string, number> = { GK: 0, DEF: 0.28, MID: 1, ATT: 0.35 }
const DEF_W: Record<string, number> = { GK: 0, DEF: 1, MID: 0.42, ATT: 0.08 }
const SHOOT_W: Partial<Record<Position, number>> = { ST: 1, LW: 0.62, RW: 0.62, AM: 0.55, LM: 0.32, RM: 0.32, CM: 0.26, DM: 0.1, LWB: 0.1, RWB: 0.1, LB: 0.07, RB: 0.07, CB: 0.09, GK: 0 }
const ASSIST_W: Partial<Record<Position, number>> = { AM: 1, LW: 0.9, RW: 0.9, LM: 0.75, RM: 0.75, CM: 0.65, ST: 0.45, LWB: 0.55, RWB: 0.55, LB: 0.42, RB: 0.42, DM: 0.3, CB: 0.12, GK: 0.02 }
const FOUL_W: Partial<Record<Position, number>> = { CB: 1, DM: 1.15, CM: 0.85, LB: 0.9, RB: 0.9, LWB: 0.85, RWB: 0.85, LM: 0.6, RM: 0.6, AM: 0.55, LW: 0.45, RW: 0.45, ST: 0.6, GK: 0.04 }

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v))
const opp = (s: Side): Side => (s === 'home' ? 'away' : 'home')

function emptyLine(p: Player, side: Side, started: boolean, minute: number): PlayerMatchLine {
  return { playerId: p.id, side, started, minutesOn: started ? 0 : minute, minuteOff: null, goals: 0, assists: 0, yellow: 0, red: false, saves: 0, goalsConceded: 0 }
}

export interface LiveSnapshot {
  phase: Phase
  minute: number
  added: number
  score: [number, number]
  events: MatchEvent[]
  stats: { home: TeamStats; away: TeamStats }
  onPitch: { home: { player: Player; role: Position; stamina: number; yellow: number }[]; away: { player: Player; role: Position; stamina: number; yellow: number }[] }
  bench: { home: Player[]; away: Player[] }
  subsLeft: { home: number; away: number }
  penalties: [number, number] | null
}

export class MatchSimulation {
  readonly cfg: MatchConfig
  private rng: Rng
  private teams: Record<Side, TeamState>
  private events: MatchEvent[] = []
  private eid = 0
  phase: Phase = 'pre'
  /** regular clock minute of the next minute to simulate */
  private clock = 0
  private added = 0
  private addedPlanned = 0
  private halfTime: [number, number] = [0, 0]
  private fullTime: [number, number] = [0, 0]
  private extraTime = false
  private pens: [number, number] | null = null
  private winner: Side | null = null

  constructor(cfg: MatchConfig) {
    this.cfg = cfg
    this.rng = new Rng(cfg.seed)
    this.teams = { home: this.initTeam('home'), away: this.initTeam('away') }
    this.lambdaAtKickoff = { home: this.lambda('home'), away: this.lambda('away') }
  }

  /** pre-match expected goals per side */
  readonly lambdaAtKickoff: { home: number; away: number }

  private initTeam(side: Side): TeamState {
    const t = this.cfg[side]
    const byId = new Map(t.players.map((p) => [p.id, p]))
    const lines = new Map<string, PlayerMatchLine>()
    const onPitch: PState[] = []
    for (const slot of FORMATIONS[t.lineup.formation].slots) {
      const p = byId.get(t.lineup.slots[slot.id])
      if (!p) continue
      const line = emptyLine(p, side, true, 0)
      lines.set(p.id, line)
      onPitch.push({ p, role: slot.role, stamina: 100, yellow: 0, line })
    }
    if (onPitch.length !== 11) throw new Error(`${side} lineup must contain 11 players (has ${onPitch.length})`)
    const bench = t.lineup.bench.map((id) => byId.get(id)).filter((p): p is Player => !!p && p.status === 'available')
    const w1 = this.rng.int(56, 64)
    const w2 = this.rng.int(66, 74)
    const w3 = this.rng.int(77, 84)
    return {
      side, lineup: t.lineup, tactics: { ...t.lineup.tactics }, onPitch, bench, usedBench: new Set(), subsUsed: 0, windowsUsed: 0,
      lastWindowMinute: -1, plannedWindows: [w1, w2, w3], lines,
      acc: { possession: 0, minutes: 0, passes: 0, completed: 0, fouls: 0, corners: 0, shots: 0, sot: 0, xg: 0, yellow: 0, red: 0, saves: 0, offsides: 0 },
      goals: 0, auto: this.cfg.autoSubs[side],
    }
  }

  // ---------------------------------------------------------------- strength model
  private units(t: TeamState) {
    let att = 0, mid = 0, def = 0, wa = 0, wm = 0, wd = 0, gk = 40
    for (const s of t.onPitch) {
      const a = s.p.attrs
      const fit = 0.55 + 0.45 * positionFit(s.p, s.role)
      const fat = 0.82 + 0.18 * (s.stamina / 100)
      const k = fit * fat
      const line = lineOf(s.role)
      if (line === 'GK') {
        gk = ratingFor(s.p, 'GK') * (s.p.position === 'GK' ? 1 : 0.6) * (0.9 + 0.1 * s.stamina / 100)
        continue
      }
      const av = (a.sho * 0.34 + a.dri * 0.26 + a.pac * 0.2 + a.pas * 0.2) * k
      const mv = (a.pas * 0.4 + a.dri * 0.22 + a.phy * 0.2 + a.def * 0.18) * k
      const dv = (a.def * 0.52 + a.phy * 0.26 + a.pac * 0.22) * k
      const aw = s.role === 'AM' ? 0.8 : ATT_W[line]
      const dw = s.role === 'DM' ? 0.8 : DEF_W[line]
      att += av * aw; wa += aw
      mid += mv * MID_W[line]; wm += MID_W[line]
      def += dv * dw; wd += dw
    }
    return { att: wa ? att / wa : 30, mid: wm ? mid / wm : 30, def: wd ? def / wd : 30, gk, men: t.onPitch.length }
  }

  /** expected goals per 90' for `side` given the current state (exposed for tests/UI) */
  lambda(side: Side): number {
    const C = CALIBRATION
    const me = this.teams[side]
    const them = this.teams[opp(side)]
    const u = this.units(me)
    const v = this.units(them)
    const fm = FORMATIONS[me.lineup.formation]
    const fo = FORMATIONS[them.lineup.formation]
    let x = C.baseLog
    if (!this.cfg.neutral) x += side === 'home' ? C.homeAdvLog / 2 : -C.homeAdvLog / 2
    x += C.attVsDef * (u.att - v.def) / 10
    x += C.midfield * (u.mid - v.mid) / 10
    x -= C.goalkeeper * (v.gk - C.gkRef) / 10
    x += fm.attack - fo.defense
    x += tacticOwn(me.tactics) + tacticOpp(them.tactics)
    const form = this.cfg.form?.[side] ?? 0
    x += C.form * form
    x += weatherLog(this.cfg.weather)
    // numerical (dis)advantage
    x += C.manDown * (u.men - 11) - C.manUp * (v.men - 11)
    // game state: chasing teams commit forward late on, leaders sit deeper
    const diff = me.goals - them.goals
    const m = this.clock
    if (m >= 60 && diff < 0) x += 0.12 + (m >= 80 ? 0.08 : 0)
    if (m >= 60 && diff > 0) x -= 0.08
    return Math.exp(x)
  }

  private possessionShare(): number {
    const h = this.units(this.teams.home)
    const a = this.units(this.teams.away)
    let z = (h.mid - a.mid) / 22
    z += posTactic(this.teams.home.tactics) - posTactic(this.teams.away.tactics)
    if (!this.cfg.neutral) z += 0.04
    z += (h.men - a.men) * 0.12
    return clamp(0.5 + 0.34 * Math.tanh(z), 0.24, 0.76)
  }

  // ---------------------------------------------------------------- event helpers
  private push(e: Omit<MatchEvent, 'id' | 'minute' | 'added'> & { minute?: number; added?: number }) {
    const ev: MatchEvent = { id: ++this.eid, minute: e.minute ?? this.clock, added: e.added ?? (this.added || undefined), ...e } as MatchEvent
    if (ev.added === 0) delete ev.added
    this.events.push(ev)
    return ev
  }

  private score(): [number, number] {
    return [this.teams.home.goals, this.teams.away.goals]
  }

  private gkOf(t: TeamState): PState | undefined {
    return t.onPitch.find((s) => s.role === 'GK')
  }

  private pickShooter(t: TeamState): PState {
    const pool = t.onPitch.filter((s) => s.role !== 'GK')
    return this.rng.weighted(pool.length ? pool : t.onPitch, (s) => (SHOOT_W[s.role] ?? 0.1) * (s.p.attrs.sho / 70) ** 2 * (0.7 + 0.3 * s.stamina / 100))
  }

  private shooterFactor(s: PState) {
    return Math.exp((s.p.attrs.sho - 70) / 35) * (0.85 + 0.15 * s.stamina / 100)
  }

  private avgShooterFactor(t: TeamState) {
    const pool = t.onPitch.filter((s) => s.role !== 'GK')
    let w = 0, f = 0
    for (const s of pool) {
      const wt = (SHOOT_W[s.role] ?? 0.1) * (s.p.attrs.sho / 70) ** 2 * (0.7 + 0.3 * s.stamina / 100)
      w += wt
      f += wt * this.shooterFactor(s)
    }
    return w ? f / w : 1
  }

  private scoreGoal(t: TeamState, scorer: PState, type: 'goal' | 'penalty_goal' | 'own_goal', xg: number | undefined, assist?: PState) {
    const d = this.teams[opp(t.side)]
    t.goals++
    if (type === 'own_goal') scorer.line.goals += 0
    else scorer.line.goals++
    if (assist) assist.line.assists++
    const gk = this.gkOf(d)
    if (gk) gk.line.goalsConceded++
    this.push({ type, side: t.side, playerId: scorer.p.id, secondaryPlayerId: assist?.p.id, xg, score: this.score() })
  }

  private shot(t: TeamState, meanXg: number) {
    const d = this.teams[opp(t.side)]
    const shooter = this.pickShooter(t)
    const xg = this.rng.xg(meanXg)
    const convert = clamp(xg * this.shooterFactor(shooter) / this.avgShooterFactor(t), 0.005, 0.97)
    const r = this.rng.next()
    if (r < convert) {
      // VAR review on a small share of goals
      if (this.rng.chance(CALIBRATION.varDisallowRate)) {
        this.push({ type: 'var', side: t.side, playerId: shooter.p.id, detail: this.rng.chance(0.7) ? 'offside' : 'foul' })
        return
      }
      t.acc.shots++
      t.acc.sot++
      t.acc.xg += xg
      if (this.rng.chance(CALIBRATION.ownGoalShare)) {
        const defenders = d.onPitch.filter((s) => lineOf(s.role) === 'DEF')
        const og = defenders.length ? this.rng.weighted(defenders, () => 1) : d.onPitch[0]
        // own goal: not counted as a shot for the attacking side
        t.acc.shots--
        t.acc.sot--
        t.acc.xg -= xg
        t.goals++
        const gk = this.gkOf(d)
        if (gk) gk.line.goalsConceded++
        this.push({ type: 'own_goal', side: t.side, playerId: og.p.id, score: this.score() })
        return
      }
      const assistPool = t.onPitch.filter((s) => s !== shooter)
      const assist = this.rng.chance(CALIBRATION.assistedShare)
        ? this.rng.weighted(assistPool, (s) => (ASSIST_W[s.role] ?? 0.2) * (s.p.attrs.pas / 70) ** 2)
        : undefined
      this.scoreGoal(t, shooter, 'goal', xg, assist)
      if (this.rng.chance(0.07)) this.push({ type: 'var', side: t.side, playerId: shooter.p.id, detail: 'goal_stands' })
      return
    }
    t.acc.shots++
    t.acc.xg += xg
    const onTarget = this.rng.chance(clamp(0.2 + xg * 0.9, 0.2, 0.7))
    if (onTarget) {
      t.acc.sot++
      d.acc.saves++
      const gk = this.gkOf(d)
      if (gk) gk.line.saves++
      this.push({ type: 'save', side: d.side, playerId: gk?.p.id, secondaryPlayerId: shooter.p.id, xg })
      if (this.rng.chance(0.32)) this.corner(t)
      return
    }
    if (this.rng.chance(0.3)) {
      this.push({ type: 'shot_blocked', side: t.side, playerId: shooter.p.id, xg })
      if (this.rng.chance(0.38)) this.corner(t)
      return
    }
    this.push({ type: xg >= 0.2 ? 'chance' : 'shot_off', side: t.side, playerId: shooter.p.id, xg })
  }

  private corner(t: TeamState) {
    t.acc.corners++
    const taker = t.onPitch.find((s) => s.p.id === t.lineup.cornerTakerId)
    this.push({ type: 'corner', side: t.side, playerId: taker?.p.id })
  }

  private penalty(t: TeamState, fouled?: PState) {
    const d = this.teams[opp(t.side)]
    const taker = t.onPitch.find((s) => s.p.id === t.lineup.penaltyTakerId) ??
      [...t.onPitch].filter((s) => s.role !== 'GK').sort((a, b) => b.p.attrs.sho - a.p.attrs.sho)[0]
    const gk = this.gkOf(d)
    const pConv = penaltyConversion(taker.p, gk?.p, taker.stamina)
    t.acc.shots++
    t.acc.xg += CALIBRATION.penaltyXg
    this.push({ type: 'chance', side: t.side, playerId: taker.p.id, secondaryPlayerId: fouled?.p.id, detail: 'penalty_awarded' })
    if (this.rng.chance(pConv)) {
      t.acc.sot++
      this.scoreGoal(t, taker, 'penalty_goal', CALIBRATION.penaltyXg)
    } else if (this.rng.chance(0.72)) {
      t.acc.sot++
      d.acc.saves++
      if (gk) gk.line.saves++
      this.push({ type: 'penalty_miss', side: t.side, playerId: taker.p.id, secondaryPlayerId: gk?.p.id, detail: 'saved' })
    } else {
      this.push({ type: 'penalty_miss', side: t.side, playerId: taker.p.id, detail: 'missed' })
    }
  }

  private foul(def: TeamState) {
    const atk = this.teams[opp(def.side)]
    const offender = this.rng.weighted(def.onPitch, (s) => (FOUL_W[s.role] ?? 0.5) * (1.3 - s.p.attrs.def / 200))
    const victim = this.rng.weighted(atk.onPitch.filter((s) => s.role !== 'GK'), (s) => 0.5 + s.p.attrs.dri / 100)
    def.acc.fouls++
    const inBox = this.rng.chance(CALIBRATION.penaltyPerFoul * pressingPenaltyFactor(atk.tactics))
    this.push({ type: 'foul', side: def.side, playerId: offender.p.id, secondaryPlayerId: victim?.p.id, detail: inBox ? 'box' : undefined })
    // discipline
    const r = this.rng.next()
    const pYellow = CALIBRATION.yellowPerFoul * (inBox ? 1.6 : 1) * (def.tactics.pressing === 'high' ? 1.1 : 1)
    if (r < CALIBRATION.redPerFoul * (inBox ? 3 : 1)) {
      this.sendOff(def, offender, 'red')
    } else if (r < CALIBRATION.redPerFoul + pYellow) {
      offender.yellow++
      offender.line.yellow++
      def.acc.yellow++
      if (offender.yellow >= 2) {
        this.sendOff(def, offender, 'second_yellow')
      } else {
        this.push({ type: 'yellow', side: def.side, playerId: offender.p.id })
      }
    }
    if (inBox) this.penalty(atk, victim)
  }

  private sendOff(t: TeamState, s: PState, type: 'red' | 'second_yellow') {
    t.acc.red++
    s.line.red = true
    s.line.minuteOff = this.clock
    this.push({ type, side: t.side, playerId: s.p.id })
    t.onPitch = t.onPitch.filter((x) => x !== s)
    if (s.role === 'GK') this.replaceGoalkeeper(t)
  }

  private replaceGoalkeeper(t: TeamState) {
    const benchGk = t.bench.find((p) => p.position === 'GK' && !t.usedBench.has(p.id))
    if (benchGk && t.subsUsed < MAX_SUBS && t.auto) {
      // sacrifice the weakest attacker for the reserve goalkeeper
      const out = [...t.onPitch].sort((a, b) => (lineOf(b.role) === 'ATT' ? 1 : 0) - (lineOf(a.role) === 'ATT' ? 1 : 0) || overall(a.p) - overall(b.p))[0]
      if (out) {
        this.doSub(t, out, benchGk, 'GK')
        return
      }
    }
    // emergency: an outfield player goes in goal
    const emergency = [...t.onPitch].sort((a, b) => ratingFor(b.p, 'GK') - ratingFor(a.p, 'GK'))[0]
    if (emergency) emergency.role = 'GK'
  }

  private doSub(t: TeamState, out: PState, inP: Player, role?: Position) {
    const line = emptyLine(inP, t.side, false, this.clock)
    t.lines.set(inP.id, line)
    out.line.minuteOff = this.clock
    const st: PState = { p: inP, role: role ?? out.role, stamina: 100, yellow: 0, line }
    t.onPitch = t.onPitch.map((x) => (x === out ? st : x))
    t.usedBench.add(inP.id)
    t.subsUsed++
    if (t.lastWindowMinute !== this.clock && this.phase !== 'half_time' && this.phase !== 'et_break' && this.phase !== 'et_half') t.windowsUsed++
    t.lastWindowMinute = this.clock
    this.push({ type: 'sub', side: t.side, playerId: inP.id, secondaryPlayerId: out.p.id })
    // inherit set-piece duties if the taker left
    if (t.lineup.penaltyTakerId === out.p.id || t.lineup.cornerTakerId === out.p.id || t.lineup.freeKickTakerId === out.p.id) {
      const best = (f: (s: PState) => number) => [...t.onPitch].filter((s) => s.role !== 'GK').sort((a, b) => f(b) - f(a))[0]?.p.id ?? null
      t.lineup = {
        ...t.lineup,
        penaltyTakerId: t.lineup.penaltyTakerId === out.p.id ? best((s) => s.p.attrs.sho) : t.lineup.penaltyTakerId,
        cornerTakerId: t.lineup.cornerTakerId === out.p.id ? best((s) => s.p.attrs.pas) : t.lineup.cornerTakerId,
        freeKickTakerId: t.lineup.freeKickTakerId === out.p.id ? best((s) => s.p.attrs.pas + s.p.attrs.sho) : t.lineup.freeKickTakerId,
      }
    }
  }

  private canSub(t: TeamState): boolean {
    if (t.subsUsed >= this.maxSubs()) return false
    const inBreak = this.phase === 'half_time' || this.phase === 'et_break' || this.phase === 'et_half'
    return inBreak || t.lastWindowMinute === this.clock || t.windowsUsed < this.maxWindows()
  }

  private maxSubs() { return MAX_SUBS + (this.extraTime ? 1 : 0) }
  private maxWindows() { return MAX_WINDOWS + (this.extraTime ? 1 : 0) }

  /** Public: user substitution. Returns an error code or null on success. */
  substitute(side: Side, outId: string, inId: string): string | null {
    if (this.phase === 'finished' || this.phase === 'penalties') return 'match_over'
    const t = this.teams[side]
    const out = t.onPitch.find((s) => s.p.id === outId)
    if (!out) return 'not_on_pitch'
    const inP = t.bench.find((p) => p.id === inId)
    if (!inP) return 'not_on_bench'
    if (t.usedBench.has(inId)) return 'already_used'
    if (!this.canSub(t)) return 'no_subs_left'
    this.doSub(t, out, inP)
    return null
  }

  setTactics(side: Side, tactics: Tactics) {
    this.teams[side].tactics = { ...tactics }
  }

  setAuto(side: Side, auto: boolean) {
    this.teams[side].auto = auto
  }

  private injury(t: TeamState) {
    const victim = this.rng.weighted(t.onPitch, (s) => 1.4 - s.p.attrs.phy / 100)
    this.push({ type: 'injury', side: t.side, playerId: victim.p.id })
    const replacement = this.bestBenchFor(t, victim.role)
    if (replacement && this.canSub(t) && (t.auto || victim.role === 'GK')) this.doSub(t, victim, replacement)
    else victim.stamina = Math.min(victim.stamina, 35)
  }

  private bestBenchFor(t: TeamState, role: Position): Player | undefined {
    const pool = t.bench.filter((p) => !t.usedBench.has(p.id) && (role === 'GK') === (p.position === 'GK'))
    return pool.sort((a, b) => slotRating(b, role) - slotRating(a, role))[0]
  }

  private aiSubs(t: TeamState) {
    if (!t.auto) return
    const m = this.clock
    const window = t.plannedWindows.includes(m) || (this.extraTime && (m === 96 || m === 106))
    if (!window || !this.canSub(t)) return
    const losing = t.goals < this.teams[opp(t.side)].goals
    const n = m < 65 ? 1 : this.rng.int(1, 2)
    for (let i = 0; i < n && this.canSub(t); i++) {
      const tired = t.onPitch
        .filter((s) => s.role !== 'GK' && !t.usedBench.has(s.p.id))
        .sort((a, b) => a.stamina - b.stamina + (b.yellow - a.yellow) * 8)[0]
      if (!tired || tired.stamina > 78) break
      let role = tired.role
      // tactical change: chasing the game late → bring on an attacker for a defensive player
      if (losing && m >= 65 && (lineOf(role) === 'DEF' || role === 'DM')) {
        const atk = t.bench.find((p) => !t.usedBench.has(p.id) && lineOf(p.position) === 'ATT')
        if (atk) role = tired.role === 'DM' ? 'AM' : role
      }
      const inP = this.bestBenchFor(t, role) ?? this.bestBenchFor(t, tired.role)
      if (!inP) break
      this.doSub(t, tired, inP, role)
    }
  }

  // ---------------------------------------------------------------- the minute loop
  private simulateMinute(intensity: number) {
    const C = CALIBRATION
    const ph = this.possessionShare()
    const share: Record<Side, number> = { home: ph, away: 1 - ph }
    for (const side of ['home', 'away'] as Side[]) {
      const t = this.teams[side]
      const d = this.teams[opp(side)]
      t.acc.possession += share[side]
      t.acc.minutes++
      // passing
      const tempoF = t.tactics.tempo === 'fast' ? 0.9 : t.tactics.tempo === 'slow' ? 1.12 : 1
      const passes = C.passesPerMinute * 2 * share[side] * tempoF * (0.9 + this.rng.next() * 0.2)
      const avgPas = t.onPitch.reduce((s, x) => s + x.p.attrs.pas * (0.85 + 0.15 * x.stamina / 100), 0) / t.onPitch.length
      let acc = 0.6 + (avgPas - 50) * 0.006 + (share[side] - 0.5) * 0.12
      acc += t.tactics.tempo === 'fast' ? -0.02 : t.tactics.tempo === 'slow' ? 0.015 : 0
      acc += d.tactics.pressing === 'high' ? -0.02 : d.tactics.pressing === 'low' ? 0.01 : 0
      acc += weatherPassing(this.cfg.weather)
      acc = clamp(acc, 0.55, 0.93)
      t.acc.passes += passes
      t.acc.completed += passes * acc

      // chances: open-play goal rate excludes the expected penalty contribution
      const lam = this.lambda(side)
      const openLam = Math.max(0.05, lam - C.expectedPenaltyGoals) / (1 - C.varDisallowRate)
      const goalsThisMinute = (openLam / 90) * intensity
      const quality = this.units(t).att
      const meanXg = clamp(C.meanShotXg * Math.exp((quality - 65) / 80), 0.07, 0.17)
      const shotRate = goalsThisMinute / meanXg
      let shots = 0
      let p = shotRate
      while (p > 0 && shots < 3) {
        if (this.rng.chance(Math.min(p, 0.95))) {
          this.shot(t, meanXg)
          shots++
        }
        p -= 1
      }
      // extra corners from sustained pressure
      if (this.rng.chance(C.cornersPerMinute * share[side] * 2 * (t.tactics.mentality === 'attacking' ? 1.15 : 1))) this.corner(t)
      // offside
      if (this.rng.chance(C.offsidesPerMinute * (t.tactics.tempo === 'fast' ? 1.25 : 1) * (d.tactics.pressing === 'high' ? 1.2 : 1))) {
        const fw = t.onPitch.filter((s) => lineOf(s.role) === 'ATT' || s.role === 'AM')
        const who = fw.length ? this.rng.weighted(fw, (s) => s.p.attrs.pac) : t.onPitch[0]
        t.acc.offsides++
        this.push({ type: 'offside', side, playerId: who.p.id })
      }
      // fouls committed by `side` while defending
      const foulRate = C.foulsPerMinute * share[opp(side)] * 2 * pressingFoulFactor(t.tactics) * weatherFouls(this.cfg.weather)
      if (this.rng.chance(foulRate)) this.foul(t)
      // injuries
      if (this.rng.chance(C.injuryPerTeamMinute)) this.injury(t)
      // fatigue
      const drain = C.staminaDrain * pressingDrain(t.tactics) * (t.tactics.tempo === 'fast' ? 1.12 : t.tactics.tempo === 'slow' ? 0.9 : 1) * (this.cfg.weather === 'heat' ? 1.3 : 1)
      for (const s of t.onPitch) s.stamina = Math.max(5, s.stamina - drain * (1.3 - s.p.attrs.phy / 200) * (s.role === 'GK' ? 0.3 : 1))
    }
  }

  private plannedAdded(half: 'first' | 'second' | 'et'): number {
    const from = half === 'first' ? 0 : half === 'second' ? 45 : 90
    const to = half === 'first' ? 45 : half === 'second' ? 90 : 120
    const evs = this.events.filter((e) => e.minute > from && e.minute <= to && ['goal', 'penalty_goal', 'own_goal', 'sub', 'red', 'second_yellow', 'injury', 'var'].includes(e.type))
    if (half === 'first') return clamp(1 + Math.floor(evs.length * 0.5) + this.rng.int(0, 1), 1, 6)
    if (half === 'second') return clamp(3 + Math.floor(evs.length * 0.35) + this.rng.int(0, 2), 2, 10)
    return clamp(1 + this.rng.int(0, 2), 0, 4)
  }

  private intensity() {
    const m = this.clock
    if (m <= 90) return 0.82 + 0.36 * (m / 90)
    return 0.92 // extra time: tired legs, more caution
  }

  /** Advance by one simulated minute (or a break / shoot-out). Returns events produced in this step. */
  step(): MatchEvent[] {
    const before = this.events.length
    switch (this.phase) {
      case 'pre':
        this.phase = 'first'
        this.clock = 0
        this.push({ type: 'kickoff', minute: 0 })
        break
      case 'first':
      case 'second':
      case 'et_first':
      case 'et_second': {
        const end = this.phase === 'first' ? 45 : this.phase === 'second' ? 90 : this.phase === 'et_first' ? 105 : 120
        if (this.clock < end) {
          this.clock++
          this.added = 0
          this.aiSubs(this.teams.home)
          this.aiSubs(this.teams.away)
          this.simulateMinute(this.intensity())
          if (this.clock === end) {
            this.addedPlanned = this.phase === 'first' ? this.plannedAdded('first') : this.phase === 'second' ? this.plannedAdded('second') : this.plannedAdded('et')
            if (this.addedPlanned > 0) this.push({ type: 'added_time', detail: String(this.addedPlanned) })
          }
        } else if (this.added < this.addedPlanned) {
          this.added++
          this.simulateMinute(1.12)
        } else {
          this.endPeriod()
        }
        break
      }
      case 'half_time':
        this.phase = 'second'
        this.clock = 45
        this.added = 0
        this.htSubs()
        break
      case 'et_break':
        this.phase = 'et_first'
        this.clock = 90
        this.added = 0
        this.htSubs()
        break
      case 'et_half':
        this.phase = 'et_second'
        this.clock = 105
        this.added = 0
        break
      case 'penalties':
        this.shootout()
        this.finish()
        break
      case 'finished':
        break
    }
    return this.events.slice(before)
  }

  private htSubs() {
    for (const t of [this.teams.home, this.teams.away]) {
      if (!t.auto || t.subsUsed >= this.maxSubs()) continue
      // a defender on a yellow is sometimes withdrawn at the break
      const risk = t.onPitch.find((s) => s.yellow === 1 && (lineOf(s.role) === 'DEF' || s.role === 'DM'))
      if (risk && this.rng.chance(0.3)) {
        const inP = this.bestBenchFor(t, risk.role)
        if (inP) this.doSub(t, risk, inP)
      }
    }
  }

  private endPeriod() {
    const added = this.addedPlanned
    this.added = 0
    this.addedPlanned = 0
    if (this.phase === 'first') {
      this.halfTime = this.score()
      this.push({ type: 'half_time', minute: 45, added: added || undefined, score: this.score() })
      this.phase = 'half_time'
      return
    }
    if (this.phase === 'second') {
      this.fullTime = this.score()
      if (this.cfg.knockout && this.tiedOverall()) {
        this.extraTime = true
        this.push({ type: 'extra_time_start', minute: 90, added: added || undefined, score: this.score() })
        this.phase = 'et_break'
        return
      }
      this.push({ type: 'full_time', minute: 90, added: added || undefined, score: this.score() })
      this.finish()
      return
    }
    if (this.phase === 'et_first') {
      this.phase = 'et_half'
      return
    }
    if (this.phase === 'et_second') {
      this.push({ type: 'extra_time_end', minute: 120, added: added || undefined, score: this.score() })
      if (this.tiedOverall()) {
        this.phase = 'penalties'
        return
      }
      this.push({ type: 'full_time', minute: 120, score: this.score() })
      this.finish()
    }
  }

  private tiedOverall() {
    const [h, a] = this.score()
    if (!this.cfg.aggregate) return h === a
    // aggregate: this match's home team was the AWAY team of leg 1
    return h + this.cfg.aggregate.awayGoals === a + this.cfg.aggregate.homeGoals
  }

  private shootout() {
    const order = (t: TeamState) => {
      const taker = t.lineup.penaltyTakerId
      return [...t.onPitch].sort((a, b) => {
        if (a.p.id === taker) return -1
        if (b.p.id === taker) return 1
        if (a.role === 'GK') return 1
        if (b.role === 'GK') return -1
        return b.p.attrs.sho * 0.8 + b.p.attrs.pas * 0.2 - (a.p.attrs.sho * 0.8 + a.p.attrs.pas * 0.2)
      })
    }
    const res = runShootout(this.rng, order(this.teams.home), order(this.teams.away), this.gkOf(this.teams.home), this.gkOf(this.teams.away))
    for (const k of res.kicks) {
      this.push({ type: 'shootout_kick', minute: 120, side: k.side, playerId: k.playerId, detail: k.scored ? 'scored' : 'missed', score: [k.tally[0], k.tally[1]] })
    }
    this.pens = res.score
    this.push({ type: 'shootout_end', minute: 120, side: res.score[0] > res.score[1] ? 'home' : 'away', score: res.score })
  }

  private finish() {
    this.phase = 'finished'
    const [h, a] = this.score()
    if (this.pens) this.winner = this.pens[0] > this.pens[1] ? 'home' : 'away'
    else if (this.cfg.aggregate) {
      const th = h + this.cfg.aggregate.awayGoals
      const ta = a + this.cfg.aggregate.homeGoals
      this.winner = th > ta ? 'home' : ta > th ? 'away' : null
    } else this.winner = h > a ? 'home' : a > h ? 'away' : null
  }

  isFinished() {
    return this.phase === 'finished'
  }

  /** Run to the end (Instant mode). */
  runToEnd(): MatchResult {
    let guard = 0
    while (!this.isFinished() && guard++ < 1000) this.step()
    return this.result()
  }

  private teamStats(t: TeamState): TeamStats {
    const a = t.acc
    const passes = Math.round(a.passes)
    const completed = Math.min(passes, Math.round(a.completed))
    return {
      possession: a.minutes ? Math.round((a.possession / a.minutes) * 100) : 50,
      shots: a.shots,
      shotsOnTarget: a.sot,
      xg: Math.round(a.xg * 100) / 100,
      passes,
      passesCompleted: completed,
      passAccuracy: passes ? Math.round((completed / passes) * 100) : 0,
      corners: a.corners,
      fouls: a.fouls,
      yellow: a.yellow,
      red: a.red,
      saves: a.saves,
      offsides: a.offsides,
    }
  }

  private finalMinute() {
    return this.extraTime ? 120 : 90
  }

  snapshot(): LiveSnapshot {
    const sh = this.teamStats(this.teams.home)
    const sa = this.teamStats(this.teams.away)
    sa.possession = 100 - sh.possession
    const op = (t: TeamState) => t.onPitch.map((s) => ({ player: s.p, role: s.role, stamina: Math.round(s.stamina), yellow: s.yellow }))
    const bench = (t: TeamState) => t.bench.filter((p) => !t.usedBench.has(p.id))
    return {
      phase: this.phase,
      minute: this.clock,
      added: this.added,
      score: this.score(),
      events: [...this.events],
      stats: { home: sh, away: sa },
      onPitch: { home: op(this.teams.home), away: op(this.teams.away) },
      bench: { home: bench(this.teams.home), away: bench(this.teams.away) },
      subsLeft: { home: this.canSub(this.teams.home) ? this.maxSubs() - this.teams.home.subsUsed : 0, away: this.canSub(this.teams.away) ? this.maxSubs() - this.teams.away.subsUsed : 0 },
      penalties: this.pens,
    }
  }

  result(): MatchResult {
    const sh = this.teamStats(this.teams.home)
    const sa = this.teamStats(this.teams.away)
    sa.possession = 100 - sh.possession
    const end = this.finalMinute()
    const players: PlayerMatchLine[] = []
    for (const t of [this.teams.home, this.teams.away]) {
      for (const line of t.lines.values()) {
        const off = line.minuteOff ?? end
        players.push({ ...line, minutesOn: Math.max(0, off - line.minutesOn) })
      }
    }
    return {
      seed: this.cfg.seed,
      homeId: this.cfg.home.club.id,
      awayId: this.cfg.away.club.id,
      score: this.score(),
      halfTime: this.halfTime,
      fullTime: this.fullTime,
      extraTime: this.extraTime,
      penalties: this.pens,
      winner: this.winner,
      events: [...this.events],
      stats: { home: sh, away: sa },
      xgModel: { home: Math.round(this.lambdaAtKickoff.home * 100) / 100, away: Math.round(this.lambdaAtKickoff.away * 100) / 100 },
      players,
      finalMinute: end,
    }
  }

}

// ------------------------------------------------------------------ modifiers
function tacticOwn(t: Tactics) {
  let x = 0
  if (t.mentality === 'attacking') x += 0.12
  if (t.mentality === 'defensive') x -= 0.15
  if (t.tempo === 'fast') x += 0.05
  if (t.tempo === 'slow') x -= 0.05
  if (t.pressing === 'low') x -= 0.02
  return x
}
/** effect of the opponent's tactics on my scoring */
function tacticOpp(o: Tactics) {
  let x = 0
  if (o.mentality === 'attacking') x += 0.08
  if (o.mentality === 'defensive') x -= 0.1
  if (o.pressing === 'high') x -= 0.04
  if (o.pressing === 'low') x += 0.02
  if (o.tempo === 'fast') x += 0.03
  return x
}
function posTactic(t: Tactics) {
  return (t.pressing === 'high' ? 0.06 : t.pressing === 'low' ? -0.05 : 0) + (t.tempo === 'slow' ? 0.04 : t.tempo === 'fast' ? -0.03 : 0) + (t.mentality === 'attacking' ? 0.04 : t.mentality === 'defensive' ? -0.07 : 0)
}
function pressingFoulFactor(t: Tactics) {
  return t.pressing === 'high' ? 1.25 : t.pressing === 'low' ? 0.85 : 1
}
function pressingPenaltyFactor(t: Tactics) {
  return t.mentality === 'attacking' ? 1.15 : t.mentality === 'defensive' ? 0.85 : 1
}
function pressingDrain(t: Tactics) {
  return t.pressing === 'high' ? 1.3 : t.pressing === 'low' ? 0.82 : 1
}
function weatherLog(w: MatchConfig['weather']) {
  return w === 'rain' ? 0.02 : w === 'wind' ? -0.03 : w === 'snow' ? -0.08 : w === 'heat' ? -0.03 : 0
}
function weatherPassing(w: MatchConfig['weather']) {
  return w === 'rain' ? -0.03 : w === 'wind' ? -0.02 : w === 'snow' ? -0.05 : w === 'heat' ? -0.01 : 0
}
function weatherFouls(w: MatchConfig['weather']) {
  return w === 'rain' ? 1.06 : w === 'snow' ? 1.1 : 1
}

export function penaltyConversion(taker: Player, gk: Player | undefined, stamina = 100) {
  const g = gk ? ratingFor(gk, 'GK') : 40
  return clamp(0.76 * Math.exp((taker.attrs.sho - 70) / 90) * Math.exp(-(g - 70) / 120) * (0.94 + 0.06 * stamina / 100), 0.5, 0.92)
}

// ------------------------------------------------------------------ shoot-out
export interface ShootoutKick { side: Side; playerId: string; scored: boolean; tally: [number, number] }

export function runShootout(
  rng: Rng,
  homeOrder: { p: Player; stamina: number }[],
  awayOrder: { p: Player; stamina: number }[],
  homeGk?: { p: Player },
  awayGk?: { p: Player },
): { kicks: ShootoutKick[]; score: [number, number] } {
  const kicks: ShootoutKick[] = []
  const score: [number, number] = [0, 0]
  const taken: [number, number] = [0, 0]
  const kick = (side: Side) => {
    const i = side === 'home' ? 0 : 1
    const order = side === 'home' ? homeOrder : awayOrder
    const taker = order[taken[i] % order.length]
    const gk = side === 'home' ? awayGk : homeGk
    const p = penaltyConversion(taker.p, gk?.p, taker.stamina) * 0.97 // shoot-out pressure
    const scored = rng.chance(p)
    taken[i]++
    if (scored) score[i]++
    kicks.push({ side, playerId: taker.p.id, scored, tally: [score[0], score[1]] })
  }
  // best of five with early termination
  for (let r = 0; r < 5; r++) {
    kick('home')
    if (decided(score, taken, 5)) break
    kick('away')
    if (decided(score, taken, 5)) break
  }
  // sudden death
  let guard = 0
  while (score[0] === score[1] && guard++ < 50) {
    kick('home')
    kick('away')
  }
  return { kicks, score }
}

function decided(score: [number, number], taken: [number, number], n: number) {
  const remH = n - taken[0]
  const remA = n - taken[1]
  return score[0] + remH < score[1] || score[1] + remA < score[0]
}

export function simulateMatch(cfg: MatchConfig): MatchResult {
  return new MatchSimulation(cfg).runToEnd()
}
