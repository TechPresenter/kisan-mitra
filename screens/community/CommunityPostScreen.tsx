// One community post with its replies ('community-post', { id }). Behind FEATURES.community;
// while the flag is off it shows the same "जल्द आ रहा है" preview as the community tab.
// Only replies the backend marks `verified` get the "विशेषज्ञ द्वारा सत्यापित" styling.
import './strings';
import { useState } from 'react';
import { Flag, Send } from 'lucide-react';
import {
  Avatar,
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  IconButton,
  LastUpdated,
  MicButton,
  Screen,
  SectionHeader,
  SkeletonCard,
  SkeletonList,
  TextArea,
  toast,
} from '../../components/ui';
import { EmptyArt } from '../../components/illustrations';
import { MINUTE, useResource } from '../../lib/cache';
import { FEATURES } from '../../lib/features';
import { timeAgo } from '../../lib/format';
import { useT } from '../../lib/i18n';
import { useNav, useRoute } from '../../lib/nav';
import { community, type CommunityPostDetail, type CommunityReply, type ReportReason } from '../../services/community';
import { CommunityComingSoon } from './CommunityComingSoon';
import { PostCard, ReportSheet, VerifiedBadge, communityErrorKey, useLikes, useSavedPosts } from './parts';

export default function CommunityPostScreen() {
  const t = useT();
  // The preview also covers "flag on, backend not plugged in yet" (setCommunityAdapter not called).
  if (!FEATURES.community || !community.available) {
    return (
      <Screen title={t('community.title')} subtitle={t('community.subtitle')}>
        <CommunityComingSoon />
      </Screen>
    );
  }
  return <PostDetail />;
}

function ReplyItem({ reply, onReport }: { reply: CommunityReply; onReport: () => void }) {
  const t = useT();
  const name = reply.authorName || t('community.farmer');
  const verified = !!reply.verified;
  return (
    <Card
      as="li"
      radius="list"
      tone={verified ? 'brand' : 'default'}
      className="flex flex-col gap-2"
      aria-label={verified ? `${t('community.verified')}: ${name}` : undefined}
    >
      <div className="flex items-center gap-3">
        <Avatar name={name} size="sm" />
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-small leading-snug font-semibold text-ink">
            <span className="truncate">{name}</span>
            {reply.isExpert && <Badge tone="indigo">{t('community.expert')}</Badge>}
          </p>
          <p className="text-caption text-ink-3">{timeAgo(reply.createdAt)}</p>
        </div>
        <IconButton icon={Flag} label={t('community.reportReplyAria')} onClick={onReport} />
      </div>
      {verified && (
        <div>
          <VerifiedBadge />
        </div>
      )}
      <p className="text-body leading-relaxed whitespace-pre-line text-ink">{reply.text}</p>
    </Card>
  );
}

function PostDetail() {
  const t = useT();
  const nav = useNav();
  const { params } = useRoute<{ id?: string }>();
  const id = params.id || '';
  const [savedIds, toggleSaved] = useSavedPosts();
  const likes = useLikes();
  const [report, setReport] = useState<{ replyId?: string } | null>(null);
  const [reply, setReply] = useState('');
  const [replyError, setReplyError] = useState<string>();
  const [sending, setSending] = useState(false);

  const res = useResource<CommunityPostDetail>(id ? `community.post.${id}` : null, () => community.getPost(id), {
    maxAgeMs: 2 * MINUTE,
  });
  const post = res.data;

  const sendReply = async () => {
    if (reply.trim().length < 3) {
      setReplyError(t('community.reply.short'));
      return;
    }
    setSending(true);
    try {
      await community.reply(id, reply.trim());
      setReply('');
      toast.success(t('community.reply.sent'));
      res.refresh();
    } catch (e) {
      toast.error(t(communityErrorKey(e)));
    } finally {
      setSending(false);
    }
  };

  const submitReport = (reason: ReportReason) => community.report(id, reason, report?.replyId);

  let body;
  if (!id) {
    body = (
      <EmptyState
        art={<EmptyArt kind="search" />}
        title={t('community.error.not-found')}
        action={{ label: t('community.backToList'), onPress: () => nav.replace('community') }}
      />
    );
  } else if (res.loading) {
    body = (
      <>
        <SkeletonCard lines={4} media />
        <SkeletonList rows={3} variant="card" media="circle" />
      </>
    );
  } else if (res.error && !post) {
    body = <ErrorState error={res.error} onRetry={res.refresh} retrying={res.refreshing} />;
  } else if (post) {
    const like = likes.get(post);
    // A partial or cached payload may leave replies out.
    const replies = Array.isArray(post.replies) ? post.replies : [];
    body = (
      <>
        <LastUpdated at={res.fetchedAt} stale={res.stale || !!res.error} refreshing={res.refreshing} onRefresh={res.refresh} />
        <PostCard
          post={post}
          liked={like.liked}
          likes={like.likes}
          saved={savedIds.includes(post.id)}
          onLike={() => likes.toggle(post)}
          onSave={() => toggleSaved(post.id)}
          onReport={() => setReport({})}
        />

        <section aria-labelledby="replies-title" className="flex flex-col gap-3">
          <SectionHeader title={<span id="replies-title">{t('community.replies', { n: replies.length })}</span>} />
          {replies.length ? (
            <ul className="flex flex-col gap-3">
              {replies.map(r => (
                <ReplyItem key={r.id} reply={r} onReport={() => setReport({ replyId: r.id })} />
              ))}
            </ul>
          ) : (
            <EmptyState compact art={<EmptyArt kind="chat" size={120} />} title={t('community.noReplies')} body={t('community.noRepliesBody')} />
          )}
        </section>

        <Card as="section" aria-label={t('community.reply.label')} className="flex flex-col gap-3">
          <TextArea
            label={t('community.reply.label')}
            value={reply}
            onChange={v => {
              setReply(v);
              if (replyError) setReplyError(undefined);
            }}
            placeholder={t('community.reply.placeholder')}
            maxLength={1000}
            error={replyError}
            trailing={<MicButton size="sm" onResult={text => setReply(prev => (prev.trim() ? `${prev.trim()} ${text}` : text))} />}
          />
          <Button fullWidth icon={Send} loading={sending} onClick={sendReply}>
            {t('community.reply.send')}
          </Button>
        </Card>
      </>
    );
  }

  return (
    <Screen title={t('community.post.title')} subtitle={t('community.title')} onRefresh={id ? res.refresh : undefined} refreshing={res.refreshing}>
      {body}
      <ReportSheet open={!!report} onClose={() => setReport(null)} onSubmit={submitReport} />
    </Screen>
  );
}
