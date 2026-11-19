'use strict';
// Botes progresivos compartidos. Se guardan a ESCALA DE APUESTA MÁXIMA (50): el bote «entero» es el de la apuesta 50.
// Cada partida añade 10 × apuesta a cada bote (apuesta 1 → +10, apuesta 5 → +50…).
// Un jugador con apuesta m ve y cobra bote × m / 50 (apuesta 50 = bote entero, apuesta 25 = la mitad, apuesta 1 = 1/50).
// Si sale un nivel, se paga esa parte (ya con el incremento de la partida) y se resta del bote; el resto se queda para los demás.
const STEP = 10;
const MAX_MULT = 50;
const clampMult = (mult) => Math.min(MAX_MULT, Math.max(1, Math.floor(Number(mult)) || 1));
// Parte del bote que corresponde a una apuesta m
const share = (pot, mult = 1) => Math.floor(Math.max(0, Number(pot) || 0) * clampMult(mult) / MAX_MULT);
const advance = (current, tier, mult = 1) => {
  const m = clampMult(mult);
  const inc = STEP * m;
  const next = [0, Number(current[1] || 0) + inc, Number(current[2] || 0) + inc, Number(current[3] || 0) + inc];
  const payout = tier >= 1 && tier <= 3 ? share(next[tier], m) : 0;
  if (payout) next[tier] -= payout;
  return { jackpots: next, payout };
};
module.exports = { STEP, MAX_MULT, share, advance };
