// खेती लागत: editable cost lines (seed, fertilizer … other) → total and per acre. Inputs are kept
// on the phone (calc.cost) so the profit calculator can reuse the total, and can be filled from
// the farmer's own Hisab expenses.
import { useMemo, useState } from 'react';
import { ClipboardList, Eraser } from 'lucide-react';
import { Button, Card, NumberField, SelectSheet, SectionHeader, toast } from '../../../components/ui';
import { useSettings } from '../../../lib/app-state';
import { formatINR, todayISO } from '../../../lib/format';
import { useLanguage, useT } from '../../../lib/i18n';
import { useNav } from '../../../lib/nav';
import { KEYS, useCollection, usePersisted } from '../../../lib/store';
import type { Crop, ExpenseCategory, FarmExpense, ISODate } from '../../../types/models';
import { EXPENSE_CATEGORIES, byCategory, cropLabel, periodFilter, periodInfo, seasonLabel, sum } from '../../hisab/hisab-utils';
import { totalOf } from '../calc-math';
import { AreaField, HowItWorks, RestoredNote, ResultCard, acresOf, defaultArea, num, useTrackOnce, type AreaValue } from '../parts';

export const COST_KEY = 'calc.cost';

export interface CostState {
  items: Partial<Record<ExpenseCategory, number>>;
  area?: AreaValue;
  /** Day the numbers were last changed, shown when they come back on a later visit. */
  savedAt?: ISODate;
}

/** Total of a saved cost state. */
export const costTotal = (s: CostState) => totalOf(Object.values(s.items ?? {}));

/** The land a saved cost was entered for (the cost calculator's own default when not set). */
export const costArea = (s: CostState): AreaValue => s.area ?? defaultArea();

const EMPTY: CostState = { items: {} };
const SEASON = '__season';
const PREV_SEASON = '__prevSeason';

export default function CostCalc() {
  const t = useT();
  const nav = useNav();
  const { language } = useLanguage();
  const [settings] = useSettings();
  const [state, setState] = usePersisted<CostState>(COST_KEY, EMPTY);
  const [fallbackArea] = useState<AreaValue>(defaultArea);
  const [pickOpen, setPickOpen] = useState(false);
  const expenses = useCollection<FarmExpense>(KEYS.expenses);
  const crops = useCollection<Crop>(KEYS.crops);
  const today = todayISO();
  // Numbers kept from an earlier day: say when they were entered (null: nothing to flag).
  const [restored, setRestored] = useState<{ savedAt?: ISODate } | null>(() =>
    costTotal(state) > 0 && state.savedAt !== today ? { savedAt: state.savedAt } : null,
  );

  const items = state.items ?? {};
  const area = state.area ?? fallbackArea;
  const total = totalOf(EXPENSE_CATEGORIES.map(c => items[c]));
  const acres = acresOf(area, settings.bighaSqm);
  const ready = total > 0;
  const edit = useTrackOnce('cost', ready);

  const setArea = edit((a: AreaValue) => setState(s => ({ ...s, area: a, savedAt: today })));
  const setItem = (c: ExpenseCategory, v: number | null) =>
    setState(s => {
      const next = { ...(s.items ?? {}) };
      if (v == null || !(v > 0)) delete next[c];
      else next[c] = v;
      return { ...s, items: next, savedAt: today };
    });

  const biggest = useMemo(() => {
    let best: ExpenseCategory | null = null;
    for (const c of EXPENSE_CATEGORIES) if ((items[c] ?? 0) > (best ? items[best] ?? 0 : 0)) best = c;
    return best;
  }, [items]);

  // ---------- Fill from Hisab ----------

  /** Expenses behind each "fill from" choice: this / last season (same rules as Hisab) or one crop. */
  const listFor = (value: string): FarmExpense[] => {
    if (value === SEASON || value === PREV_SEASON) {
      const keep = periodFilter(value === SEASON ? 'season' : 'prevSeason', today, crops.items);
      return expenses.items.filter(keep);
    }
    return expenses.items.filter(e => e.cropId === value);
  };

  const fillOptions = useMemo(() => {
    const seasons = periodInfo(today);
    const opts: { value: string; label: string; description: string }[] = [];
    const seasonOpt = (value: string, name: string) => {
      const list = listFor(value);
      if (list.length)
        opts.push({
          value,
          label: t('calc.cost.fromSeason', { season: name }),
          description: t('calc.cost.fromHisabDesc', { amount: formatINR(sum(list)), n: list.length }),
        });
    };
    seasonOpt(SEASON, seasonLabel(seasons.current, language.code));
    seasonOpt(PREV_SEASON, seasonLabel(seasons.previous, language.code));
    for (const c of crops.items) {
      const list = listFor(c.id);
      if (!list.length) continue;
      opts.push({
        value: c.id,
        label: cropLabel(c, language.code),
        description: t('calc.cost.fromHisabDesc', { amount: formatINR(sum(list)), n: list.length }),
      });
    }
    return opts;
    // listFor only reads the values listed here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expenses.items, crops.items, language.code, t, today]);

  const fillFrom = edit((value: string) => {
    const crop = value === SEASON || value === PREV_SEASON ? undefined : crops.get(value);
    const totals = byCategory(listFor(value));
    const nextItems: CostState['items'] = {};
    for (const c of EXPENSE_CATEGORIES) if (totals[c] > 0) nextItems[c] = Math.round(totals[c]);
    const prev = state;
    const prevRestored = restored;
    setState(s => ({
      items: nextItems,
      area: crop && crop.area > 0 ? { value: crop.area, unit: crop.unit } : s.area,
      savedAt: today,
    }));
    setRestored(null);
    toast.success(t('calc.cost.filled'), {
      action: {
        label: t('hisab.entry.undo'),
        onPress: () => {
          setState(prev);
          setRestored(prevRestored);
        },
      },
    });
  });

  const clear = () => {
    const prev = state;
    const prevRestored = restored;
    setState(s => ({ ...s, items: {}, savedAt: today }));
    setRestored(null);
    toast(t('calc.cost.cleared'), {
      action: {
        label: t('hisab.entry.undo'),
        onPress: () => {
          setState(prev);
          setRestored(prevRestored);
        },
      },
    });
  };

  return (
    <>
      <Card className="flex flex-col gap-4">
        <AreaField value={area} onChange={setArea} error={area.value === 0 ? t('calc.area.error') : undefined} />
      </Card>

      <Card className="flex flex-col gap-4">
        <SectionHeader title={t('calc.cost.items')} subtitle={t('calc.cost.itemsHint')} as="h2" />
        {ready && restored && <RestoredNote savedAt={restored.savedAt} onClear={clear} />}
        {fillOptions.length > 0 && (
          <Button variant="secondary" icon={ClipboardList} fullWidth onClick={() => setPickOpen(true)}>
            {t('calc.cost.fromHisab')}
          </Button>
        )}
        <div className="grid grid-cols-2 items-start gap-3">
          {EXPENSE_CATEGORIES.map(c => (
            <NumberField
              key={c}
              label={t(`hisab.cat.${c}`)}
              prefix="₹"
              value={items[c] ?? null}
              onChange={edit((v: number | null) => setItem(c, v))}
              integer
              min={0}
              max={10_00_00_000}
            />
          ))}
        </div>
        <p className="text-caption text-ink-2">{t('calc.cost.ownNote')}</p>
        {ready && !restored && (
          <Button variant="ghost" icon={Eraser} className="self-start" onClick={clear}>
            {t('calc.cost.clear')}
          </Button>
        )}
      </Card>

      <ResultCard label={t('calc.cost.result')} ready={ready} value={formatINR(total)}>
        {acres != null && <p className="font-semibold">{t('calc.cost.perAcre', { amount: formatINR(Math.round(total / acres)) })}</p>}
        {biggest && total > 0 && (
          <p className="text-small text-ink-2">
            {t('calc.cost.biggest', { category: t(`hisab.cat.${biggest}`), pct: Math.round(((items[biggest] ?? 0) / total) * 100) })}
          </p>
        )}
      </ResultCard>

      {ready && (
        <Button variant="secondary" size="lg" fullWidth onClick={() => nav.push('calculator', { kind: 'profit' })}>
          {t('calc.cost.toProfit')}
        </Button>
      )}

      <HowItWorks
        steps={
          ready
            ? [
                t('calc.cost.howTotal', { total: formatINR(total) }),
                acres != null && t('calc.cost.howPerAcre', { total: formatINR(total), acres: num(acres, 3), perAcre: formatINR(Math.round(total / acres)) }),
              ]
            : []
        }
      />

      <SelectSheet
        open={pickOpen}
        onClose={() => setPickOpen(false)}
        title={t('calc.cost.fromHisabTitle')}
        value={null}
        onChange={fillFrom}
        options={fillOptions}
      />
    </>
  );
}
