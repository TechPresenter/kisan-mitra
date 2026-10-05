// AI conversation history: search, open, delete (⋮ menu or long-press → confirm), delete all.
import './strings';
import { memo, useCallback, useMemo, useRef, useState } from 'react';
import { EllipsisVertical, MessageCirclePlus, MessageSquareText, MessagesSquare, Mic, Trash2 } from 'lucide-react';
import {
  Button,
  EmptyState,
  IconButton,
  ListGroup,
  ListRow,
  Screen,
  SearchBar,
  SectionHeader,
  Sheet,
  Thumbnail,
  ToneIcon,
  confirm,
  toast,
} from '../../components/ui';
import { EmptyArt } from '../../components/illustrations';
import { daysBetween, timeAgo, toISODate, todayISO } from '../../lib/format';
import { useT } from '../../lib/i18n';
import { useNav } from '../../lib/nav';
import { useSaved } from '../../services/saved';
import {
  clearConversations,
  fold,
  hasSavedAnswer,
  openConversation,
  previewOf,
  removeConversation,
  restoreConversation,
  restoreConversations,
  savedAnswerIds,
  useConversations,
  usePending,
  type ChatConversation,
} from './engine';

type GroupKey = 'today' | 'week' | 'older';
const GROUP_TITLE: Record<GroupKey, string> = { today: 'ai.history.today', week: 'ai.history.week', older: 'ai.history.older' };

function groupOf(c: ChatConversation, today: string): GroupKey {
  const day = toISODate(new Date(c.updatedAt));
  if (day === today) return 'today';
  return daysBetween(day, today) <= 7 ? 'week' : 'older';
}

/** Long-press (≈ 0.5 s) opens the menu on release, and swallows the click that may follow. */
function useLongPress(onLong: () => void) {
  const timer = useRef(0);
  const origin = useRef<{ x: number; y: number } | null>(null);
  const fired = useRef(false);
  const cb = useRef(onLong);
  cb.current = onLong;

  const clear = () => window.clearTimeout(timer.current);
  const finish = () => {
    clear();
    const wasLong = fired.current && origin.current;
    origin.current = null;
    if (wasLong) window.setTimeout(() => cb.current(), 60);
  };

  return {
    onPointerDown: (e: any) => {
      if (e.button !== 0) return;
      fired.current = false;
      origin.current = { x: e.clientX, y: e.clientY };
      clear();
      timer.current = window.setTimeout(() => {
        fired.current = true;
        try {
          navigator.vibrate?.(15);
        } catch {
          /* no vibration motor / not allowed */
        }
      }, 500);
    },
    onPointerMove: (e: any) => {
      const o = origin.current;
      if (o && !fired.current && Math.hypot(e.clientX - o.x, e.clientY - o.y) > 12) {
        clear();
        origin.current = null;
      }
    },
    onPointerUp: finish,
    onPointerCancel: finish,
    onContextMenu: (e: any) => {
      e.preventDefault();
      if (origin.current) {
        // Touch long-press: open when the finger lifts.
        fired.current = true;
        clear();
        return;
      }
      cb.current(); // mouse right-click
    },
    onClickCapture: (e: any) => {
      if (!fired.current) return;
      fired.current = false;
      e.stopPropagation();
      e.preventDefault();
    },
  };
}

interface RowProps {
  c: ChatConversation;
  /** Has an answer in "मेरी सेव की गई जानकारी" (kept by "सारी बातचीत हटाएं"). */
  saved: boolean;
  onOpen: (c: ChatConversation) => void;
  onMenu: (c: ChatConversation) => void;
}

const ConversationRow = memo(function ConversationRow({ c, saved, onOpen, onMenu }: RowProps) {
  const t = useT();
  const press = useLongPress(() => onMenu(c));
  // An answer still on its way is not "no answer".
  const pending = usePending(c.id);
  const info = useMemo(() => {
    const visible = c.messages.filter(m => !m.error);
    const last = visible[visible.length - 1];
    const image = c.messages.find(m => m.image)?.image;
    const unanswered = !last || last.role === 'user';
    const preview = !last
      ? ''
      : last.role === 'user'
        ? t('ai.history.you', { text: last.text || t('ai.history.photo') })
        : previewOf(last);
    return { count: visible.length, image, unanswered, preview };
  }, [c, t]);

  const meta = [
    timeAgo(c.updatedAt),
    t(info.count === 1 ? 'ai.history.messagesOne' : 'ai.history.messages', { n: info.count }),
    pending ? t('ai.history.pending') : info.unanswered ? t('ai.history.noAnswer') : '',
    saved ? t('ai.history.hasSaved') : '',
  ]
    .filter(Boolean)
    .join(' • ');

  return (
    <div className="select-none [-webkit-touch-callout:none]" {...press}>
      <ListRow
        leading={
          info.image ? (
            <Thumbnail src={info.image} alt="" size="md" />
          ) : (
            <ToneIcon icon={c.via === 'voice' ? Mic : MessageSquareText} tone={c.via === 'voice' ? 'sky' : 'tech'} />
          )
        }
        title={c.title}
        subtitle={info.preview || undefined}
        meta={meta}
        onPress={() => onOpen(c)}
        trailing={<IconButton icon={EllipsisVertical} label={t('ai.history.options')} className="-mr-2" onClick={() => onMenu(c)} />}
      />
    </div>
  );
});

export default function AIHistoryScreen() {
  const t = useT();
  const nav = useNav();
  const conversations = useConversations();
  const savedItems = useSaved().items;
  const savedIds = useMemo(() => savedAnswerIds(savedItems), [savedItems]);
  const [query, setQuery] = useState('');
  const [menuFor, setMenuFor] = useState<ChatConversation | null>(null);
  // Keep the sheet's content while it animates closed.
  const menuShown = useRef<ChatConversation | null>(null);
  if (menuFor) menuShown.current = menuFor;

  const index = useMemo(
    () =>
      conversations.map(c => ({
        c,
        text: fold(
          [c.title, ...c.messages.map(m => `${m.text} ${m.structured?.problem || ''} ${(m.structured?.doList || []).join(' ')}`)]
            .join(' ')
            .slice(0, 6000),
        ),
      })),
    [conversations],
  );

  const results = useMemo(() => {
    const words = fold(query).trim().split(/\s+/).filter(Boolean);
    if (!words.length) return conversations;
    return index.filter(r => words.every(w => r.text.includes(w))).map(r => r.c);
  }, [index, query, conversations]);

  const groups = useMemo(() => {
    const today = todayISO();
    const out: { key: GroupKey; items: ChatConversation[] }[] = [];
    for (const c of results) {
      const key = groupOf(c, today);
      const g = out.find(x => x.key === key);
      if (g) g.items.push(c);
      else out.push({ key, items: [c] });
    }
    return out;
  }, [results]);

  const open = useCallback((c: ChatConversation) => openConversation(nav, c.id), [nav]);
  const openMenu = useCallback((c: ChatConversation) => setMenuFor(c), []);

  const askNew = () => {
    if (!nav.pop()) nav.switchTab('ai');
  };

  // Deleting one conversation also removes its saved answers (they could no longer be opened).
  const removeOne = async (c: ChatConversation) => {
    const ok = await confirm({
      title: t('common.confirmDelete'),
      message: t(hasSavedAnswer(c, savedIds) ? 'ai.history.deleteBodySaved' : 'ai.history.deleteBody'),
      tone: 'danger',
      icon: Trash2,
      confirmLabel: t('common.delete'),
    });
    if (!ok) return;
    const removed = removeConversation(c.id);
    if (!removed) return;
    toast.success(t('ai.history.deleted'), {
      id: 'ai-history-delete',
      action: { label: t('ai.history.undo'), onPress: () => restoreConversation(removed) },
    });
  };

  // "सारी बातचीत हटाएं" keeps conversations with a saved answer, so saved answers keep opening.
  const keptCount = useMemo(() => conversations.filter(c => hasSavedAnswer(c, savedIds)).length, [conversations, savedIds]);
  const deletableCount = conversations.length - keptCount;

  const removeAll = async () => {
    const ok = await confirm({
      title: t('ai.history.deleteAllTitle'),
      message: keptCount
        ? t('ai.history.deleteAllBodyKeep', { n: deletableCount, k: keptCount })
        : t('ai.history.deleteAllBody', { n: deletableCount }),
      tone: 'danger',
      icon: Trash2,
      confirmLabel: t('common.delete'),
    });
    if (!ok) return;
    const old = clearConversations();
    setQuery('');
    toast.success(t(keptCount ? 'ai.history.deleted' : 'ai.history.deletedAll'), {
      id: 'ai-history-delete',
      action: { label: t('ai.history.undo'), onPress: () => restoreConversations(old) },
    });
  };

  const sheetConv = menuShown.current;
  const total = conversations.length;

  return (
    <Screen
      title={t('ai.history.title')}
      subtitle={total ? t(total === 1 ? 'ai.history.subtitleOne' : 'ai.history.subtitle', { n: total }) : undefined}
    >
      {total === 0 ? (
        <EmptyState
          art={<EmptyArt kind="chat" />}
          title={t('ai.history.emptyTitle')}
          body={t('ai.history.emptyBody')}
          action={{ label: t('ai.history.ask'), icon: MessageCirclePlus, onPress: askNew }}
        />
      ) : (
        <>
          <div className="flex flex-col gap-2">
            <SearchBar value={query} onChange={setQuery} voice placeholder={t('ai.history.search')} ariaLabel={t('ai.history.search')} />
            <p className="px-1 text-caption text-ink-2">{t('ai.history.hint')}</p>
          </div>

          {results.length === 0 ? (
            <EmptyState
              compact
              art={<EmptyArt kind="search" size={140} />}
              title={t('ai.history.noResults')}
              body={t('ai.history.noResultsBody')}
              action={{ label: t('ai.history.clearSearch'), onPress: () => setQuery('') }}
            />
          ) : (
            groups.map(g => (
              <section key={g.key} aria-label={t(GROUP_TITLE[g.key])}>
                <SectionHeader title={t(GROUP_TITLE[g.key])} className="mb-3" />
                <div className="flex flex-col gap-3">
                  {g.items.map(c => (
                    <ConversationRow key={c.id} c={c} saved={hasSavedAnswer(c, savedIds)} onOpen={open} onMenu={openMenu} />
                  ))}
                </div>
              </section>
            ))
          )}

          {deletableCount > 0 && (
            <div className="flex justify-center">
              <Button variant="ghost" icon={<Trash2 aria-hidden className="size-5 shrink-0 text-tone-red" />} onClick={removeAll}>
                <span className="text-tone-red">{t('ai.history.deleteAll')}</span>
              </Button>
            </div>
          )}
        </>
      )}

      <Sheet
        open={!!menuFor}
        onClose={() => setMenuFor(null)}
        title={sheetConv?.title}
        description={sheetConv ? timeAgo(sheetConv.updatedAt) : undefined}
      >
        <ListGroup ariaLabel={t('ai.history.options')}>
          <ListRow
            variant="plain"
            leading={<ToneIcon icon={MessagesSquare} size="sm" />}
            title={t('ai.history.open')}
            onPress={() => {
              const c = menuFor;
              setMenuFor(null);
              if (c) open(c);
            }}
          />
          <ListRow
            variant="plain"
            leading={<ToneIcon icon={Trash2} tone="red" size="sm" />}
            title={<span className="text-tone-red">{t('ai.history.delete')}</span>}
            chevron={false}
            onPress={() => {
              const c = menuFor;
              setMenuFor(null);
              if (c) removeOne(c);
            }}
          />
        </ListGroup>
      </Sheet>
    </Screen>
  );
}
