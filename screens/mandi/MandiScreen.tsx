// 08 Mandi (tab root): "फसल भाव" — the watched crops' latest indicative prices near the selected
// place with the AI बाज़ार संकेत, sources and the price disclaimer; "नज़दीकी मंडी" — the mandis
// around that place plus the official price portals.
import './strings';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Bell, ChevronRight, Info, MapPin, Plus, RefreshCw, Store } from 'lucide-react';
import {
  Button,
  Callout,
  Chip,
  ChipGroup,
  Disclaimer,
  EmptyState,
  ErrorState,
  HeaderPill,
  LastUpdated,
  ListGroup,
  ListRow,
  OfflineBanner,
  Screen,
  SectionHeader,
  SegmentedTabs,
  SkeletonList,
  ToneIcon,
  toast,
} from '../../components/ui';
import { EmptyArt } from '../../components/illustrations';
import { LocationSheet } from '../../components/shared/LocationSheet';
import { track } from '../../lib/analytics';
import { placeLabel, usePlace } from '../../lib/app-state';
import { useOnline } from '../../lib/cache';
import { useLanguage, useT } from '../../lib/i18n';
import { useNav, useRoute } from '../../lib/nav';
import { cropName, isCropKey } from '../../data/crop-keys';
import { MandiError, useMandi, type MandiPriceExt, type MandiSnapshotExt } from '../../services/mandi';
import { useNotifications } from '../../services/notifications';
import {
  MarketSignalCard,
  PortalsCard,
  PriceRow,
  SourcesCard,
  WatchlistSheet,
  sameMarket,
  useMandiWatchlist,
} from './parts';

type Tab = 'prices' | 'nearby';

/** Tab stacks remount screens on tab switches; keep the farmer's segment for the session. */
let lastTab: Tab = 'prices';
/** Routes whose `commodityKey` param (a mandi notification) has already opened the crop. */
const handledRoutes = new Set<string>();
const NO_PRICES: MandiPriceExt[] = [];

interface NearbyRow {
  name: string;
  crops: string[];
}

/** Nearby mandis from the search, plus any mandi a price came from, with the crops priced there. */
function nearbyRows(snapshot: MandiSnapshotExt, lang: string): NearbyRow[] {
  const rows: NearbyRow[] = [];
  const rowFor = (name: string) => {
    let row = rows.find(r => sameMarket(r.name, name));
    if (!row) rows.push((row = { name, crops: [] }));
    return row;
  };
  for (const m of snapshot.nearbyMandis) if (m.trim()) rowFor(m.trim());
  for (const p of snapshot.prices) {
    const row = rowFor(p.market);
    const crop = cropName(p.commodityKey, lang);
    if (!row.crops.includes(crop)) row.crops.push(crop);
  }
  return rows;
}

export default function MandiScreen() {
  const t = useT();
  const nav = useNav();
  const route = useRoute<{ commodityKey?: string }>();
  const { language } = useLanguage();
  const lang = language.code;
  const online = useOnline();
  const [place] = usePlace();
  const watch = useMandiWatchlist();
  const res = useMandi(place, watch.keys);
  const { unread } = useNotifications();

  const [tab, setTabState] = useState<Tab>(lastTab);
  const [filter, setFilter] = useState<string>('all');
  const [placeOpen, setPlaceOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);

  const setTab = (next: Tab) => {
    lastTab = next;
    setTabState(next);
  };
  const openPlace = () => setPlaceOpen(true);
  const openEditor = () => setEditOpen(true);
  const openCrop = useCallback((commodityKey: string) => nav.push('mandi-detail', { commodityKey }), [nav.push]);

  useEffect(() => {
    track('mandi_view', { view: 'list', crops: watch.keys.length });
    // Once per visit to the tab.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // A mandi notification opens { screen: 'mandi', params: { commodityKey } }: show that crop once.
  useEffect(() => {
    const key = route.params?.commodityKey;
    if (typeof key === 'string' && isCropKey(key) && !handledRoutes.has(route.key)) {
      handledRoutes.add(route.key);
      nav.push('mandi-detail', { commodityKey: key });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [route.key]);

  // A crop removed from the list can't stay selected.
  useEffect(() => {
    if (filter !== 'all' && !watch.keys.includes(filter)) setFilter('all');
  }, [watch.keys, filter]);

  const snapshot = res.data;
  const prices = snapshot?.prices ?? NO_PRICES;
  const shown = useMemo(() => (filter === 'all' ? prices : prices.filter(p => p.commodityKey === filter)), [prices, filter]);
  const missing = useMemo(() => {
    if (!snapshot || filter !== 'all') return [];
    const have = new Set(prices.map(p => p.commodityKey));
    return watch.keys.filter(k => !have.has(k)).map(k => cropName(k, lang));
  }, [snapshot, prices, watch.keys, filter, lang]);
  // The signal is for the farmer's first own crop that is still in the list and has a price, so
  // it never describes a crop they removed or one with nothing to read.
  const firstCrop = useMemo(
    () =>
      watch.own.find(k => watch.keys.includes(k) && prices.some(p => p.commodityKey === k)) ??
      prices[0]?.commodityKey ??
      watch.keys[0] ??
      null,
    [watch.own, watch.keys, prices],
  );
  const signalCrop = filter !== 'all' ? filter : firstCrop;
  const chipOptions = useMemo(
    () => [{ value: 'all', label: t('mandi.watch.all') }, ...watch.keys.map(k => ({ value: k, label: cropName(k, lang) }))],
    [watch.keys, lang, t],
  );
  const nearby = useMemo(() => (snapshot ? nearbyRows(snapshot, lang) : []), [snapshot, lang]);

  const err = res.error;
  const noData = err instanceof MandiError && err.code === 'no-data';
  const unverified = err instanceof MandiError && err.code === 'unverified';
  const loadingRows = Math.min(Math.max(watch.keys.length, 3), 5);

  const saveWatchlist = (keys: string[]) => {
    watch.set(keys);
    setEditOpen(false);
    toast.success(t('mandi.watch.saved'));
  };

  // ---------- Shared states ----------

  const emptyWatchlist = (
    <EmptyState
      art={<EmptyArt kind="crops" />}
      title={t('mandi.emptyList.title')}
      body={t('mandi.emptyList.body')}
      action={{ label: t('mandi.emptyList.action'), icon: Plus, onPress: openEditor }}
    />
  );

  /** Nothing to show: "no prices here" is an empty state, anything else an error with retry. */
  const failedState = noData ? (
    <EmptyState
      art={<EmptyArt kind="search" />}
      title={t('mandi.empty.title')}
      body={t('mandi.error.no-data')}
      action={{ label: t('mandi.empty.changePlace'), icon: MapPin, onPress: openPlace }}
      secondaryAction={{ label: t('common.retry'), icon: RefreshCw, onPress: () => void res.refresh() }}
    />
  ) : (
    <ErrorState
      error={err}
      title={unverified && online ? t('mandi.unverified.title') : undefined}
      onRetry={() => void res.refresh()}
      retrying={res.refreshing}
    />
  );

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

  const lastUpdated = (
    <LastUpdated at={res.fetchedAt} stale={res.stale} refreshing={res.refreshing} onRefresh={() => void res.refresh()} />
  );

  // ---------- फसल भाव ----------

  const watchRow = (
    <div className="flex items-center gap-2">
      {watch.keys.length > 0 && (
        <ChipGroup
          className="min-w-0 flex-1"
          bleed={false}
          ariaLabel={t('mandi.watch.label')}
          value={filter}
          onChange={setFilter}
          options={chipOptions}
        />
      )}
      <Chip
        label={t('mandi.watch.add')}
        icon={Plus}
        onClick={openEditor}
        aria-label={t('mandi.watch.addA11y')}
        aria-pressed={undefined}
        aria-haspopup="dialog"
        className="min-h-12"
      />
    </div>
  );

  const signal = (
    <MarketSignalCard
      place={place}
      commodityKey={signalCrop}
      snapshot={snapshot}
      status={snapshot ? 'ready' : res.loading ? 'loading' : 'error'}
      action={
        signalCrop ? (
          <Button variant="tech" iconRight={ChevronRight} onClick={() => openCrop(signalCrop)}>
            {t('mandi.ai.details')}
          </Button>
        ) : undefined
      }
    />
  );

  let pricesPanel;
  if (!watch.keys.length) {
    pricesPanel = emptyWatchlist;
  } else if (!snapshot) {
    pricesPanel =
      res.loading || !err ? (
        <>
          <SkeletonList rows={loadingRows} trailing />
          {signal}
        </>
      ) : (
        <>
          {failedState}
          <PortalsCard />
        </>
      );
  } else {
    pricesPanel = (
      <>
        <section aria-label={t('mandi.list.a11y')} className="flex flex-col gap-3">
          <SectionHeader title={t('mandi.list.title')} />
          {lastUpdated}
          {refreshWarning}
          {shown.length > 0 ? (
            <ul className="flex flex-col gap-3">
              {shown.map(p => (
                <li key={p.commodityKey}>
                  <PriceRow price={p} lang={lang} onOpen={openCrop} />
                </li>
              ))}
            </ul>
          ) : (
            filter !== 'all' && (
              <EmptyState
                compact
                art={<EmptyArt kind="search" size={128} />}
                title={t('mandi.list.noneForCrop', { crop: cropName(filter, lang) })}
                body={t('mandi.list.noneForCropBody')}
                action={{ label: t('mandi.empty.changePlace'), icon: MapPin, onPress: openPlace }}
              />
            )
          )}
          {/* After a failed refresh these crops were never searched; refreshWarning covers that. */}
          {missing.length > 0 && !res.refreshing && !err && (
            <p className="px-1 text-small text-ink-2">{t('mandi.list.missing', { crops: missing.join(', ') })}</p>
          )}
        </section>
        {signal}
        <Disclaimer kind="price" />
        <SourcesCard sources={snapshot.sources} />
      </>
    );
  }

  // ---------- नज़दीकी मंडी ----------

  let nearbyPanel;
  if (!watch.keys.length) {
    nearbyPanel = (
      <>
        {emptyWatchlist}
        <PortalsCard />
      </>
    );
  } else if (!snapshot) {
    nearbyPanel =
      res.loading || !err ? (
        <SkeletonList rows={4} variant="plain" media="circle" />
      ) : (
        <>
          {failedState}
          <PortalsCard />
        </>
      );
  } else {
    nearbyPanel = (
      <>
        <Callout tone="info" icon={Info}>
          {t('mandi.nearby.note')}
        </Callout>
        <section aria-label={t('mandi.nearby.title')} className="flex flex-col gap-3">
          <SectionHeader title={t('mandi.nearby.title')} subtitle={placeLabel(place)} />
          {lastUpdated}
          {refreshWarning}
          {nearby.length > 0 ? (
            <>
              <ListGroup ariaLabel={t('mandi.nearby.title')}>
                {nearby.map(m => (
                  <ListRow
                    key={m.name}
                    variant="plain"
                    leading={<ToneIcon icon={Store} tone={m.crops.length ? 'green' : 'teal'} />}
                    title={m.name}
                    subtitle={m.crops.length ? t('mandi.nearby.pricesFrom', { crops: m.crops.join(', ') }) : undefined}
                  />
                ))}
              </ListGroup>
              {/* The names come from the AI's web search and are not checked against an official list. */}
              <Disclaimer variant="ai">{t('mandi.nearby.aiNote')}</Disclaimer>
            </>
          ) : (
            <EmptyState
              compact
              art={<EmptyArt kind="search" size={128} />}
              title={t('mandi.nearby.empty.title')}
              body={t('mandi.nearby.empty.body')}
              action={{ label: t('mandi.empty.changePlace'), icon: MapPin, onPress: openPlace }}
            />
          )}
        </section>
        <PortalsCard />
      </>
    );
  }

  return (
    <Screen
      title={t('mandi.title')}
      // The kit's 48px location pill (as on Home) is the one place control.
      headerContent={
        <HeaderPill
          icon={MapPin}
          label={placeLabel(place)}
          onPress={openPlace}
          ariaLabel={t('mandi.placeA11y', { place: placeLabel(place) })}
        />
      }
      actions={[
        {
          key: 'bell',
          icon: Bell,
          label: t('ui.notifications'),
          badge: unread > 0 ? unread : undefined,
          onPress: () => nav.push('notifications'),
        },
      ]}
    >
      <OfflineBanner />
      <SegmentedTabs
        ariaLabel={t('mandi.tabs.label')}
        idPrefix="mandi"
        value={tab}
        onChange={setTab}
        options={[
          { value: 'prices', label: t('mandi.tabs.prices') },
          { value: 'nearby', label: t('mandi.tabs.nearby') },
        ]}
      />
      <div role="tabpanel" id={`mandi-panel-${tab}`} aria-labelledby={`mandi-tab-${tab}`} className="flex flex-col gap-5">
        {tab === 'prices' && watchRow}
        {tab === 'prices' ? pricesPanel : nearbyPanel}
      </div>

      <LocationSheet open={placeOpen} onClose={() => setPlaceOpen(false)} />
      <WatchlistSheet open={editOpen} onClose={() => setEditOpen(false)} value={watch.keys} onSave={saveWatchlist} />
    </Screen>
  );
}
