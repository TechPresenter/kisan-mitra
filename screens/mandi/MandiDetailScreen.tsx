// 09 Mandi details ('mandi-detail', { commodityKey }): one crop's latest indicative price near the
// selected place, the previous price, our own 7-day trend, nearby mandis to compare, the AI बाज़ार
// संकेत, and save / watchlist / share / "मंडी विश्लेषण पूछें" actions. Never guarantees future prices.
import './strings';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  ArrowDownToLine,
  ArrowUpToLine,
  Bookmark,
  BookmarkCheck,
  ListPlus,
  MapPin,
  RefreshCw,
  Share2,
  Sparkles,
  Store,
  TrendingUp,
} from 'lucide-react';
import {
  Badge,
  Button,
  Card,
  Disclaimer,
  EmptyState,
  ErrorState,
  LastUpdated,
  LineChart,
  ListGroup,
  ListRow,
  OfflineBanner,
  Screen,
  SectionHeader,
  SkeletonCard,
  StatCard,
  Toggle,
  ToneIcon,
  TrendBadge,
  cx,
  toast,
} from '../../components/ui';
import { CropArt, EmptyArt } from '../../components/illustrations';
import { LocationSheet } from '../../components/shared/LocationSheet';
import { track } from '../../lib/analytics';
import { placeLabel, usePlace } from '../../lib/app-state';
import { useOnline } from '../../lib/cache';
import { addDays, formatDate, formatINR, formatNumber } from '../../lib/format';
import { useLanguage, useT } from '../../lib/i18n';
import { useNav, useRoute } from '../../lib/nav';
import { cropName, isCropKey } from '../../data/crop-keys';
import { MandiError, historyStats, useMandi, usePriceHistory, type MandiPriceExt } from '../../services/mandi';
import { shareText } from '../../services/native';
import { useSaved } from '../../services/saved';
import {
  MarketSignalCard,
  PortalsCard,
  SourcesCard,
  WATCHLIST_MAX,
  priceDateLabel,
  priceName,
  sameMarket,
  shortDate,
  useMandiWatchlist,
} from './parts';

const NO_KEYS: string[] = [];

/** Hero: crop, today's price per quintal, price date, mandi and the day's high / low. */
function PriceHero({ p, lang, footer }: { p: MandiPriceExt; lang: string; footer?: ReactNode }) {
  const t = useT();
  const name = priceName(p, lang);
  const hasRange = p.minPrice !== undefined && p.maxPrice !== undefined;
  return (
    <Card as="section" aria-label={name}>
      <div className="flex items-center gap-3">
        <CropArt crop={p.commodityKey} size={72} />
        <div className="min-w-0 flex-1">
          <h2 className="text-section leading-snug font-bold text-ink">{name}</h2>
          <p className="mt-0.5 flex items-center gap-1 text-small text-ink-2">
            <MapPin aria-hidden className="size-4 shrink-0 text-ink-3" />
            <span className="min-w-0 truncate pt-0.5">{p.market}</span>
          </p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2">
        <p className="min-w-0">
          <span className="sr-only">{t('mandi.detail.priceA11y', { price: formatINR(p.price) })}</span>
          <span aria-hidden className="text-hero leading-tight font-bold text-brand tabular-nums">
            {formatINR(p.price)}
          </span>
          <span aria-hidden className="ml-1.5 text-body font-medium text-ink-2">
            / {t('common.quintal')}
          </span>
        </p>
        {p.changePct !== undefined && <TrendBadge value={p.changePct} variant="pill" />}
      </div>
      {/* The date the mandi reported this price; tinted when it is two or more days old. */}
      <p className={cx('mt-1 text-small', p.ageDays >= 2 ? 'font-medium text-tone-amber' : 'text-ink-2')}>{priceDateLabel(t, p)}</p>

      {hasRange && (
        <div className="mt-4">
          <p className="mb-2 text-small font-medium text-ink-2">{t('mandi.detail.dayRange')}</p>
          <div className="grid grid-cols-2 gap-3">
            <StatCard label={t('mandi.detail.max')} value={formatINR(p.maxPrice as number)} tone="green" icon={ArrowUpToLine} />
            <StatCard label={t('mandi.detail.min')} value={formatINR(p.minPrice as number)} tone="amber" icon={ArrowDownToLine} />
          </div>
        </div>
      )}
      {footer}
    </Card>
  );
}

/** "कल का भाव" / "पिछला भाव" with its date, where it came from and the change. */
function PreviousPrice({ p }: { p: MandiPriceExt }) {
  const t = useT();
  const prev = p.previousPrice;
  const isYesterday = p.ageDays === 0 && !!p.previousDate && p.previousDate === addDays(p.priceDate, -1);
  const title = isYesterday ? t('mandi.detail.yesterday') : t('mandi.detail.previous');
  if (prev === undefined) {
    return (
      <Card as="section" aria-label={title}>
        <SectionHeader title={title} />
        <p className="mt-2 text-small text-ink-2">{t('mandi.detail.noPrevious')}</p>
      </Card>
    );
  }
  const diff = p.price - prev;
  const diffText =
    diff > 0
      ? t('mandi.detail.diffUp', { amount: formatINR(diff) })
      : diff < 0
        ? t('mandi.detail.diffDown', { amount: formatINR(-diff) })
        : t('mandi.detail.diffSame');
  const from = p.previousFrom === 'history' ? t('mandi.detail.prevFromHistory') : t('mandi.detail.prevFromSource');
  return (
    <Card as="section" aria-label={title}>
      <SectionHeader title={title} />
      <div className="mt-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-section font-bold text-ink tabular-nums">{t('mandi.price.perQuintal', { price: formatINR(prev) })}</p>
          <p className="mt-0.5 text-small text-ink-2">
            {p.previousDate ? `${formatDate(p.previousDate)} · ` : ''}
            {from}
          </p>
        </div>
        {p.changePct !== undefined && <TrendBadge value={p.changePct} variant="pill" className="mt-1" />}
      </div>
      <p className="mt-3 text-body text-ink">{diffText}</p>
    </Card>
  );
}

export default function MandiDetailScreen() {
  const t = useT();
  const nav = useNav();
  const { params } = useRoute<{ commodityKey?: string }>();
  const rawKey = typeof params?.commodityKey === 'string' ? params.commodityKey : '';
  const key = isCropKey(rawKey) ? rawKey : null;
  const { language } = useLanguage();
  const lang = language.code;
  const online = useOnline();
  const [place] = usePlace();
  const keys = useMemo(() => (key ? [key] : NO_KEYS), [key]);
  const res = useMandi(place, keys);
  const history = usePriceHistory(place, key ?? '', 7);
  const stats = useMemo(() => historyStats(history), [history]);
  const watch = useMandiWatchlist();
  const saved = useSaved();
  const [placeOpen, setPlaceOpen] = useState(false);

  useEffect(() => {
    if (key) track('mandi_view', { view: 'detail', crop: key });
  }, [key]);

  const snapshot = res.data;
  const price = key ? snapshot?.prices.find(p => p.commodityKey === key) : undefined;
  const crop = key ? cropName(key, lang) : '';
  const isSaved = key ? saved.isSaved('mandi-crop', key) : false;
  const inList = key ? watch.has(key) : false;
  const err = res.error;
  const noData = err instanceof MandiError && err.code === 'no-data';
  const unverified = err instanceof MandiError && err.code === 'unverified';

  const chartData = useMemo(() => history.map(h => ({ label: shortDate(h.date, lang), value: h.price })), [history, lang]);

  const compare = useMemo(() => {
    if (!snapshot) return [];
    const rows: { name: string; here: boolean }[] = [];
    if (price) rows.push({ name: price.market, here: true });
    for (const m of snapshot.nearbyMandis) {
      const name = m.trim();
      if (name && !rows.some(r => sameMarket(r.name, name))) rows.push({ name, here: false });
    }
    return rows;
  }, [snapshot, price]);

  // ---------- Invalid route ----------

  if (!key) {
    return (
      <Screen title={t('mandi.title')}>
        <EmptyState
          art={<EmptyArt kind="search" />}
          title={t('mandi.detail.invalid.title')}
          body={t('mandi.detail.invalid.body')}
          action={{ label: t('mandi.detail.invalid.action'), onPress: () => (nav.pop() ? undefined : nav.switchTab('mandi')) }}
        />
      </Screen>
    );
  }

  // ---------- Actions ----------

  const priceVars = price
    ? { crop: priceName(price, lang), price: formatINR(price.price), market: price.market, date: formatDate(price.priceDate) }
    : null;

  const toggleSave = () => {
    if (!priceVars) {
      // No price to save, but a crop saved earlier can still be removed from its own screen.
      const existing = saved.items.find(i => i.type === 'mandi-crop' && i.refId === key);
      if (existing) {
        saved.remove(existing.id);
        toast.success(t('mandi.detail.unsaved'));
      }
      return;
    }
    const now = saved.toggle({
      type: 'mandi-crop',
      refId: key,
      title: t('mandi.save.title', { crop }),
      snippet: t('mandi.save.snippet', priceVars),
      target: { screen: 'mandi-detail', params: { commodityKey: key } },
    });
    toast.success(now ? t('common.saved') : t('mandi.detail.unsaved'));
  };

  const share = async () => {
    if (!priceVars) return;
    const result = await shareText(t('mandi.share.title', priceVars), t('mandi.share.text', priceVars));
    if (result === 'failed') return; // cancelled, or nothing could be shared or copied
    track('share', { type: 'mandi-crop', via: result });
    if (result === 'copied') toast.success(t('common.copied'));
  };

  const toggleWatch = () => {
    const result = watch.toggle(key);
    if (result === 'full') toast.warning(t('mandi.detail.watchFull', { n: WATCHLIST_MAX }));
    else if (result === 'last') toast.warning(t('mandi.detail.watchLast'));
    else toast.success(t(result === 'added' ? 'mandi.detail.watchAdded' : 'mandi.detail.watchRemoved', { crop }));
  };

  const ask = () => {
    const prompt = priceVars ? t('mandi.detail.askPrompt', priceVars) : t('mandi.detail.askPromptNoPrice', { crop });
    nav.switchTab('ai', { screen: 'ai', params: { prompt } });
  };

  // ---------- Sections ----------

  const refreshWarning =
    snapshot && err && !res.refreshing ? (
      <ErrorState
        compact
        error={err}
        title={online ? t('mandi.refreshFailed.title') : undefined}
        message={t('mandi.refreshFailed.body')}
        onRetry={() => void res.refresh()}
        retrying={res.refreshing}
      />
    ) : null;

  const saveButton = (
    <Button variant="secondary" icon={isSaved ? BookmarkCheck : Bookmark} aria-pressed={isSaved} onClick={toggleSave}>
      {isSaved ? t('mandi.detail.saved') : t('common.save')}
    </Button>
  );
  // Without a price there is nothing to save or share, but a saved crop can still be un-saved.
  const unsaveOnly = isSaved ? <div className="grid grid-cols-2 gap-3">{saveButton}</div> : null;

  let top;
  if (price) {
    top = (
      <>
        <PriceHero
          p={price}
          lang={lang}
          footer={
            <LastUpdated
              className="mt-3"
              at={res.fetchedAt}
              stale={res.stale}
              refreshing={res.refreshing}
              onRefresh={() => void res.refresh()}
            />
          }
        />
        {refreshWarning}
        <div className="grid grid-cols-2 gap-3">
          {saveButton}
          <Button variant="secondary" icon={Share2} onClick={() => void share()}>
            {t('common.share')}
          </Button>
        </div>
        <PreviousPrice p={price} />
      </>
    );
  } else if (res.loading || (!snapshot && !err)) {
    top = <SkeletonCard media lines={3} />;
  } else if (noData || (snapshot && !price)) {
    top = (
      <>
        <Card>
          <EmptyState
            compact
            art={<EmptyArt kind="search" size={128} />}
            title={t('mandi.list.noneForCrop', { crop })}
            body={t('mandi.list.noneForCropBody')}
            action={{ label: t('mandi.empty.changePlace'), icon: MapPin, onPress: () => setPlaceOpen(true) }}
            secondaryAction={{ label: t('common.retry'), icon: RefreshCw, onPress: () => void res.refresh() }}
          />
        </Card>
        {unsaveOnly}
      </>
    );
  } else {
    top = (
      <>
        <Card>
          <ErrorState
            error={err}
            title={unverified && online ? t('mandi.unverified.title') : undefined}
            onRetry={() => void res.refresh()}
            retrying={res.refreshing}
          />
        </Card>
        {unsaveOnly}
      </>
    );
  }

  const trend = (
    <Card as="section" aria-label={t('mandi.detail.trendTitle')}>
      <SectionHeader
        title={t('mandi.detail.trendTitle')}
        action={stats.enough ? <TrendBadge value={stats.changePct7d} variant="pill" /> : undefined}
        className="mb-3"
      />
      {stats.enough ? (
        <>
          <LineChart
            title={t('mandi.detail.chartTitle', { crop })}
            data={chartData}
            formatValue={(n: number) => formatINR(n)}
            formatTick={(n: number) => formatNumber(n, 0)}
            tone={stats.trend}
          />
          <div className="mt-4 grid grid-cols-2 gap-3">
            <StatCard label={t('mandi.detail.weekHigh')} value={formatINR(stats.high)} tone="green" />
            <StatCard label={t('mandi.detail.weekLow')} value={formatINR(stats.low)} tone="amber" />
          </div>
          <p className="mt-3 text-caption text-ink-2">
            {t('mandi.detail.trendNote', { market: stats.market ?? price?.market ?? '' })}
          </p>
        </>
      ) : (
        <EmptyState
          compact
          icon={TrendingUp}
          tone="green"
          title={t('mandi.detail.trendNotEnough')}
          body={t('mandi.detail.trendNotEnoughBody')}
          className="py-2"
        />
      )}
    </Card>
  );

  return (
    <Screen title={t('mandi.detail.title', { crop })} subtitle={placeLabel(place)}>
      <OfflineBanner />
      {top}

      <Card padding="none" className="px-4">
        <Toggle
          checked={inList}
          onChange={() => toggleWatch()}
          label={t('mandi.detail.watch')}
          description={t('mandi.detail.watchDesc')}
          icon={ListPlus}
        />
      </Card>

      {trend}

      <MarketSignalCard
        place={place}
        commodityKey={key}
        snapshot={snapshot}
        status={price ? 'ready' : res.loading ? 'loading' : 'error'}
      />
      <Button fullWidth size="lg" variant="tech" icon={Sparkles} onClick={ask}>
        {t('mandi.detail.ask')}
      </Button>
      <Disclaimer kind="price" />

      {compare.length > 1 && (
        <section aria-label={t('mandi.detail.compareTitle')}>
          <SectionHeader title={t('mandi.detail.compareTitle')} subtitle={t('mandi.detail.compareBody')} className="mb-3" />
          <ListGroup ariaLabel={t('mandi.detail.compareTitle')}>
            {compare.map(m => (
              <ListRow
                key={m.name}
                variant="plain"
                leading={<ToneIcon icon={Store} tone={m.here ? 'green' : 'teal'} size="sm" />}
                title={m.name}
                trailing={m.here ? <Badge tone="green">{t('mandi.detail.thisPrice')}</Badge> : undefined}
              />
            ))}
          </ListGroup>
          {/* The other names come from the AI's web search, not an official list. */}
          <Disclaimer variant="ai" className="mt-3">
            {t('mandi.nearby.aiNote')}
          </Disclaimer>
        </section>
      )}

      {price ? (
        <SourcesCard sources={price.sources.length ? price.sources : snapshot?.sources ?? []} title={t('mandi.detail.sourceTitle')} />
      ) : (
        !res.loading && <PortalsCard />
      )}

      <LocationSheet open={placeOpen} onClose={() => setPlaceOpen(false)} />
    </Screen>
  );
}
