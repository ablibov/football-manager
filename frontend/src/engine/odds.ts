// Pre-match outcome probabilities from the two expected-goal rates (independent Poisson).

function poisson(k: number, l: number) {
  let p = Math.exp(-l)
  for (let i = 1; i <= k; i++) p *= l / i
  return p
}

export function outcomeProbabilities(lh: number, la: number, maxGoals = 10) {
  let home = 0, draw = 0, away = 0
  for (let i = 0; i <= maxGoals; i++) {
    const pi = poisson(i, lh)
    for (let j = 0; j <= maxGoals; j++) {
      const p = pi * poisson(j, la)
      if (i > j) home += p
      else if (i === j) draw += p
      else away += p
    }
  }
  const t = home + draw + away
  return { home: home / t, draw: draw / t, away: away / t }
}
