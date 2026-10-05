// Building blocks shared by Community, Community Post and Experts:
// - the "जल्द आ रहा है" preview (hero, feature list, "अभी मदद चाहिए?"),
// - the full community UI pieces used behind FEATURES.community (post card, report and compose sheets).
import './strings';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { BadgeCheck, Bookmark, BookmarkCheck, Camera, Flag, Heart, ImagePlus, School, Sparkles, X } from 'lucide-react';
import {
  Avatar,
  Badge,
  Button,
  Callout,
  Card,
  IconButton,
  ListGroup,
  ListRow,
  MicButton,
  RadioCards,
  SectionHeader,
  SelectField,
  Sheet,
  TextArea,
  ToneIcon,
  toast,
  type IconLike,
  type Tone,
} from '../../components/ui';
import { EmptyArt } from '../../components/illustrations';
import { CROP_KEYS, cropName } from '../../data/crop-keys';
import { compressImage } from '../../lib/image';
import { timeAgo } from '../../lib/format';
import { useLanguage, useT } from '../../lib/i18n';
import { useNav } from '../../lib/nav';
import { usePersisted } from '../../lib/store';
import {
  CommunityError,
  REPORT_REASONS,
  community,
  type CommunityFeedPost,
  type NewPostInput,
  type ReportReason,
} from '../../services/community';
import { isNative, pickCropPhoto } from '../../services/native';
import type { CommunityPost } from '../../types/models';
import { KisanCallCentreCard } from '../profile/helplines';

/** Friendly message for any community/expert failure (never the raw error). */
export function communityErrorKey(e: unknown): string {
  return e instanceof CommunityError ? e.messageKey : 'common.error.generic';
}

// ---------- Coming-soon preview ----------

export function ComingSoonHero({ title, body, art = 'community' }: { title: string; body: string; art?: 'community' | 'chat' }) {
  const t = useT();
  return (
    <Card as="section" aria-labelledby="soon-title" padding="lg" className="flex flex-col items-center gap-2 text-center">
      <div className="w-full max-w-[11rem]">
        <EmptyArt kind={art} />
      </div>
      <Badge tone="amber" size="md">
        {t('common.comingSoon')}
      </Badge>
      <h2 id="soon-title" className="mt-1 text-section leading-snug font-bold text-ink">
        {title}
      </h2>
      <p className="max-w-sm text-body text-ink-2">{body}</p>
    </Card>
  );
}

export interface FeatureItem {
  key: string;
  icon: IconLike;
  tone: Tone;
  title: string;
  description: string;
  /** Extra visual next to the title (e.g. the verified badge). */
  extra?: ReactNode;
}

export function FeatureList({ id, title, items }: { id: string; title: string; items: FeatureItem[] }) {
  return (
    <section aria-labelledby={id} className="flex flex-col gap-3">
      <SectionHeader title={<span id={id}>{title}</span>} />
      <ListGroup ariaLabel={title}>
        {items.map(f => (
          <ListRow
            key={f.key}
            variant="plain"
            leading={<ToneIcon icon={f.icon} tone={f.tone} size="sm" />}
            title={f.title}
            subtitle={
              f.extra ? (
                <span className="flex flex-col items-start gap-1.5">
                  <span>{f.description}</span>
                  {f.extra}
                </span>
              ) : (
                f.description
              )
            }
            subtitleLines={3}
          />
        ))}
      </ListGroup>
    </section>
  );
}

/** "अभी मदद चाहिए?" — AI किसान मित्र now, the verified Kisan Call Centre number and the district KVK. */
export function HelpNow() {
  const t = useT();
  const nav = useNav();
  return (
    <section aria-labelledby="help-now" className="flex flex-col gap-3">
      <SectionHeader title={<span id="help-now">{t('community.help.title')}</span>} />
      <Callout
        tone="tech"
        icon={Sparkles}
        title={t('community.help.ai')}
        action={
          <Button variant="tech" icon={Sparkles} onClick={() => nav.switchTab('ai')}>
            {t('community.help.aiButton')}
          </Button>
        }
      >
        {t('community.help.aiDesc')}
      </Callout>
      <KisanCallCentreCard />
      <Callout tone="neutral" icon={School} title={t('profile.helpline.kvkTitle')}>
        {t('profile.helpline.kvkBody')}
      </Callout>
    </section>
  );
}

export function VerifiedBadge() {
  const t = useT();
  return (
    <Badge tone="green" variant="solid" icon={BadgeCheck}>
      {t('community.verified')}
    </Badge>
  );
}

// ---------- Full UI (FEATURES.community) ----------

/** Posts the farmer saved, kept on this phone only. */
export function useSavedPosts(): [string[], (id: string) => void] {
  const [ids, setIds] = usePersisted<string[]>('community.saved', []);
  const toggle = (id: string) => setIds(prev => (prev.includes(id) ? prev.filter(x => x !== id) : [id, ...prev]));
  return [ids, toggle];
}

interface LikeState {
  liked: boolean;
  likes: number;
}

/**
 * Optimistic likes: the count changes at once and rolls back if the server refuses.
 * The starting state comes from the backend's `likedByMe`. While a post's request is in flight
 * further taps on it are ignored, so two quick toggles can never race each other.
 */
export function useLikes() {
  const t = useT();
  const [state, setState] = useState<Record<string, LikeState>>({});
  const pending = useRef(new Set<string>());
  const get = (post: CommunityFeedPost): LikeState =>
    state[post.id] ?? { liked: !!post.likedByMe, likes: Math.max(0, post.likes ?? 0) };
  const toggle = async (post: CommunityFeedPost) => {
    if (pending.current.has(post.id)) return;
    pending.current.add(post.id);
    const current = get(post);
    const next = { liked: !current.liked, likes: Math.max(0, current.likes + (current.liked ? -1 : 1)) };
    setState(s => ({ ...s, [post.id]: next }));
    try {
      const res = await community.like(post.id, next.liked);
      const likes = typeof res?.likes === 'number' && res.likes >= 0 ? res.likes : next.likes;
      setState(s => ({ ...s, [post.id]: { liked: next.liked, likes } }));
    } catch (e) {
      // Roll back only if nothing else changed this post in the meantime.
      setState(s => (s[post.id] === next ? { ...s, [post.id]: current } : s));
      toast.error(t(communityErrorKey(e)));
    } finally {
      pending.current.delete(post.id);
    }
  };
  return { get, toggle };
}

export interface PostCardProps {
  post: CommunityPost;
  liked: boolean;
  likes: number;
  saved: boolean;
  onLike: () => void;
  onSave: () => void;
  onReport: () => void;
  /** List mode: the card opens the post. Omit on the detail screen. */
  onOpen?: () => void;
}

export function PostCard({ post, liked, likes, saved, onLike, onSave, onReport, onOpen }: PostCardProps) {
  const t = useT();
  const { language } = useLanguage();
  const author = post.authorName || t('community.farmer');
  const body = (
    <span className={`block text-body leading-relaxed text-ink ${onOpen ? 'line-clamp-4' : 'whitespace-pre-line'}`}>{post.text}</span>
  );
  return (
    <Card as="article" padding="none" className="overflow-hidden">
      <div className="relative flex flex-col gap-3 p-4">
        <div className="flex items-center gap-3">
          <Avatar name={author} size="md" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-body leading-snug font-semibold text-ink">{author}</p>
            <p className="text-caption text-ink-3">{timeAgo(post.createdAt)}</p>
          </div>
          {post.cropKey && <Badge tone="teal">{cropName(post.cropKey, language.code)}</Badge>}
        </div>
        {onOpen ? (
          <button
            type="button"
            onClick={onOpen}
            aria-label={t('community.openPost', { name: author })}
            className="block w-full text-left after:absolute after:inset-0 after:content-[''] focus-visible:outline-none focus-visible:after:outline-2 focus-visible:after:outline-offset-[-2px] focus-visible:after:outline-[var(--focus)] focus-visible:after:outline-solid"
          >
            {body}
          </button>
        ) : (
          body
        )}
        {post.image && (
          <img
            src={post.image}
            alt={t('community.photoAlt')}
            loading="lazy"
            decoding="async"
            className="max-h-64 w-full rounded-list border border-line bg-surface-2 object-cover"
          />
        )}
        {post.verifiedAnswer && (
          <div className="flex flex-col gap-2 rounded-list border border-brand-100 bg-brand-50 p-3">
            <div className="flex flex-wrap items-center gap-2">
              <VerifiedBadge />
              <span className="text-small font-semibold text-ink">{t('community.answeredBy', { name: post.verifiedAnswer.expertName })}</span>
            </div>
            <p className={`text-body leading-relaxed text-ink ${onOpen ? 'line-clamp-3' : 'whitespace-pre-line'}`}>{post.verifiedAnswer.text}</p>
          </div>
        )}
      </div>
      <div className="relative z-[1] flex flex-wrap items-center gap-1 border-t border-line px-2 py-1">
        <Button
          variant={liked ? 'soft' : 'ghost'}
          icon={Heart}
          aria-pressed={liked}
          aria-label={t(liked ? 'community.unlikeAria' : 'community.likeAria', { n: likes })}
          onClick={onLike}
        >
          {likes > 0 ? t('community.likes', { n: likes }) : t('community.like')}
        </Button>
        <Button
          variant={saved ? 'soft' : 'ghost'}
          icon={saved ? BookmarkCheck : Bookmark}
          aria-pressed={saved}
          aria-label={t(saved ? 'community.unsaveAria' : 'community.saveAria')}
          onClick={onSave}
        >
          {saved ? t('community.savedLabel') : t('community.save')}
        </Button>
        <IconButton icon={Flag} label={t('community.reportAria')} className="ml-auto" onClick={onReport} />
      </div>
    </Card>
  );
}

export function ReportSheet({ open, onClose, onSubmit }: { open: boolean; onClose: () => void; onSubmit: (reason: ReportReason) => Promise<void> }) {
  const t = useT();
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [sending, setSending] = useState(false);
  // Every report starts blank, so a reason picked for another post or reply is never re-sent.
  useEffect(() => {
    if (open) setReason(null);
  }, [open]);
  const send = async () => {
    if (!reason) return;
    setSending(true);
    try {
      await onSubmit(reason);
      toast.success(t('community.report.done'));
      setReason(null);
      onClose();
    } catch (e) {
      toast.error(t(communityErrorKey(e)));
    } finally {
      setSending(false);
    }
  };
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={t('community.report.title')}
      description={t('community.report.desc')}
      footer={
        <Button fullWidth size="lg" variant="danger" icon={Flag} disabled={!reason} loading={sending} onClick={send}>
          {t('community.report.send')}
        </Button>
      }
    >
      <RadioCards
        value={reason}
        onChange={v => setReason(v)}
        options={REPORT_REASONS.map(r => ({ value: r, label: t(`community.report.reason.${r}`) }))}
      />
    </Sheet>
  );
}

/** Photo from the camera / gallery, compressed for slow networks. */
export function usePhotoPicker() {
  const t = useT();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [image, setImage] = useState<string | undefined>();

  const accept = async (src: string | Blob) => {
    try {
      setImage(await compressImage(src, { maxDim: 1024, quality: 0.75 }));
    } catch {
      toast.error(t('community.compose.photoError'));
    }
  };

  const pick = async () => {
    if (!isNative) {
      inputRef.current?.click();
      return;
    }
    try {
      const dataUrl = await pickCropPhoto({
        header: t('community.compose.photoHeader'),
        camera: t('community.compose.camera'),
        gallery: t('community.compose.gallery'),
        cancel: t('common.cancel'),
      });
      if (dataUrl) await accept(dataUrl);
    } catch {
      toast.error(t('community.compose.photoError'));
    }
  };

  const input = (
    <input
      ref={inputRef}
      type="file"
      accept="image/*"
      className="hidden"
      tabIndex={-1}
      aria-hidden
      onChange={(e: { target: HTMLInputElement }) => {
        const file = e.target.files?.[0];
        e.target.value = '';
        if (file) accept(file);
      }}
    />
  );

  return { image, setImage, pick, input };
}

export function ComposeSheet({ open, onClose, onPosted, cropKeys }: { open: boolean; onClose: () => void; onPosted: () => void; cropKeys: string[] }) {
  const t = useT();
  const { language } = useLanguage();
  const [text, setText] = useState('');
  const [crop, setCrop] = useState('');
  const [viaVoice, setViaVoice] = useState(false);
  const [error, setError] = useState<string>();
  const [posting, setPosting] = useState(false);
  const photo = usePhotoPicker();

  const reset = () => {
    setText('');
    setCrop('');
    setViaVoice(false);
    setError(undefined);
    photo.setImage(undefined);
  };

  const post = async () => {
    if (text.trim().length < 10) {
      setError(t('community.compose.tooShort'));
      return;
    }
    setPosting(true);
    try {
      const input: NewPostInput = { text: text.trim(), cropKey: crop || undefined, image: photo.image, viaVoice };
      await community.createPost(input);
      toast.success(t('community.compose.posted'));
      reset();
      onClose();
      onPosted();
    } catch (e) {
      toast.error(t(communityErrorKey(e)));
    } finally {
      setPosting(false);
    }
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      size="tall"
      title={t('community.compose.title')}
      description={t('community.compose.desc')}
      footer={
        <Button fullWidth size="lg" loading={posting} onClick={post}>
          {t('community.compose.post')}
        </Button>
      }
    >
      <div className="flex flex-col gap-4">
        <TextArea
          label={t('community.compose.text')}
          value={text}
          onChange={v => {
            setText(v);
            if (error) setError(undefined);
          }}
          placeholder={t('community.compose.placeholder')}
          maxLength={1000}
          showCount
          error={error}
          trailing={
            <MicButton
              size="sm"
              onResult={spoken => {
                setViaVoice(true);
                setText(prev => (prev.trim() ? `${prev.trim()} ${spoken}` : spoken));
              }}
            />
          }
        />
        <SelectField
          label={t('community.compose.crop')}
          optional
          value={crop}
          onChange={setCrop}
          options={[...new Set([...cropKeys, ...CROP_KEYS])].map(k => ({ value: k, label: cropName(k, language.code) }))}
        />
        {photo.image ? (
          <div className="relative">
            <img src={photo.image} alt={t('community.photoAlt')} className="max-h-56 w-full rounded-list border border-line object-cover" />
            <div className="absolute top-2 right-2 flex gap-2">
              <IconButton icon={Camera} label={t('community.compose.photoChange')} variant="solid" onClick={photo.pick} />
              <IconButton icon={X} label={t('community.compose.photoRemove')} variant="solid" onClick={() => photo.setImage(undefined)} />
            </div>
          </div>
        ) : (
          <Button variant="secondary" fullWidth icon={ImagePlus} onClick={photo.pick}>
            {t('community.compose.photo')}
          </Button>
        )}
        {photo.input}
        <Callout tone="warning">{t('community.compose.rules')}</Callout>
      </div>
    </Sheet>
  );
}
