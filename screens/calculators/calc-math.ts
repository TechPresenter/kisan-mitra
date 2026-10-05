// Pure calculator math (no React, no strings) so every formula can be checked on its own.
// Inputs are already validated numbers; functions return null when a result is not meaningful.

const pos = (n: number | null | undefined): n is number => typeof n === 'number' && Number.isFinite(n) && n > 0;

// ---------- Seed ----------

/** Seed for `acres` at a per-acre rate range (kg). */
export function seedNeed(acres: number, rateMinKg: number, rateMaxKg: number): { min: number; max: number } | null {
  if (!pos(acres) || !pos(rateMinKg) || !pos(rateMaxKg)) return null;
  const lo = Math.min(rateMinKg, rateMaxKg);
  const hi = Math.max(rateMinKg, rateMaxKg);
  return { min: lo * acres, max: hi * acres };
}

// ---------- Fertilizer ----------

export interface NPK {
  n: number;
  p: number;
  k: number;
}

/** Nutrient content of the common straight / complex fertilizers (fraction by weight). */
export const UREA_N = 0.46; // Urea 46% N
export const DAP_N = 0.18; // DAP 18-46-0
export const DAP_P = 0.46;
export const MOP_K = 0.6; // Muriate of potash 60% K2O
/** Standard bag sizes in India (neem-coated urea moved to 45 kg bags in 2018). */
export const BAG_KG = { urea: 45, dap: 50, mop: 50 } as const;

export interface FertilizerPlan {
  /** kg per acre */
  perAcre: { dap: number; urea: number; mop: number; nFromDap: number };
  /** kg for the whole area */
  total: { dap: number; urea: number; mop: number };
  bags: { dap: number; urea: number; mop: number };
  /** kg N per acre that DAP supplies beyond the N need (urea is then 0). */
  extraN: number;
}

/**
 * P2O5 from DAP first (it also brings 18% N), the remaining N from urea, K2O from MOP.
 * `need` is kg/acre of N, P2O5 and K2O.
 */
export function fertilizerPlan(need: NPK, acres: number): FertilizerPlan | null {
  if (!pos(acres)) return null;
  const n = Math.max(0, need.n || 0);
  const p = Math.max(0, need.p || 0);
  const k = Math.max(0, need.k || 0);
  if (n + p + k <= 0) return null;
  const dap = p / DAP_P;
  const nFromDap = dap * DAP_N;
  const urea = Math.max(0, n - nFromDap) / UREA_N;
  const mop = k / MOP_K;
  const total = { dap: dap * acres, urea: urea * acres, mop: mop * acres };
  return {
    perAcre: { dap, urea, mop, nFromDap },
    total,
    bags: { dap: total.dap / BAG_KG.dap, urea: total.urea / BAG_KG.urea, mop: total.mop / BAG_KG.mop },
    extraN: Math.max(0, nFromDap - n),
  };
}

// ---------- Pesticide mixing ----------

export interface SprayPlan {
  /** Product (ml or g) per tank */
  perTank: number;
  /** Whole tanks needed (rounded up); null when the area is unknown */
  tanks: number | null;
  /** Unrounded tanks, for the explanation */
  tanksExact: number | null;
  /** Total product (ml or g); null when the area is unknown */
  total: number | null;
  /** Total spray water in litres; null when the area is unknown */
  water: number | null;
}

/** Label dose per litre of water. Area and water per acre are optional (for tanks and totals). */
export function sprayPerLitre(dosePerL: number, tankL: number, acres?: number | null, waterPerAcreL?: number | null): SprayPlan | null {
  if (!pos(dosePerL) || !pos(tankL)) return null;
  const perTank = dosePerL * tankL;
  if (!pos(acres) || !pos(waterPerAcreL)) return { perTank, tanks: null, tanksExact: null, total: null, water: null };
  const water = waterPerAcreL * acres;
  const tanksExact = water / tankL;
  return { perTank, tanks: Math.ceil(tanksExact - 1e-9), tanksExact, total: dosePerL * water, water };
}

/** Label dose per acre, sprayed in `waterPerAcreL` litres of water per acre. */
export function sprayPerAcre(dosePerAcre: number, waterPerAcreL: number, tankL: number, acres: number): SprayPlan | null {
  if (!pos(dosePerAcre) || !pos(waterPerAcreL) || !pos(tankL) || !pos(acres)) return null;
  const water = waterPerAcreL * acres;
  const tanksExact = water / tankL;
  return {
    perTank: (dosePerAcre * tankL) / waterPerAcreL,
    tanks: Math.ceil(tanksExact - 1e-9),
    tanksExact,
    total: dosePerAcre * acres,
    water,
  };
}

// ---------- Irrigation ----------

/** Water to cover `areaSqm` to `depthMm`: m³ and litres. */
export function irrigationVolume(areaSqm: number, depthMm: number): { m3: number; litres: number } | null {
  if (!pos(areaSqm) || !pos(depthMm)) return null;
  const m3 = areaSqm * (depthMm / 1000);
  return { m3, litres: m3 * 1000 };
}

/** Assumed overall motor + pump efficiency for the HP helper (Indian farm pumpsets run ~30–50%). */
export const PUMP_EFFICIENCY = 0.4;
const WATTS_PER_HP = 745.7;
const G = 9.81;

/**
 * Rough pump flow (L/s) from motor HP and total lift in metres: Q = P·η / (ρ·g·H).
 * With ρ = 1000 kg/m³ and Q in L/s this is P(W)·η / (g·H).
 */
export function flowFromHp(hp: number, headM: number, efficiency = PUMP_EFFICIENCY): number | null {
  if (!pos(hp) || !pos(headM) || !pos(efficiency)) return null;
  return (hp * WATTS_PER_HP * efficiency) / (G * headM);
}

/** Flow measured by timing how long a drum or bucket takes to fill. */
export function flowFromDrum(litres: number, seconds: number): number | null {
  if (!pos(litres) || !pos(seconds)) return null;
  return litres / seconds;
}

/** Pump running time in seconds to deliver `litres` at `flowLps`. */
export function pumpSeconds(litres: number, flowLps: number): number | null {
  if (!pos(litres) || !pos(flowLps)) return null;
  return litres / flowLps;
}

// ---------- Cost & profit ----------

export function totalOf(values: (number | null | undefined)[]): number {
  return values.reduce<number>((s, v) => s + (pos(v) ? v : 0), 0);
}

export interface ProfitResult {
  totalYieldQtl: number;
  revenue: number;
  profit: number;
  perAcre: number;
  /** ₹/quintal at which revenue equals cost; null when there is no cost or yield */
  breakEven: number | null;
}

export function profitOf(yieldQtlPerAcre: number, acres: number, pricePerQtl: number, cost: number): ProfitResult | null {
  if (!pos(yieldQtlPerAcre) || !pos(acres) || !pos(pricePerQtl)) return null;
  const c = pos(cost) ? cost : 0;
  const totalYieldQtl = yieldQtlPerAcre * acres;
  const revenue = totalYieldQtl * pricePerQtl;
  const profit = revenue - c;
  return { totalYieldQtl, revenue, profit, perAcre: profit / acres, breakEven: c > 0 ? c / totalYieldQtl : null };
}

// ---------- Display rounding ----------

/** Sensible decimals for a quantity: more for small numbers, none for big ones. */
export function decimalsFor(n: number): number {
  const a = Math.abs(n);
  if (a === 0) return 0;
  if (a < 1) return 2;
  if (a < 10) return 2;
  if (a < 100) return 1;
  return 0;
}
