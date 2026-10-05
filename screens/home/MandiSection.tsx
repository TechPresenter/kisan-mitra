// Home: "आज की मंडी" — the top 4 indicative prices near the farmer, with dates, trend and sources.
import './strings';
import { memo, useMemo, type ReactNode } from 'react';
import { RefreshCw, Store } from 'lucide-react';
import {
  Card,
  Disclaimer,
  EmptyState,
  ErrorState,
  LastUpdated,
  ListGroup,
  ListRow,
  SectionHeader,
  SkeletonList,
  TrendBadge,
} from '../../components/ui';
import { CropArt, EmptyArt } from '../../components/illustrations';
import { cropName } from '../../data/crop-keys';
import type { Resource } from '../../lib/cache';
import { formatDate, formatINR } from '../../lib/format';
import { useLanguage, useT } from '../../lib/i18n';
import { AIError } from '../../services/ai';
import { MandiError, type MandiPriceExt, type MandiSnapshotExt } from '../../services/mandi';
import type { GroundingSource } from '../../types/models';
import type { HomeNav } from './util';

const ROWS = 4;
const MAX_SOURCES = 3;

function sourceName(s: GroundingSource): string {
  const title = s.title?.trim();
  if (title) return title;
  try {
    return new URL(s.uri).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

export interface MandiSectionProps {
  mandi: Resource<MandiSnapshotExt>;
  go: HomeNav;
}

export const MandiSection = memo(function MandiSection({ mandi, go }: MandiSectionProps) {
  const t = useT();
  const { language } = useLanguage();
  const lang = language.code;

  const rows = useMemo(() => mandi.data?.prices.slice(0, ROWS) ?? [], [mandi.data]);
  const sources = useMemo(() => {
    const out: string[] = [];
    for (const p of rows) {
      for (const s of p.sources) {
        const name = sourceName(s);
        if (name && !out.includes(name)) out.push(name);
      }
    }
    return out.slice(0, MAX_SOURCES);
  }, [rows]);

  const openMandi = () => go.switchTab('mandi');
  const retry = () => void mandi.refresh();
  // Retrying cannot help when no AI provider is set up for this build.
  const canRetry = !(mandi.error instanceof AIError && mandi.error.code === 'not-configured');

  let body: ReactNode;
  if (rows.length) {
    body = (
      <>
        <ListGroup ariaLabel={t('home.mandi.title')}>
          {rows.map(p => (
            <PriceRow key={p.commodityKey} price={p} lang={lang} onPress={() => go.push('mandi-detail', { commodityKey: p.commodityKey })} />
          ))}
        </ListGroup>
        {mandi.error && <p className="text-caption text-ink-2">{t('home.mandi.refreshFailed')}</p>}
        <Disclaimer kind="price" />
        {sources.length > 0 && <p className="text-caption text-ink-2">{t('home.mandi.sources', { list: sources.join(', ') })}</p>}
        <LastUpdated at={mandi.fetchedAt} stale={mandi.stale} refreshing={mandi.refreshing} />
      </>
    );
  } else if (mandi.loading) {
    body = <SkeletonList rows={ROWS} variant="plain" trailing />;
  } else if (mandi.error && !(mandi.error instanceof MandiError)) {
    // AI / network failures. MandiError means the search worked but found no verified price: that
    // is the empty state below, not a red error.
    body = (
      <ErrorState
        compact
        title={t('home.mandi.errorTitle')}
        error={mandi.error}
        onRetry={canRetry ? retry : undefined}
        retrying={mandi.refreshing}
      />
    );
  } else {
    body = (
      <Card padding="sm">
        <EmptyState
          compact
          art={<EmptyArt kind="money" size={120} />}
          title={t('home.mandi.emptyTitle')}
          body={t('home.mandi.emptyBody')}
          action={{ label: t('home.mandi.open'), icon: Store, onPress: openMandi }}
          secondaryAction={mandi.error ? { label: t('common.retry'), icon: RefreshCw, onPress: retry } : undefined}
        />
      </Card>
    );
  }

  return (
    <section className="flex flex-col gap-3">
      <SectionHeader title={t('home.mandi.title')} action={{ onPress: openMandi }} />
      {body}
    </section>
  );
});

function PriceRow({ price: p, lang, onPress }: { price: MandiPriceExt; lang: string; onPress: () => void }) {
  const t = useT();
  const meta = [p.market, p.ageDays > 0 ? t('mandi.priceDate', { date: formatDate(p.priceDate) }) : null].filter(Boolean).join(' • ');
  return (
    <ListRow
      variant="plain"
      leading={<CropArt crop={p.commodityKey} size={56} />}
      title={cropName(p.commodityKey, lang)}
      subtitle={
        <span className="font-bold whitespace-nowrap text-brand">
          {formatINR(p.price)}
          <span className="font-medium">{t('common.perQuintal')}</span>
        </span>
      }
      subtitleLines={1}
      meta={meta || undefined}
      // No previous price → no arrow (never a made-up "0%").
      trailing={
        p.changePct !== undefined ? (
          <span className="flex flex-col items-end gap-0.5">
            <TrendBadge value={p.changePct} direction={p.trend} />
            <span aria-hidden className="text-caption text-ink-2">
              {t(`home.mandi.trend.${p.trend}`)}
            </span>
          </span>
        ) : undefined
      }
      chevron={p.changePct === undefined}
      onPress={onPress}
    />
  );
}
