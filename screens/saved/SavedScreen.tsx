// "मेरी सेव की गई जानकारी" — bookmarks of AI answers, guides, advice, mandi crops, schemes,
// crop checks and soil reports. Everything lives on the phone, so it all works offline.
import { useMemo, useState } from 'react';
import { BookmarkMinus, HardDrive, Landmark, Share2, Sparkles, WifiOff } from 'lucide-react';
import {
  Button,
  Callout,
  ChipGroup,
  Disclaimer,
  EmptyState,
  IconButton,
  ListenButton,
  ListRow,
  Screen,
  Sheet,
  ToneIcon,
  toast,
  type ChipOption,
} from '../../components/ui';
import { EmptyArt } from '../../components/illustrations';
import { track } from '../../lib/analytics';
import { useOnline } from '../../lib/cache';
import { relativeDay, toISODate } from '../../lib/format';
import { useT } from '../../lib/i18n';
import { useNav } from '../../lib/nav';
import { KEYS, collection } from '../../lib/store';
import { shareText } from '../../services/native';
import { useSaved } from '../../services/saved';
import type { SavedItem, SavedType } from '../../types/models';
import { canOpenTarget } from '../search/targets';
import { SAVED_TYPES, SAVED_TYPE_META, savedFilterType, savedItemMeta } from './meta';
import './strings';

type Filter = 'all' | SavedType;

/** Puts a removed item back exactly as it was (same id and date, so it keeps its place). */
function restore(item: SavedItem) {
  const col = collection<SavedItem>(KEYS.saved);
  if (!col.get(item.id)) col.upsert(item);
}

function savedDay(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : relativeDay(toISODate(d));
}

export default function SavedScreen() {
  const t = useT();
  const nav = useNav();
  const online = useOnline();
  const { items, remove } = useSaved();
  const [filter, setFilter] = useState<Filter>('all');
  const [sheetItem, setSheetItem] = useState<SavedItem | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const i of items) {
      const type = savedFilterType(i);
      c[type] = (c[type] ?? 0) + 1;
    }
    return c;
  }, [items]);

  const chipOptions = useMemo<ChipOption<Filter>[]>(
    () => [
      { value: 'all', label: t('saved.type.all'), count: items.length || undefined },
      ...SAVED_TYPES.map(type => ({ value: type, label: t(SAVED_TYPE_META[type].labelKey), count: counts[type] || undefined })),
    ],
    [t, items.length, counts],
  );

  const visible = useMemo(() => (filter === 'all' ? items : items.filter(i => savedFilterType(i) === filter)), [items, filter]);

  const showDetails = (item: SavedItem) => {
    setSheetItem(item);
    setSheetOpen(true);
  };

  const openItem = (item: SavedItem) => {
    if (canOpenTarget(item.target, 'saved')) nav.open(item.target);
    else showDetails(item);
  };

  const removeItem = (item: SavedItem) => {
    setSheetOpen(false);
    remove(item.id);
    toast(t('saved.removed'), { action: { label: t('saved.undo'), onPress: () => restore(item) } });
  };

  const share = async (item: SavedItem) => {
    const result = await shareText(item.title, [item.title, item.snippet].filter(Boolean).join('\n\n'));
    if (result === 'copied') toast.success(t('common.copied'));
    if (result !== 'failed') track('share', { what: 'saved', type: item.type });
  };

  const subtitle = items.length === 0 ? undefined : items.length === 1 ? t('saved.countOne') : t('saved.countMany', { n: items.length });
  const sheetMeta = sheetItem ? savedItemMeta(sheetItem) : null;
  // A saved AI answer or crop check is still AI output, and a mandi snippet carries a price.
  const sheetDisclaimer =
    sheetItem?.type === 'ai-answer' || sheetItem?.type === 'diagnosis' ? 'ai' : sheetItem?.type === 'mandi-crop' ? 'price' : null;
  const filterMeta = filter === 'all' ? null : SAVED_TYPE_META[filter];

  return (
    <Screen title={t('saved.title')} subtitle={subtitle}>
      {items.length === 0 ? (
        <EmptyState
          art={<EmptyArt kind="saved" />}
          title={t('saved.empty.title')}
          body={t('saved.empty.body')}
          action={{ label: t('saved.empty.schemes'), icon: Landmark, onPress: () => nav.push('schemes') }}
          secondaryAction={{ label: t('saved.empty.ai'), icon: Sparkles, onPress: () => nav.switchTab('ai') }}
        />
      ) : (
        <>
          {!online && (
            <Callout tone="info" icon={WifiOff} role="status">
              {t('saved.offline')}
            </Callout>
          )}

          <ChipGroup ariaLabel={t('saved.filter')} value={filter} onChange={setFilter} options={chipOptions} />

          {visible.length === 0 ? (
            <EmptyState
              compact
              icon={filterMeta?.icon}
              tone={filterMeta?.tone}
              title={t('saved.emptyType.title')}
              body={t('saved.emptyType.body')}
              action={{ label: t('saved.emptyType.action'), onPress: () => setFilter('all') }}
            />
          ) : (
            <ul aria-label={t('saved.title')} className="flex flex-col gap-3">
              {visible.map(item => {
                const meta = savedItemMeta(item);
                const day = savedDay(item.savedAt);
                return (
                  <li key={item.id}>
                    <ListRow
                      leading={<ToneIcon icon={meta.icon} tone={meta.tone} />}
                      title={item.title}
                      // Own clamp: ListRow's subtitle `block` class currently overrides its line-clamp.
                      subtitle={item.snippet ? <span className="line-clamp-2">{item.snippet}</span> : undefined}
                      meta={[t(meta.kindKey), day && t('saved.savedOn', { date: day })].filter(Boolean).join(' • ')}
                      trailing={
                        <IconButton
                          icon={BookmarkMinus}
                          label={t('saved.remove', { title: item.title })}
                          className="-mr-2"
                          onClick={() => removeItem(item)}
                        />
                      }
                      onPress={() => openItem(item)}
                    />
                  </li>
                );
              })}
            </ul>
          )}

          <p className="flex items-start gap-2 px-1 text-caption text-ink-2">
            <HardDrive aria-hidden className="mt-0.5 size-4 shrink-0 text-ink-3" />
            <span>{t('saved.offlineNote')}</span>
          </p>
        </>
      )}

      <Sheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        title={sheetItem?.title}
        description={sheetItem ? t('saved.savedOn', { date: savedDay(sheetItem.savedAt) }) : undefined}
        footer={
          sheetItem ? (
            <div className="grid grid-cols-2 gap-2">
              <Button variant="secondary" icon={Share2} onClick={() => share(sheetItem)}>
                {t('common.share')}
              </Button>
              <Button variant="ghost" icon={BookmarkMinus} className="text-danger! hover:bg-tint-red!" onClick={() => removeItem(sheetItem)}>
                {t('common.unsave')}
              </Button>
            </div>
          ) : undefined
        }
      >
        {sheetItem && sheetMeta && (
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="inline-flex items-center gap-2">
                <ToneIcon icon={sheetMeta.icon} tone={sheetMeta.tone} size="sm" />
                <span className="text-small font-semibold text-ink-2">{t(sheetMeta.kindKey)}</span>
              </span>
              <ListenButton id={`saved-${sheetItem.id}`} text={[sheetItem.title, sheetItem.snippet].filter(Boolean).join('। ')} />
            </div>
            {sheetItem.snippet && <p className="text-body whitespace-pre-line text-ink">{sheetItem.snippet}</p>}
            {sheetDisclaimer && <Disclaimer kind={sheetDisclaimer} />}
            {/* The sheet is only used for items whose screen can no longer be opened. */}
            <p className="text-small text-ink-2">{t('saved.notOpenable')}</p>
          </div>
        )}
      </Sheet>
    </Screen>
  );
}
