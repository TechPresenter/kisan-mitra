// खेती हिसाब (reference screen 16): expense / income totals, estimated profit, charts and the
// entry list, filtered by season and crop. All data is on-device (KEYS.expenses / KEYS.incomes).
import './strings';
import { useCallback, useMemo, useState } from 'react';
import { Calculator } from 'lucide-react';
import {
  BarChart,
  Button,
  Card,
  Chip,
  EmptyState,
  ListGroup,
  ListRow,
  SectionHeader,
  Screen,
  SegmentedTabs,
  SelectSheet,
  StatCard,
  ToneIcon,
  cx,
  toast,
} from '../../components/ui';
import { EmptyArt } from '../../components/illustrations';
import { formatDate, formatINR, formatNumber, relativeDay, todayISO } from '../../lib/format';
import { useLanguage, useT } from '../../lib/i18n';
import { useNav } from '../../lib/nav';
import { useProfile, useSettings } from '../../lib/app-state';
import { KEYS, useCollection } from '../../lib/store';
import type { Crop, FarmExpense, FarmIncome, ID } from '../../types/models';
import {
  EXPENSE_CATEGORIES,
  acresFor,
  byCategory,
  categoryKey,
  cropLabel,
  defaultPeriod,
  lastDayOf,
  metaFor,
  monthName,
  monthlyTotals,
  periodFilter,
  periodInfo,
  seasonLabel,
  sortEntries,
  sum,
  validAmount,
  type Entry,
  type EntryKind,
  type PeriodKey,
  type SeasonWindow,
} from './hisab-utils';

type Tab = 'expense' | 'income' | 'total';
const PAGE = 30;

export default function HisabScreen() {
  const t = useT();
  const nav = useNav();
  const { language } = useLanguage();
  const lang = language.code;
  const [settings] = useSettings();
  const [profile] = useProfile();
  const expensesCol = useCollection<FarmExpense>(KEYS.expenses);
  const incomesCol = useCollection<FarmIncome>(KEYS.incomes);
  const cropsCol = useCollection<Crop>(KEYS.crops);

  const today = todayISO();
  const [tab, setTab] = useState<Tab>('expense');
  // Opens on this season, or the last one while the new season has no entries yet.
  const [period, setPeriod] = useState<PeriodKey>(() =>
    defaultPeriod(today, cropsCol.items, [...expensesCol.items, ...incomesCol.items]),
  );
  const [cropFilter, setCropFilter] = useState<'all' | ID>('all');
  const [periodOpen, setPeriodOpen] = useState(false);
  const [cropOpen, setCropOpen] = useState(false);
  const [limit, setLimit] = useState(PAGE);

  const seasons = useMemo(() => periodInfo(today), [today]);
  const currentName = seasonLabel(seasons.current, lang);
  const previousName = seasonLabel(seasons.previous, lang);

  const cropsById = useMemo(() => new Map(cropsCol.items.map(c => [c.id, c] as const)), [cropsCol.items]);
  // A crop filter pointing at a deleted crop falls back to "all".
  const activeCrop = cropFilter !== 'all' && cropsById.has(cropFilter) ? cropFilter : 'all';

  const inPeriod = useMemo(() => periodFilter(period, today, cropsCol.items), [period, today, cropsCol.items]);
  const keep = useCallback(
    (e: { date: string; cropId?: ID; amount: number }) =>
      !!e.date && validAmount(e.amount) && inPeriod(e) && (activeCrop === 'all' || e.cropId === activeCrop),
    [inPeriod, activeCrop],
  );
  const expenses = useMemo(() => expensesCol.items.filter(keep), [expensesCol.items, keep]);
  const incomes = useMemo(() => incomesCol.items.filter(keep), [incomesCol.items, keep]);

  const totalExpense = useMemo(() => sum(expenses), [expenses]);
  const totalIncome = useMemo(() => sum(incomes), [incomes]);
  const profit = totalIncome - totalExpense;

  const acres = useMemo(
    () =>
      acresFor(
        activeCrop,
        cropsById,
        [...expenses.map(e => e.cropId), ...incomes.map(i => i.cropId)],
        settings.bighaSqm,
        { area: profile?.landArea, unit: profile?.landUnit },
      ),
    [activeCrop, cropsById, expenses, incomes, settings.bighaSqm, profile?.landArea, profile?.landUnit],
  );

  const categoryTotals = useMemo(() => byCategory(expenses), [expenses]);
  // This season / this year run up to the current month; older views end at their last entry.
  const months = useMemo(
    () =>
      monthlyTotals(tab === 'income' ? [] : expenses, incomes, {
        endMonth: period === 'season' || period === 'year' ? today.slice(0, 7) : undefined,
      }),
    [expenses, incomes, tab, period, today],
  );

  const entries = useMemo(() => {
    const list: Entry[] = [];
    if (tab !== 'income') expenses.forEach(item => list.push({ kind: 'expense', item }));
    if (tab !== 'expense') incomes.forEach(item => list.push({ kind: 'income', item }));
    return sortEntries(list);
  }, [expenses, incomes, tab]);

  const groups = useMemo(() => {
    const out: { date: string; items: Entry[] }[] = [];
    for (const e of entries.slice(0, limit)) {
      const last = out[out.length - 1];
      if (last && last.date === e.item.date) last.items.push(e);
      else out.push({ date: e.item.date, items: [e] });
    }
    return out;
  }, [entries, limit]);

  const hasAnyEntry = expensesCol.items.length > 0 || incomesCol.items.length > 0;
  const add = (kind: EntryKind) => nav.push('hisab-entry', { kind });

  // ---------- Labels ----------

  const periodLabel =
    period === 'season'
      ? t('hisab.period.seasonNamed', { season: currentName })
      : period === 'prevSeason'
        ? t('hisab.period.prevNamed', { season: previousName })
        : period === 'year'
          ? t('hisab.period.year')
          : t('hisab.period.all');
  const cropChipLabel = activeCrop === 'all' ? t('hisab.crop.all') : cropLabel(cropsById.get(activeCrop)!, lang);
  const statHint = `${periodLabel} • ${cropChipLabel}`;

  const seasonDesc = (w: SeasonWindow) =>
    t('hisab.period.seasonDesc', { from: formatDate(w.start, { year: true }), to: formatDate(lastDayOf(w), { year: true }) });
  const periodOptions = [
    { value: 'season' as const, label: t('hisab.period.seasonNamed', { season: currentName }), description: seasonDesc(seasons.current) },
    { value: 'prevSeason' as const, label: t('hisab.period.prevNamed', { season: previousName }), description: seasonDesc(seasons.previous) },
    { value: 'year' as const, label: t('hisab.period.year'), description: t('hisab.period.yearDesc', { year: today.slice(0, 4) }) },
    { value: 'all' as const, label: t('hisab.period.all'), description: t('hisab.period.allDesc') },
  ];

  const cropOptions = useMemo(
    () => [
      { value: 'all', label: t('hisab.crop.all'), description: t('hisab.crop.allDesc') },
      ...cropsCol.items.map(c => ({
        value: c.id,
        label: cropLabel(c, lang),
        description: c.area > 0 ? `${formatNumber(c.area)} ${t(`common.${c.unit}`)}` : undefined,
      })),
    ],
    [cropsCol.items, lang, t],
  );

  const perAcre = acres ? profit / acres : null;

  // ---------- Charts ----------

  const categoryData = useMemo(
    () =>
      EXPENSE_CATEGORIES.filter(c => categoryTotals[c] > 0)
        .sort((a, b) => categoryTotals[b] - categoryTotals[a])
        .map(c => ({
          label: c === 'pesticide' ? t('hisab.catShort.pesticide') : t(`hisab.cat.${c}`),
          full: t(`hisab.cat.${c}`),
          values: [categoryTotals[c]],
        })),
    [categoryTotals, t],
  );
  const top = categoryData[0];

  const monthData = useMemo(
    () =>
      months.map(m => ({
        label: monthName(m.key, lang, 'short'),
        values: tab === 'income' ? [m.income] : [m.income, m.expense],
      })),
    [months, tab, lang],
  );
  // The real range ("मई 2026 – अक्टूबर 2026"), so older months never read as recent ones.
  const monthRange =
    months.length > 1
      ? t('hisab.chart.range', { from: monthName(months[0].key, lang, 'long'), to: monthName(months[months.length - 1].key, lang, 'long') })
      : months.length === 1
        ? monthName(months[0].key, lang, 'long')
        : '';

  // ---------- Render ----------

  const footer = hasAnyEntry ? (
    <div className="grid grid-cols-2 gap-3">
      <Button
        size="lg"
        fullWidth
        variant={tab === 'income' ? 'secondary' : 'primary'}
        onClick={() => add('expense')}
      >
        {t('hisab.addExpense')}
      </Button>
      <Button
        size="lg"
        fullWidth
        variant={tab === 'income' ? 'primary' : 'secondary'}
        onClick={() => add('income')}
      >
        {t('hisab.addIncome')}
      </Button>
    </div>
  ) : undefined;

  return (
    <Screen
      title={t('hisab.title')}
      subtitle={t('hisab.subtitle')}
      actions={[{ icon: Calculator, label: t('hisab.calculators'), onPress: () => nav.push('calculators') }]}
      footer={footer}
    >
      {!hasAnyEntry ? (
        <EmptyState
          art={<EmptyArt kind="money" />}
          title={t('hisab.empty.title')}
          body={t('hisab.empty.body')}
          action={{ label: t('hisab.addExpense'), onPress: () => add('expense') }}
          secondaryAction={{ label: t('hisab.addIncome'), onPress: () => add('income') }}
        />
      ) : (
        <>
          <SegmentedTabs
            ariaLabel={t('hisab.tab.label')}
            idPrefix="hisab"
            value={tab}
            onChange={v => {
              setTab(v);
              setLimit(PAGE);
            }}
            options={[
              { value: 'expense', label: t('hisab.tab.expense') },
              { value: 'income', label: t('hisab.tab.income') },
              { value: 'total', label: t('hisab.tab.total') },
            ]}
          />

          <div role="group" aria-label={t('hisab.filter.label')} className="-mt-1 flex flex-wrap gap-2">
            <Chip label={periodLabel} dropdown selected={period !== 'all'} onClick={() => setPeriodOpen(true)} />
            <Chip
              label={cropChipLabel}
              dropdown
              selected={activeCrop !== 'all'}
              onClick={() =>
                cropsCol.items.length
                  ? setCropOpen(true)
                  : toast.info(t('hisab.crop.noCrops'), { action: { label: t('hisab.crop.addCrop'), onPress: () => nav.push('crop-edit') } })
              }
            />
          </div>

          <section aria-label={t('hisab.title')} className="flex flex-col gap-3">
            <div className="grid grid-cols-2 gap-3">
              <StatCard label={t('hisab.stat.expense')} value={formatINR(totalExpense)} tone="red" />
              <StatCard label={t('hisab.stat.income')} value={formatINR(totalIncome)} tone="green" />
            </div>
            <StatCard
              size="lg"
              tone={profit < 0 ? 'orange' : 'teal'}
              label={profit < 0 ? t('hisab.stat.loss') : t('hisab.stat.profit')}
              value={formatINR(Math.abs(profit))}
              colorValue={profit < 0}
              hint={statHint}
              aside={
                <div className="max-w-[9.5rem] text-right">
                  <div className="text-caption leading-snug text-ink-2">
                    {perAcre != null && perAcre < 0 ? t('hisab.stat.perAcreLoss') : t('hisab.stat.perAcre')}
                  </div>
                  <div className="mt-0.5 text-card-title font-bold text-ink">
                    {perAcre == null ? '—' : formatINR(Math.round(Math.abs(perAcre)))}
                  </div>
                </div>
              }
            />
            <p className="text-caption text-ink-2">
              {acres ? t('hisab.stat.perAcreBasis', { area: formatNumber(acres, 2) }) : t('hisab.stat.perAcreUnknown')}
              {' · '}
              {t('hisab.stat.profitNote')}
            </p>
          </section>

          <div role="tabpanel" id={`hisab-panel-${tab}`} aria-labelledby={`hisab-tab-${tab}`} className="flex flex-col gap-5">
            {entries.length === 0 ? (
              <Card>
                <EmptyState
                  compact
                  art={<EmptyArt kind="money" size={120} />}
                  title={t('hisab.empty.filteredTitle')}
                  body={t(
                    tab === 'expense' ? 'hisab.empty.filteredExpense' : tab === 'income' ? 'hisab.empty.filteredIncome' : 'hisab.empty.filteredAll',
                  )}
                  action={{
                    label: tab === 'income' ? t('hisab.addIncome') : t('hisab.addExpense'),
                    onPress: () => add(tab === 'income' ? 'income' : 'expense'),
                  }}
                  secondaryAction={
                    period !== 'all' || activeCrop !== 'all'
                      ? {
                          label: t('hisab.empty.showAll'),
                          onPress: () => {
                            setPeriod('all');
                            setCropFilter('all');
                          },
                        }
                      : undefined
                  }
                />
              </Card>
            ) : (
              <>
                {tab === 'expense' && categoryData.length > 0 && (
                  <Card>
                    {/* The kit colours a single series green; the title says these are expenses. */}
                    <SectionHeader title={t('hisab.chart.category')} subtitle={t('hisab.chart.categorySub')} as="h3" className="mb-3" />
                    <BarChart
                      title={t('hisab.chart.categoryTitle')}
                      series={[{ key: 'expense', label: t('hisab.tab.expense') }]}
                      data={categoryData.map(d => ({ label: d.label, values: d.values }))}
                      formatValue={n => formatINR(n)}
                    />
                    {top && totalExpense > 0 && (
                      <p className="mt-3 text-small text-ink-2">
                        {t('hisab.chart.top', {
                          category: top.full,
                          amount: formatINR(top.values[0]),
                          pct: Math.round((top.values[0] / totalExpense) * 100),
                        })}
                      </p>
                    )}
                  </Card>
                )}

                {tab !== 'expense' && monthData.length > 0 && (
                  <Card>
                    <SectionHeader
                      title={tab === 'income' ? t('hisab.chart.monthsIncome') : t('hisab.chart.months')}
                      subtitle={monthRange || undefined}
                      as="h3"
                      className="mb-3"
                    />
                    <BarChart
                      title={`${tab === 'income' ? t('hisab.chart.monthsIncomeTitle') : t('hisab.chart.monthsTitle')} (${monthRange})`}
                      series={
                        tab === 'income'
                          ? [{ key: 'income', label: t('hisab.tab.income') }]
                          : [
                              { key: 'income', label: t('hisab.tab.income') },
                              { key: 'expense', label: t('hisab.tab.expense') },
                            ]
                      }
                      data={monthData}
                      formatValue={n => formatINR(n)}
                    />
                  </Card>
                )}

                <section className="flex flex-col gap-3">
                  <SectionHeader
                    title={tab === 'expense' ? t('hisab.list.expenses') : tab === 'income' ? t('hisab.list.incomes') : t('hisab.list.all')}
                  />
                  {groups.map(g => (
                    <DayGroup
                      key={g.date}
                      date={g.date}
                      items={g.items}
                      cropsById={cropsById}
                      lang={lang}
                      onOpen={e => nav.push('hisab-entry', { kind: e.kind, id: e.item.id })}
                    />
                  ))}
                  {entries.length > limit && (
                    <Button variant="ghost" fullWidth onClick={() => setLimit(l => l + PAGE)}>
                      {t('hisab.list.more', { n: Math.min(PAGE, entries.length - limit) })}
                    </Button>
                  )}
                </section>
              </>
            )}
          </div>

          <SelectSheet
            open={periodOpen}
            onClose={() => setPeriodOpen(false)}
            title={t('hisab.period.title')}
            value={period}
            onChange={v => {
              setPeriod(v);
              setLimit(PAGE);
            }}
            options={periodOptions}
          />
          <SelectSheet
            open={cropOpen}
            onClose={() => setCropOpen(false)}
            title={t('hisab.crop.title')}
            value={activeCrop}
            onChange={v => {
              setCropFilter(v);
              setLimit(PAGE);
            }}
            options={cropOptions}
          />
        </>
      )}
    </Screen>
  );
}

// ---------- Entry list ----------

function DayGroup({
  date,
  items,
  cropsById,
  lang,
  onOpen,
}: {
  date: string;
  items: Entry[];
  cropsById: Map<ID, Crop>;
  lang: string;
  onOpen: (e: Entry) => void;
}) {
  const t = useT();
  const net = items.reduce((s, e) => s + (e.kind === 'income' ? e.item.amount : -e.item.amount), 0);
  const rel = relativeDay(date);
  const heading = rel === formatDate(date) ? formatDate(date, { weekday: true }) : rel;
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between gap-2 px-1">
        <h3 className="text-small font-semibold text-ink-2">{heading}</h3>
        {items.length > 1 && (
          <span className={cx('text-caption font-semibold tabular-nums', net < 0 ? 'text-tone-red' : 'text-tone-green')}>
            {t('hisab.list.dayTotal')}: {net < 0 ? '−' : '+'}
            {formatINR(Math.abs(net))}
          </span>
        )}
      </div>
      <ListGroup ariaLabel={heading}>
        {items.map(e => {
          const meta = metaFor(e.kind, e.item.category);
          const catLabel = t(categoryKey(e.kind, e.item.category));
          const crop = e.item.cropId ? cropsById.get(e.item.cropId) : undefined;
          const qty = e.kind === 'income' && e.item.quantityQtl ? t('hisab.row.qty', { qty: formatNumber(e.item.quantityQtl) }) : '';
          const subtitle = [crop ? cropLabel(crop, lang) : e.item.cropId ? t('hisab.crop.removed') : '', qty, e.item.note || '']
            .filter(Boolean)
            .join(' • ');
          const amount = formatINR(e.item.amount);
          return (
            <ListRow
              key={`${e.kind}-${e.item.id}`}
              variant="plain"
              leading={<ToneIcon icon={meta.icon} tone={meta.tone} />}
              title={catLabel}
              subtitle={subtitle || undefined}
              subtitleLines={1}
              trailing={
                <span className={cx('text-body font-bold tabular-nums', e.kind === 'expense' ? 'text-tone-red' : 'text-tone-green')}>
                  {e.kind === 'expense' ? '−' : '+'}
                  {amount}
                </span>
              }
              chevron
              ariaLabel={t(e.kind === 'expense' ? 'hisab.row.expenseAria' : 'hisab.row.incomeAria', { category: catLabel, amount })}
              onPress={() => onOpen(e)}
            />
          );
        })}
      </ListGroup>
    </div>
  );
}
