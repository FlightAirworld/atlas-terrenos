'use strict';
// Botes progresivos compartidos: cada partida añade 10 a cada bote.
// Si sale un nivel, paga ese bote (ya incrementado) y solo ese bote vuelve a cero.
const STEP = 10;
const advance = (current, tier) => {
  const next = [0, Number(current[1] || 0) + STEP, Number(current[2] || 0) + STEP, Number(current[3] || 0) + STEP];
  const payout = tier >= 1 && tier <= 3 ? next[tier] : 0;
  if (payout) next[tier] = 0;
  return { jackpots: next, payout };
};
module.exports = { STEP, advance };
