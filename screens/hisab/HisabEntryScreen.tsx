// Add or edit one expense / income entry ('hisab-entry' { kind: 'expense'|'income', id? }).
import './strings';
import { useMemo, useRef, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import {
  Button,
  Card,
  DateField,
  EmptyState,
  MicButton,
  NumberField,
  RadioCards,
  Screen,
  SelectField,
  TextArea,
  confirm,
  toast,
} from '../../components/ui';
import { EmptyArt } from '../../components/illustrations';
import { isValidISODate } from '../../data/crops';
import { track } from '../../lib/analytics';
import { formatINR, formatNumber, todayISO } from '../../lib/format';
import { useLanguage, useT } from '../../lib/i18n';
import { useNav, useRoute } from '../../lib/nav';
import { KEYS, newId, useCollection } from '../../lib/store';
import type { Crop, ExpenseCategory, FarmExpense, FarmIncome, IncomeCategory } from '../../types/models';
import {
  EXPENSE_CATEGORIES,
  EXPENSE_META,
  INCOME_CATEGORIES,
  INCOME_META,
  cropLabel,
  isExpenseCategory,
  isIncomeCategory,
  type EntryKind,
} from './hisab-utils';

const MAX_AMOUNT = 10_00_00_000; // ₹10 crore: anything above is almost surely a typo
const NOTE_MAX = 200;
const NO_CROP = 'none';

export default function HisabEntryScreen() {
  const t = useT();
  const nav = useNav();
  const { language } = useLanguage();
  const { params } = useRoute<{ kind?: string; id?: string }>();
  const expenses = useCollection<FarmExpense>(KEYS.expenses);
  const incomes = useCollection<FarmIncome>(KEYS.incomes);
  const crops = useCollection<Crop>(KEYS.crops);
  const leaving = useRef(false);

  const id = typeof params.id === 'string' && params.id ? params.id : undefined;
  // Read the record once: later store changes (or our own delete) never reset the form. The
  // stored record decides the kind, so a mismatched param cannot misfile an edit.
  const [{ initial, kind }] = useState<{ initial?: FarmExpense | FarmIncome; kind: EntryKind }>(() => {
    const exp = id ? expenses.get(id) : undefined;
    if (exp) return { initial: exp, kind: 'expense' };
    const inc = id ? incomes.get(id) : undefined;
    if (inc) return { initial: inc, kind: 'income' };
    return { kind: params.kind === 'income' ? 'income' : 'expense' };
  });
  const [category, setCategory] = useState<string | null>(initial?.category ?? null);
  const [amount, setAmount] = useState<number | null>(initial?.amount ?? null);
  const [date, setDate] = useState<string>(initial?.date ?? todayISO());
  const [cropId, setCropId] = useState<string>(initial?.cropId ?? NO_CROP);
  const initialQty = initial && 'quantityQtl' in initial ? initial.quantityQtl ?? null : null;
  const [qty, setQty] = useState<number | null>(initialQty);
  const [rate, setRate] = useState<number | null>(
    initialQty && initial?.amount ? Math.round((initial.amount / initialQty) * 100) / 100 : null,
  );
  const [note, setNote] = useState(initial?.note ?? '');
  const [showErrors, setShowErrors] = useState(false);
  const [saving, setSaving] = useState(false);

  const today = todayISO();
  const editing = !!initial;
  // A missing record (deleted elsewhere) still came from an edit link.
  const editTitle = editing || !!id;

  const categoryOptions = useMemo(
    () =>
      kind === 'expense'
        ? EXPENSE_CATEGORIES.map(c => ({ value: c as string, label: t(`hisab.cat.${c}`), icon: EXPENSE_META[c].icon, tone: EXPENSE_META[c].tone }))
        : INCOME_CATEGORIES.map(c => ({
            value: c as string,
            label: t(`hisab.inc.${c}`),
            description: t(`hisab.incDesc.${c}`),
            icon: INCOME_META[c].icon,
            tone: INCOME_META[c].tone,
          })),
    [kind, t],
  );

  const cropOptions = useMemo(() => {
    const opts = [
      { value: NO_CROP, label: t('hisab.entry.cropNone') },
      ...crops.items.map(c => ({
        value: c.id,
        label: c.area > 0 ? `${cropLabel(c, language.code)} (${formatNumber(c.area)} ${t(`common.${c.unit}`)})` : cropLabel(c, language.code),
      })),
    ];
    if (cropId !== NO_CROP && !crops.items.some(c => c.id === cropId)) opts.push({ value: cropId, label: t('hisab.crop.removed') });
    return opts;
  }, [crops.items, cropId, language.code, t]);

  // ---------- Validation ----------

  const validCategory = kind === 'expense' ? isExpenseCategory(category) : isIncomeCategory(category);
  const amountError =
    amount == null || !(amount > 0) ? t('hisab.entry.amountError') : amount > MAX_AMOUNT ? t('hisab.entry.amountTooBig') : undefined;
  const dateError = !isValidISODate(date) || date > today ? t('hisab.entry.dateError') : undefined;
  const categoryError = validCategory ? undefined : kind === 'expense' ? t('hisab.entry.category') : t('hisab.entry.incomeCategory');
  const valid = validCategory && !amountError && !dateError;

  const calcAmount = qty && rate && qty > 0 && rate > 0 ? Math.round(qty * rate) : null;

  // ---------- Actions ----------

  const save = () => {
    if (!valid || amount == null || !category) {
      setShowErrors(true);
      toast.error(t('hisab.entry.fixErrors'));
      return;
    }
    setSaving(true);
    const now = new Date().toISOString();
    const crop = cropId !== NO_CROP ? crops.get(cropId) : undefined;
    const base = {
      id: initial?.id ?? newId(kind === 'expense' ? 'exp_' : 'inc_'),
      amount: Math.round(amount),
      date,
      cropId: cropId !== NO_CROP ? cropId : undefined,
      // The farm follows the chosen crop; no crop (or a crop without a farm) means no farm link.
      farmId: crop?.farmId,
      note: note.trim() || undefined,
      createdAt: initial?.createdAt ?? now,
    };
    if (kind === 'expense') {
      expenses.upsert({ ...base, category: category as ExpenseCategory });
    } else {
      incomes.upsert({ ...base, category: category as IncomeCategory, quantityQtl: qty && qty > 0 ? qty : undefined });
    }
    if (!editing) track('expense_added', { kind, category });
    toast.success(editing ? t('hisab.entry.updated') : t('hisab.entry.saved'));
    leaving.current = true;
    nav.pop();
  };

  const remove = async () => {
    if (!initial) return;
    const ok = await confirm({
      title: t('common.confirmDelete'),
      message: t('hisab.entry.deleteBody'),
      tone: 'danger',
      icon: Trash2,
      confirmLabel: t('common.delete'),
    });
    if (!ok) return;
    const snapshot = initial;
    if (kind === 'expense') expenses.remove(snapshot.id);
    else incomes.remove(snapshot.id);
    toast.success(t('hisab.entry.deleted'), {
      action: {
        label: t('hisab.entry.undo'),
        onPress: () => (kind === 'expense' ? expenses.upsert(snapshot as FarmExpense) : incomes.upsert(snapshot as FarmIncome)),
      },
    });
    leaving.current = true;
    nav.pop();
  };

  const onQty = (q: number | null) => {
    setQty(q);
    if (q && q > 0 && rate && rate > 0) setAmount(Math.round(q * rate));
  };
  const onRate = (r: number | null) => {
    setRate(r);
    if (r && r > 0 && qty && qty > 0) setAmount(Math.round(qty * r));
  };

  const title =
    kind === 'expense'
      ? t(editTitle ? 'hisab.entry.editExpense' : 'hisab.entry.addExpense')
      : t(editTitle ? 'hisab.entry.editIncome' : 'hisab.entry.addIncome');

  // ---------- Missing record ----------

  if (id && !initial && !leaving.current) {
    return (
      <Screen title={title} subtitle={t('hisab.entry.subtitle')}>
        <EmptyState
          art={<EmptyArt kind="money" />}
          title={t('hisab.entry.notFound')}
          body={t('hisab.entry.notFoundBody')}
          action={{ label: t('hisab.entry.backToHisab'), onPress: () => (nav.canGoBack ? nav.pop() : nav.replace('hisab')) }}
        />
      </Screen>
    );
  }

  return (
    <Screen
      title={title}
      subtitle={t('hisab.entry.subtitle')}
      actions={editing ? [{ icon: Trash2, label: t('common.delete'), onPress: remove }] : undefined}
      footer={
        <Button fullWidth size="lg" loading={saving} onClick={save}>
          {t('hisab.entry.save')}
        </Button>
      }
    >
      <RadioCards
        label={kind === 'expense' ? t('hisab.entry.category') : t('hisab.entry.incomeCategory')}
        columns={kind === 'expense' ? 3 : 1}
        value={category}
        onChange={v => setCategory(v)}
        options={categoryOptions}
        hint={
          kind !== 'expense'
            ? undefined
            : isExpenseCategory(category)
              ? `${t(`hisab.cat.${category}`)}: ${t(`hisab.catDesc.${category}`)}`
              : t('hisab.entry.categoryHint')
        }
        error={showErrors ? categoryError : undefined}
      />

      <Card className="flex flex-col gap-4">
        {kind === 'income' && (
          <div className="flex flex-col gap-2">
            <div className="grid grid-cols-2 gap-3">
              <NumberField
                label={t('hisab.entry.qty')}
                optional
                value={qty}
                onChange={onQty}
                unit={t('common.quintal')}
                min={0}
                max={100000}
              />
              <NumberField
                label={t('hisab.entry.rate')}
                optional
                value={rate}
                onChange={onRate}
                prefix="₹"
                unit={t('common.perQuintal')}
                min={0}
                max={1000000}
              />
            </div>
            <p className="text-caption text-ink-2" aria-live="polite">
              {calcAmount != null
                ? t('hisab.entry.qtyRateCalc', { qty: formatNumber(qty!), rate: formatINR(rate!), amount: formatINR(calcAmount) })
                : t('hisab.entry.qtyRateHint')}
            </p>
            {calcAmount != null && amount !== calcAmount && (
              <Button size="md" variant="soft" className="self-start" onClick={() => setAmount(calcAmount)}>
                {t('hisab.entry.useCalc')}
              </Button>
            )}
          </div>
        )}

        <NumberField
          label={t('hisab.entry.amount')}
          hint={t('hisab.entry.amountHint')}
          value={amount}
          onChange={setAmount}
          prefix="₹"
          integer
          min={0}
          max={MAX_AMOUNT}
          className="text-[1.625rem] font-bold"
          error={showErrors ? amountError : undefined}
        />

        <DateField
          label={t('hisab.entry.date')}
          value={date}
          onChange={setDate}
          max={today}
          error={showErrors ? dateError : undefined}
        />

        {crops.items.length > 0 || cropId !== NO_CROP ? (
          <SelectField
            label={t('hisab.entry.crop')}
            optional
            hint={t('hisab.entry.cropHint')}
            value={cropId}
            onChange={setCropId}
            options={cropOptions}
          />
        ) : (
          // No crops yet: say why a crop helps and how to add one (the entry is kept as typed).
          <div className="flex flex-col gap-1.5">
            <span className="text-small font-semibold text-ink">{t('hisab.entry.crop')}</span>
            <p className="text-caption text-ink-2">{t('hisab.entry.noCropsHint')}</p>
            <Button size="md" variant="ghost" icon={Plus} className="-ml-2 self-start" onClick={() => nav.push('crop-edit')}>
              {t('hisab.crop.addCrop')}
            </Button>
          </div>
        )}

        <TextArea
          label={t('hisab.entry.note')}
          optional
          value={note}
          onChange={setNote}
          maxLength={NOTE_MAX}
          rows={2}
          placeholder={t('hisab.entry.notePlaceholder')}
          trailing={<MicButton size="sm" onResult={text => setNote(n => (n ? `${n} ${text}` : text).slice(0, NOTE_MAX))} />}
        />
      </Card>
    </Screen>
  );
}
