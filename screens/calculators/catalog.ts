// The calculator kinds ('calculator' { kind }) with their tile icon and tone.
import { Droplets, FlaskConical, LandPlot, Receipt, SprayCan, Sprout, TrendingUp, Weight } from 'lucide-react';
import type { Tone } from '../../components/ui';

export type CalcKind = 'seed' | 'fertilizer' | 'pesticide' | 'irrigation' | 'cost' | 'profit' | 'area' | 'weight';

export interface CalcDef {
  kind: CalcKind;
  icon: typeof Sprout;
  tone: Tone;
  /** 'farm' calculators come first; 'units' are the converters. */
  group: 'farm' | 'units';
}

export const CALCULATORS: readonly CalcDef[] = [
  { kind: 'seed', icon: Sprout, tone: 'green', group: 'farm' },
  { kind: 'fertilizer', icon: FlaskConical, tone: 'amber', group: 'farm' },
  { kind: 'pesticide', icon: SprayCan, tone: 'red', group: 'farm' },
  { kind: 'irrigation', icon: Droplets, tone: 'sky', group: 'farm' },
  { kind: 'cost', icon: Receipt, tone: 'orange', group: 'farm' },
  { kind: 'profit', icon: TrendingUp, tone: 'indigo', group: 'farm' },
  { kind: 'area', icon: LandPlot, tone: 'teal', group: 'units' },
  { kind: 'weight', icon: Weight, tone: 'rose', group: 'units' },
];

export const isCalcKind = (k: unknown): k is CalcKind => typeof k === 'string' && CALCULATORS.some(c => c.kind === k);
export const calcDef = (k: CalcKind): CalcDef => CALCULATORS.find(c => c.kind === k)!;
