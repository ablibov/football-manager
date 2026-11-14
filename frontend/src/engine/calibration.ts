/**
 * Engine calibration constants.
 *
 * Targets come from real 2026/27 Azerbaijan Premier League results (rounds 1–11, 64 matches,
 * RSSSF): 2.56 goals per match, home W/D/L 43.8% / 29.7% / 26.6%; a Poisson fit gives a home
 * advantage of ≈0.23 (log goals). Event-rate constants (shots, fouls, cards, corners) use typical
 * European top-flight magnitudes because no public per-match event data was available for the APL.
 * `engine.calibration.test.ts` checks the simulated league averages against these targets.
 */
export const CALIBRATION = {
  /** log of the expected goals per team per 90' between two equal teams on neutral ground */
  baseLog: Math.log(1.065),
  homeAdvLog: 0.27,
  /** log-goal change per 10 rating points of attack-minus-defence */
  attVsDef: 0.22,
  midfield: 0.09,
  goalkeeper: 0.08,
  gkRef: 68,
  form: 0.06,
  manDown: 0.25,
  manUp: 0.18,
  meanShotXg: 0.105,
  passesPerMinute: 4.6,
  cornersPerMinute: 0.03,
  offsidesPerMinute: 0.021,
  foulsPerMinute: 0.125,
  yellowPerFoul: 0.165,
  redPerFoul: 0.002,
  penaltyPerFoul: 0.011,
  penaltyXg: 0.76,
  expectedPenaltyGoals: 0.105,
  varDisallowRate: 0.04,
  ownGoalShare: 0.03,
  assistedShare: 0.76,
  injuryPerTeamMinute: 0.0026,
  staminaDrain: 0.42,
  targets: { goalsPerMatch: 2.56, homeWin: 0.438, draw: 0.297, awayWin: 0.266 },
} as const
