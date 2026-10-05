// लाभ कैलकुलेटर: expected yield × land × expected price − cost → profit, per acre and the
// break-even price. The price can be prefilled from the cached mandi price (indicative only), and
// the cost follows the cost calculator (scaled to this land) until the farmer types their own.
import { useMemo, useState } from 'react';
import { History, Store } from 'lucide-react';
import { Badge, Button, Card, Disclaimer, LastUpdated, NumberField, toast } from '../../../components/ui';
import { isCropKey } from '../../../data/crop-keys';
import { getCropInfo } from '../../../data/crops';
import { getProfile, usePlace, useSettings } from '../../../lib/app-state';
import { readCache } from '../../../lib/cache';
import { daysBetween, formatDate, formatINR, todayISO } from '../../../lib/format';
import { useT } from '../../../lib/i18n';
import { useNav } from '../../../lib/nav';
import { usePersisted } from '../../../lib/store';
import { MANDI_MAX_AGE_MS, mandiCacheName, maxPriceAgeDays } from '../../../services/mandi';
import type { GeoPlace, ISODate } from '../../../types/models';
import { profitOf } from '../calc-math';
import {
  AreaField,
  CropSelect,
  HowItWorks,
  RestoredNote,
  ResultCard,
  acresOf,
  areaText,
  defaultArea,
  num,
  useTrackOnce,
  type AreaValue,
} from '../parts';
import { COST_KEY, costArea, costTotal, type CostState } from './CostCalc';

const PROFIT_KEY = 'calc.profit';

interface ProfitState {
  cropKey?: string | null;
  yieldQtl?: number | null;
  /** undefined = never set (follows the mandi price); null = cleared by the farmer. */
  price?: number | null;
  /** Where the price came from, so a crop change can drop a mandi price of the old crop. */
  priceFrom?: 'mandi' | 'user';
  /** For a mandi price copied into the field: its price date and fetch time, to flag it later. */
  priceDate?: ISODate;
  priceFetchedAt?: number;
  /** undefined = follows the cost calculator; null = cleared by the farmer. */
  cost?: number | null;
  area?: AreaValue;
  /** Day the inputs were last changed, shown when they come back on a later visit. */
  savedAt?: ISODate;
}

interface MandiQuote {
  price: number;
  market?: string;
  priceDate: string;
  fetchedAt: number;
}

/** Shape of services/mandi's per-crop cache entry (only the fields read here). */
interface CachedCropPrice {
  price: { price: number; market?: string; priceDate?: string } | null;
}

/** The cached mandi price for a crop near `place`, if it is still within its age limit. */
function cachedMandiPrice(place: GeoPlace, cropKey: string | null | undefined): MandiQuote | null {
  if (!cropKey || !isCropKey(cropKey)) return null;
  const entry = readCache<CachedCropPrice>(mandiCacheName(place, cropKey));
  const p = entry?.data?.price;
  if (!entry || !p || !(p.price > 0) || !p.priceDate) return null;
  const age = daysBetween(p.priceDate, todayISO());
  if (age < 0 || age > maxPriceAgeDays(cropKey)) return null;
  return { price: p.price, market: p.market, priceDate: p.priceDate, fetchedAt: entry.fetchedAt };
}

const EMPTY: ProfitState = {};
const EMPTY_COST: CostState = { items: {} };
const hasInputs = (s: ProfitState) => s.yieldQtl != null || s.price != null || s.cost != null || s.area != null;

export default function ProfitCalc() {
  const t = useT();
  const nav = useNav();
  const [settings] = useSettings();
  const [place] = usePlace();
  const [state, setState] = usePersisted<ProfitState>(PROFIT_KEY, EMPTY);
  const [costCalc] = usePersisted<CostState>(COST_KEY, EMPTY_COST);
  const today = todayISO();
  const [initial] = useState(() => {
    const crop = getProfile()?.cropKeys?.find(k => !!getCropInfo(k)) ?? null;
    return { crop, area: defaultArea() };
  });
  // Inputs kept from an earlier day: say when they were entered (null: nothing to flag).
  const [restored, setRestored] = useState<{ savedAt?: ISODate } | null>(() =>
    hasInputs(state) && state.savedAt !== today ? { savedAt: state.savedAt } : null,
  );

  const cropKey = state.cropKey !== undefined ? state.cropKey : initial.crop;
  const yieldQtl = state.yieldQtl ?? null;
  const mandi = useMemo(() => cachedMandiPrice(place, cropKey), [place, cropKey]);
  // Until the farmer sets a price, it starts from the cached mandi price (labelled indicative).
  const price = state.price === undefined ? (mandi?.price ?? null) : state.price;
  // A mandi price copied earlier that is no longer the current cached quote (aged out, other
  // place, or a newer price since): flagged, never shown as today's price.
  const oldMandiPrice =
    state.priceFrom === 'mandi' &&
    state.price != null &&
    !(mandi && mandi.price === state.price && (!state.priceDate || state.priceDate === mandi.priceDate));

  // ---------- Cost: follows the cost calculator until the farmer types one ----------
  const costCalcTotal = costTotal(costCalc);
  const costCalcArea = costArea(costCalc);
  const costCalcAcres = acresOf(costCalcArea, settings.bighaSqm);
  const followCost = state.cost === undefined && costCalcTotal > 0;
  // While following, the land starts as the cost calculator's land so both talk about one field.
  const area = state.area ?? (followCost ? costCalcArea : initial.area);
  const acres = acresOf(area, settings.bighaSqm);
  const sameLand = acres != null && costCalcAcres != null && Math.abs(acres - costCalcAcres) < 0.0005;
  // The cost calculator's total is for its own land; for different land, scale it per acre.
  const scaledCost =
    followCost && acres != null && costCalcAcres != null && !sameLand ? Math.round((costCalcTotal * acres) / costCalcAcres) : null;
  const cost = followCost ? (scaledCost ?? costCalcTotal) : (state.cost ?? null);
  const hasCost = cost != null && cost > 0;

  const result = yieldQtl != null && acres != null && price != null ? profitOf(yieldQtl, acres, price, cost ?? 0) : null;
  const loss = !!result && hasCost && result.profit < 0;

  const edit = useTrackOnce('profit', !!result);
  const patch = edit((p: Partial<ProfitState>) => setState(s => ({ ...s, ...p, savedAt: today })));
  const quotePatch = (q: MandiQuote): Partial<ProfitState> => ({
    price: q.price,
    priceFrom: 'mandi',
    priceDate: q.priceDate,
    priceFetchedAt: q.fetchedAt,
  });
  const pickCrop = (key: string) => {
    const quote = cachedMandiPrice(place, key);
    if (quote) patch({ cropKey: key, ...quotePatch(quote) });
    // The old crop's mandi rate is wrong for the new crop; a price the farmer typed stays.
    else if (state.priceFrom !== 'user') patch({ cropKey: key, price: null, priceFrom: undefined, priceDate: undefined, priceFetchedAt: undefined });
    else patch({ cropKey: key });
  };

  const missing = [
    yieldQtl == null || !(yieldQtl > 0) ? t('calc.profit.yield') : null,
    acres == null ? t('calc.area.label') : null,
    price == null || !(price > 0) ? t('calc.profit.price') : null,
  ].filter((x): x is string => !!x);

  const openMandi = () => cropKey && nav.push('mandi-detail', { commodityKey: cropKey });

  const clearAll = () => {
    const prev = state;
    const prevRestored = restored;
    setState({ savedAt: today });
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
        {restored && <RestoredNote savedAt={restored.savedAt} onClear={clearAll} />}

        <CropSelect label={t('calc.profit.crop')} value={cropKey ?? null} onChange={pickCrop} />

        <NumberField
          label={t('calc.profit.yield')}
          hint={t('calc.profit.yieldHint')}
          value={yieldQtl}
          onChange={v => patch({ yieldQtl: v })}
          unit={t('calc.profit.yieldUnit')}
          min={0}
          max={5000}
        />

        <AreaField value={area} onChange={a => patch({ area: a })} error={area.value === 0 ? t('calc.area.error') : undefined} />

        <div className="flex flex-col gap-2">
          <NumberField
            label={t('calc.profit.price')}
            value={price}
            onChange={v => patch({ price: v, priceFrom: 'user', priceDate: undefined, priceFetchedAt: undefined })}
            prefix="₹"
            unit={t('common.perQuintal')}
            min={0}
            max={10_00_000}
          />
          {oldMandiPrice && (
            <div className="flex flex-col gap-1.5 rounded-xl bg-tint-amber px-3.5 py-3 hc:border hc:border-line" role="status">
              <div className="flex flex-wrap items-center gap-2">
                <History aria-hidden className="size-4.5 shrink-0 text-tone-amber" />
                <span className="text-small font-semibold text-ink">
                  {state.priceDate ? t('calc.profit.oldMandi', { date: formatDate(state.priceDate) }) : t('calc.profit.oldMandiNoDate')}
                </span>
              </div>
              <p className="text-caption text-ink-2">{t('calc.profit.oldMandiHint')}</p>
              <LastUpdated at={state.priceFetchedAt} stale />
              {cropKey && !mandi && (
                <Button size="md" variant="soft" className="self-start" onClick={openMandi}>
                  {t('calc.profit.openMandi')}
                </Button>
              )}
            </div>
          )}
          {cropKey && mandi ? (
            <div className="flex flex-col gap-1.5 rounded-xl bg-surface-2 px-3.5 py-3 hc:border hc:border-line">
              <div className="flex flex-wrap items-center gap-2">
                <Store aria-hidden className="size-4.5 shrink-0 text-brand" />
                <span className="text-small font-semibold text-ink">{t('calc.profit.mandi', { price: formatINR(mandi.price) })}</span>
                <Badge tone="amber">{t('calc.profit.indicative')}</Badge>
              </div>
              <p className="text-caption text-ink-2">
                {t('calc.profit.mandiMeta', { market: mandi.market || '—', date: formatDate(mandi.priceDate) })}
              </p>
              <LastUpdated at={mandi.fetchedAt} stale={Date.now() - mandi.fetchedAt > MANDI_MAX_AGE_MS} />
              {(price !== mandi.price || oldMandiPrice) && (
                <Button size="md" variant="soft" className="self-start" onClick={() => patch(quotePatch(mandi))}>
                  {t('calc.profit.useMandi')}
                </Button>
              )}
            </div>
          ) : cropKey && !oldMandiPrice ? (
            <div className="flex flex-wrap items-center gap-x-2">
              <p className="text-caption text-ink-2">{t('calc.profit.noMandi')}</p>
              <Button size="md" variant="ghost" className="-ml-2" onClick={openMandi}>
                {t('calc.profit.openMandi')}
              </Button>
            </div>
          ) : null}
        </div>

        <div className="flex flex-col gap-2">
          <NumberField
            label={t('calc.profit.cost')}
            hint={t('calc.profit.costHint')}
            value={cost}
            // Keep the land shown now: while following, it came from the cost calculator.
            onChange={v => patch({ cost: v, area: state.area ?? area })}
            prefix="₹"
            integer
            min={0}
            max={10_00_00_000}
          />
          {followCost ? (
            <p className="text-caption text-ink-2">
              {scaledCost != null
                ? t('calc.profit.costScaled', {
                    amount: formatINR(costCalcTotal),
                    area: areaText(t, costCalcArea),
                    acres: num(acres!, 2),
                    scaled: formatINR(scaledCost),
                  })
                : t('calc.profit.costFromCalc', { amount: formatINR(costCalcTotal), area: areaText(t, costCalcArea) })}
            </p>
          ) : costCalcTotal > 0 ? (
            !(state.cost === costCalcTotal && sameLand) && (
              // Takes the cost together with its land, so profit, per acre and break-even match.
              <Button size="md" variant="soft" className="self-start" onClick={() => patch({ cost: undefined, area: costCalcArea })}>
                {t('calc.profit.useCost', { amount: formatINR(costCalcTotal), area: areaText(t, costCalcArea) })}
              </Button>
            )
          ) : (
            <Button size="md" variant="ghost" className="-ml-2 self-start" onClick={() => nav.push('calculator', { kind: 'cost' })}>
              {t('calc.profit.findCost')}
            </Button>
          )}
        </div>
      </Card>

      <ResultCard
        label={!result ? t('calc.profit.resultProfit') : !hasCost ? t('calc.profit.resultRevenue') : loss ? t('calc.profit.resultLoss') : t('calc.profit.resultProfit')}
        ready={!!result}
        tone={loss ? 'loss' : 'brand'}
        value={result ? formatINR(Math.round(hasCost ? Math.abs(result.profit) : result.revenue)) : undefined}
        waiting={missing.length ? t('calc.profit.need', { fields: missing.join(', ') }) : undefined}
      >
        {result && (
          <>
            <p>{t('calc.profit.totalYield', { n: num(result.totalYieldQtl, 1) })}</p>
            {hasCost ? (
              <>
                <p>{t('calc.profit.revenue', { amount: formatINR(Math.round(result.revenue)) })}</p>
                <p>{t('calc.profit.costLine', { amount: formatINR(cost!) })}</p>
                <p className="font-semibold">
                  {result.perAcre < 0
                    ? t('calc.profit.perAcreLoss', { amount: formatINR(Math.round(Math.abs(result.perAcre))) })
                    : t('calc.profit.perAcre', { amount: formatINR(Math.round(result.perAcre)) })}
                </p>
                {result.breakEven != null && (
                  <p>
                    <span className="font-semibold">{t('calc.profit.breakEven', { price: formatINR(Math.round(result.breakEven)) })}</span>
                    <span className="block text-small text-ink-2">{t('calc.profit.breakEvenHint')}</span>
                  </p>
                )}
              </>
            ) : (
              <p className="font-semibold text-tone-amber">{t('calc.profit.noCost')}</p>
            )}
          </>
        )}
      </ResultCard>

      <Disclaimer kind="price" />
      <p className="-mt-2 text-caption text-ink-2">{t('calc.profit.note')}</p>

      <HowItWorks
        steps={
          result && yieldQtl != null && price != null && acres != null
            ? [
                t('calc.profit.howYield', { yield: num(yieldQtl), acres: num(acres, 3), total: num(result.totalYieldQtl, 1) }),
                t('calc.profit.howRevenue', { total: num(result.totalYieldQtl, 1), price: formatINR(price), revenue: formatINR(Math.round(result.revenue)) }),
                scaledCost != null &&
                  t('calc.profit.howScaled', {
                    amount: formatINR(costCalcTotal),
                    costAcres: num(costCalcAcres!, 3),
                    acres: num(acres, 3),
                    scaled: formatINR(scaledCost),
                  }),
                hasCost &&
                  t('calc.profit.howProfit', {
                    revenue: formatINR(Math.round(result.revenue)),
                    cost: formatINR(cost!),
                    profit: `${result.profit < 0 ? '−' : ''}${formatINR(Math.round(Math.abs(result.profit)))}`,
                  }),
                hasCost &&
                  result.breakEven != null &&
                  t('calc.profit.howBreakEven', {
                    cost: formatINR(cost!),
                    total: num(result.totalYieldQtl, 1),
                    be: formatINR(Math.round(result.breakEven)),
                  }),
              ]
            : []
        }
      />
    </>
  );
}
