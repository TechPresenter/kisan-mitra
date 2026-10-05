// Farmer community ('community'). FEATURES.community is false until a moderated backend exists,
// so farmers see the "जल्द आ रहा है" preview. The full UI below is wired to services/community
// and ready to be switched on: tabs सभी पोस्ट / मेरे समूह / विशेषज्ञ, crop filter, posts with
// like / save / report, and a compose sheet with photo and voice.
import './strings';
import { useMemo, useState } from 'react';
import { ChevronDown, MessageCirclePlus, Plus, Users } from 'lucide-react';
import {
  Button,
  Callout,
  ChipGroup,
  EmptyState,
  ErrorState,
  LastUpdated,
  Screen,
  SegmentedTabs,
  SkeletonCard,
  toast,
} from '../../components/ui';
import { EmptyArt } from '../../components/illustrations';
import { cropName } from '../../data/crop-keys';
import { MINUTE, useResource } from '../../lib/cache';
import { useProfile } from '../../lib/app-state';
import { FEATURES } from '../../lib/features';
import { useLanguage, useT } from '../../lib/i18n';
import { useNav } from '../../lib/nav';
import { KEYS, useCollection } from '../../lib/store';
import {
  community,
  type CommunityFeedPost,
  type CommunityPage,
  type CommunityTab,
  type ReportReason,
} from '../../services/community';
import type { Crop } from '../../types/models';
import { CommunityComingSoon } from './CommunityComingSoon';
import { ComposeSheet, PostCard, ReportSheet, communityErrorKey, useLikes, useSavedPosts } from './parts';

const TABS: CommunityTab[] = ['all', 'groups', 'experts'];

/** Pages loaded with "और पोस्ट देखें", tied to the feed (tab + crop) and first page they extend. */
interface MorePages {
  feed: string;
  base?: number;
  posts: CommunityFeedPost[];
  cursor?: string;
}

export default function CommunityScreen() {
  const t = useT();
  // The preview also covers "flag on, backend not plugged in yet" (setCommunityAdapter not called).
  if (!FEATURES.community || !community.available) {
    return (
      <Screen title={t('community.title')} subtitle={t('community.subtitle')}>
        <CommunityComingSoon />
      </Screen>
    );
  }
  return <CommunityFeed />;
}

/** Crop keys the farmer grows (profile + crop records), for the filter and the compose sheet. */
export function useMyCropKeys(): string[] {
  const [profile] = useProfile();
  const crops = useCollection<Crop>(KEYS.crops).items;
  return useMemo(
    () => [...new Set([...(profile?.cropKeys || []), ...crops.map(c => c.cropKey)].filter(k => k && k !== 'other'))],
    [profile?.cropKeys, crops],
  );
}

function CommunityFeed() {
  const t = useT();
  const nav = useNav();
  const { language } = useLanguage();
  const [tab, setTab] = useState<CommunityTab>('all');
  const [crop, setCrop] = useState('all');
  const [composeOpen, setComposeOpen] = useState(false);
  const [reportId, setReportId] = useState<string | null>(null);
  const [savedIds, toggleSaved] = useSavedPosts();
  const likes = useLikes();
  const myCrops = useMyCropKeys();

  const [more, setMore] = useState<MorePages | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);

  const feed = `${tab}.${crop}`;
  const cropKey = crop === 'all' ? undefined : crop;
  const res = useResource<CommunityPage>(`community.posts.${feed}`, () => community.listPosts({ tab, cropKey }), {
    maxAgeMs: 5 * MINUTE,
  });

  // Extra pages belong to this feed and this first page; a refresh or tab change starts over.
  const extra = more && more.feed === feed && more.base === res.fetchedAt ? more : null;
  const posts = useMemo(() => {
    const seen = new Set<string>();
    return [...(res.data?.posts ?? []), ...(extra?.posts ?? [])].filter(p => p && !seen.has(p.id) && !!seen.add(p.id));
  }, [res.data, extra]);
  const nextCursor = extra ? extra.cursor : res.data?.nextCursor;

  const loadMore = async () => {
    if (!nextCursor || loadingMore) return;
    const base = res.fetchedAt;
    setLoadingMore(true);
    try {
      const page = await community.listPosts({ tab, cropKey, cursor: nextCursor });
      setMore(prev => {
        const kept = prev && prev.feed === feed && prev.base === base ? prev.posts : [];
        return { feed, base, posts: [...kept, ...(page?.posts ?? [])], cursor: page?.nextCursor };
      });
    } catch (e) {
      toast.error(t(communityErrorKey(e)));
    } finally {
      setLoadingMore(false);
    }
  };

  const cropOptions = useMemo(
    () => [{ value: 'all', label: t('community.filter.all') }, ...myCrops.map(k => ({ value: k, label: cropName(k, language.code) }))],
    [myCrops, language.code, t],
  );

  const report = (reason: ReportReason) => community.report(reportId!, reason);

  const empty =
    tab === 'groups'
      ? { title: t('community.empty.groups'), body: t('community.empty.groupsBody') }
      : tab === 'experts'
        ? { title: t('community.empty.experts'), body: t('community.empty.expertsBody') }
        : { title: t('community.empty.all'), body: t('community.empty.allBody') };

  return (
    <Screen
      title={t('community.title')}
      subtitle={t('community.subtitle')}
      onRefresh={res.refresh}
      refreshing={res.refreshing}
      footer={
        <Button fullWidth size="lg" icon={MessageCirclePlus} onClick={() => setComposeOpen(true)}>
          {t('community.ask')}
        </Button>
      }
    >
      <SegmentedTabs
        ariaLabel={t('community.tabs')}
        idPrefix="community"
        value={tab}
        onChange={setTab}
        options={TABS.map(v => ({ value: v, label: t(`community.tab.${v}`) }))}
      />
      {cropOptions.length > 1 && <ChipGroup ariaLabel={t('community.filter')} value={crop} onChange={setCrop} options={cropOptions} />}

      <div role="tabpanel" id={`community-panel-${tab}`} aria-labelledby={`community-tab-${tab}`} className="flex flex-col gap-4">
        {res.loading ? (
          <>
            <SkeletonCard lines={3} />
            <SkeletonCard lines={3} media />
            <SkeletonCard lines={2} />
          </>
        ) : res.error && !res.data ? (
          <ErrorState error={res.error} onRetry={res.refresh} retrying={res.refreshing} />
        ) : !posts.length ? (
          <EmptyState
            art={<EmptyArt kind="community" />}
            title={empty.title}
            body={empty.body}
            action={{ label: t('community.ask'), icon: Plus, onPress: () => setComposeOpen(true) }}
          />
        ) : (
          <>
            <LastUpdated at={res.fetchedAt} stale={res.stale || !!res.error} refreshing={res.refreshing} onRefresh={res.refresh} />
            <Callout tone="neutral" icon={Users}>
              {t('community.note')}
            </Callout>
            {posts.map(post => {
              const like = likes.get(post);
              return (
                <PostCard
                  key={post.id}
                  post={post}
                  liked={like.liked}
                  likes={like.likes}
                  saved={savedIds.includes(post.id)}
                  onLike={() => likes.toggle(post)}
                  onSave={() => toggleSaved(post.id)}
                  onReport={() => setReportId(post.id)}
                  onOpen={() => nav.push('community-post', { id: post.id })}
                />
              );
            })}
            {nextCursor && (
              <Button variant="secondary" fullWidth icon={ChevronDown} loading={loadingMore} onClick={loadMore}>
                {t('community.loadMore')}
              </Button>
            )}
          </>
        )}
      </div>

      <ComposeSheet open={composeOpen} onClose={() => setComposeOpen(false)} onPosted={res.refresh} cropKeys={myCrops} />
      <ReportSheet open={!!reportId} onClose={() => setReportId(null)} onSubmit={report} />
    </Screen>
  );
}
