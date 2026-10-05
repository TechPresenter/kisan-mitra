// Farmer community + expert consultation: adapter interfaces for a future moderated backend.
//
// Both features are switched off (FEATURES.community / FEATURES.experts in lib/features.ts) because they need infrastructure the app
// does not have yet: accounts, moderation, verified experts and payments. Until a backend is
// plugged in with setCommunityAdapter() / setExpertAdapter(), every call rejects with
// CommunityError('unavailable'). Nothing here ever fabricates posts, answers or expert profiles
// (spec §18: no misinformation presented as verified advice).
import { isOnline } from '../lib/cache';
import { registerStrings } from '../lib/i18n';
import type { CommunityPost, Expert, ID, ISOTime } from '../types/models';

// ---------- Types ----------

/** सभी पोस्ट | मेरे समूह | विशेषज्ञ (answered by verified experts). */
export type CommunityTab = 'all' | 'groups' | 'experts';

export interface CommunityReply {
  id: ID;
  authorName: string;
  text: string;
  createdAt: ISOTime;
  /** Set by the backend only for accounts it has verified as agriculture experts. */
  isExpert?: boolean;
  /** Moderator-confirmed answer; only these may be styled "विशेषज्ञ द्वारा सत्यापित". */
  verified?: boolean;
}

/** A post as the backend returns it for the current farmer. */
export interface CommunityFeedPost extends CommunityPost {
  /** Whether the current farmer has liked the post (backend-provided). */
  likedByMe?: boolean;
}

export interface CommunityPostDetail extends CommunityFeedPost {
  /** May be missing in a partial / cached payload: treat as no replies. */
  replies?: CommunityReply[];
}

export interface CommunityPage {
  posts: CommunityFeedPost[];
  /** Present when more posts exist; pass back as ListPostsOptions.cursor. */
  nextCursor?: string;
}

export interface ListPostsOptions {
  tab: CommunityTab;
  cropKey?: string;
  cursor?: string;
}

export interface NewPostInput {
  text: string;
  cropKey?: string;
  /** Compressed JPEG data URL (lib/image compressImage). */
  image?: string;
  /** The text was dictated with the mic (analytics/moderation hint only). */
  viaVoice?: boolean;
}

export type ReportReason = 'wrong-advice' | 'spam' | 'abusive' | 'personal-info' | 'other';
export const REPORT_REASONS: readonly ReportReason[] = ['wrong-advice', 'spam', 'abusive', 'personal-info', 'other'];

export interface CommunityAdapter {
  /** False for the built-in placeholder; the UI then shows the "जल्द आ रहा है" preview. */
  readonly available: boolean;
  listPosts(opts: ListPostsOptions): Promise<CommunityPage>;
  getPost(id: ID): Promise<CommunityPostDetail>;
  createPost(input: NewPostInput): Promise<CommunityPost>;
  reply(postId: ID, text: string): Promise<CommunityReply>;
  like(postId: ID, liked: boolean): Promise<{ likes: number }>;
  report(postId: ID, reason: ReportReason, replyId?: ID): Promise<void>;
}

export type ConsultationMode = Expert['modes'][number];

export interface ConsultationRequest {
  expertId: ID;
  mode: ConsultationMode;
  /** Short description of the problem (optional). */
  question?: string;
  cropKey?: string;
}

export interface ConsultationBooking {
  id: ID;
  expertId: ID;
  mode: ConsultationMode;
  /** Fee confirmed by the backend before payment (₹). */
  feeInr: number;
  status: 'requested' | 'confirmed';
  /** When the expert will connect, if already scheduled. */
  scheduledAt?: ISOTime;
}

export interface ListExpertsOptions {
  specialization?: string;
}

export interface ExpertAdapter {
  readonly available: boolean;
  /** Only experts whose identity and qualifications the backend has verified (the UI labels them so). */
  listExperts(opts?: ListExpertsOptions): Promise<Expert[]>;
  /** A request only: the backend must show the confirmed fee again before any payment. */
  requestConsultation(req: ConsultationRequest): Promise<ConsultationBooking>;
}

// ---------- Errors ----------

export type CommunityErrorCode = 'unavailable' | 'offline' | 'network' | 'not-found' | 'rejected';

export class CommunityError extends Error {
  constructor(
    public code: CommunityErrorCode,
    message?: string,
  ) {
    super(message || code);
    this.name = 'CommunityError';
  }
  /** i18n key for a friendly message (never show `message`). */
  get messageKey(): string {
    return `community.error.${this.code}`;
  }
}

registerStrings({
  hi: {
    'community.error.unavailable': 'यह सुविधा अभी शुरू नहीं हुई है। जल्द आ रही है।',
    'community.error.offline': 'इंटरनेट नहीं है। कनेक्शन मिलने पर दोबारा कोशिश करें।',
    'community.error.network': 'सर्वर से जुड़ नहीं पाए। थोड़ी देर बाद कोशिश करें।',
    'community.error.not-found': 'यह पोस्ट अब उपलब्ध नहीं है।',
    'community.error.rejected': 'यह पोस्ट नियमों के हिसाब से नहीं है। कृपया खेती से जुड़ा सवाल लिखें।',
  },
  en: {
    'community.error.unavailable': 'This feature has not started yet. It is coming soon.',
    'community.error.offline': 'No internet. Please try again when you are connected.',
    'community.error.network': 'Could not reach the server. Please try again later.',
    'community.error.not-found': 'This post is no longer available.',
    'community.error.rejected': 'This post does not follow the rules. Please ask a farming question.',
  },
});

// ---------- Default adapters (no backend) ----------

const unavailable = <T>(): Promise<T> => Promise.reject(new CommunityError('unavailable'));

const UNAVAILABLE_COMMUNITY: CommunityAdapter = {
  available: false,
  listPosts: () => unavailable(),
  getPost: () => unavailable(),
  createPost: () => unavailable(),
  reply: () => unavailable(),
  like: () => unavailable(),
  report: () => unavailable(),
};

const UNAVAILABLE_EXPERTS: ExpertAdapter = {
  available: false,
  listExperts: () => unavailable(),
  requestConsultation: () => unavailable(),
};

let communityAdapter: CommunityAdapter = UNAVAILABLE_COMMUNITY;
let expertAdapter: ExpertAdapter = UNAVAILABLE_EXPERTS;

/** Plug in a real (moderated) backend. Pass null to go back to the unavailable placeholder. */
export function setCommunityAdapter(adapter: CommunityAdapter | null) {
  communityAdapter = adapter || UNAVAILABLE_COMMUNITY;
}

export function setExpertAdapter(adapter: ExpertAdapter | null) {
  expertAdapter = adapter || UNAVAILABLE_EXPERTS;
}

/** Fails fast with a friendly 'offline' error instead of waiting for a network timeout. */
function guard<A extends unknown[], R>(fn: (...args: A) => Promise<R>): (...args: A) => Promise<R> {
  return async (...args: A) => {
    if (!isOnline()) throw new CommunityError('offline');
    try {
      return await fn(...args);
    } catch (e) {
      if (e instanceof CommunityError) throw e;
      throw new CommunityError('network', e instanceof Error ? e.message : String(e));
    }
  };
}

/** The active community adapter (always rejects with 'unavailable' until a backend is set). */
export const community: CommunityAdapter = {
  get available() {
    return communityAdapter.available;
  },
  listPosts: guard(opts => communityAdapter.listPosts(opts)),
  getPost: guard(id => communityAdapter.getPost(id)),
  createPost: guard(input => communityAdapter.createPost(input)),
  reply: guard((postId, text) => communityAdapter.reply(postId, text)),
  like: guard((postId, liked) => communityAdapter.like(postId, liked)),
  report: guard((postId, reason, replyId) => communityAdapter.report(postId, reason, replyId)),
};

/** The active expert-consultation adapter. */
export const experts: ExpertAdapter = {
  get available() {
    return expertAdapter.available;
  },
  listExperts: guard(opts => expertAdapter.listExperts(opts)),
  requestConsultation: guard(req => expertAdapter.requestConsultation(req)),
};
