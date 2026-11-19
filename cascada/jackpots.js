'use strict';
// Botes progresivos compartidos: cada partida añade 10 × apuesta a cada bote (apuesta 1 → +10, apuesta 5 → +50…).
// Si sale un nivel, paga ese bote (ya incrementado) y solo ese bote vuelve a cero.
const STEP = 10;
const advance = (current, tier, mult = 1) => {
  const inc = STEP * (Math.max(1, Math.floor(Number(mult)) || 1));
  const next = [0, Number(current[1] || 0) + inc, Number(current[2] || 0) + inc, Number(current[3] || 0) + inc];
  const payout = tier >= 1 && tier <= 3 ? next[tier] : 0;
  if (payout) next[tier] = 0;
  return { jackpots: next, payout };
};
module.exports = { STEP, advance };
