// A saved soil report: score gauge, nutrient rows, report details and the AI advice (cached per
// report; asked for on tap). Bookmark, share and delete.
// Params: soil-report { id }
import { useId, useMemo, useState } from 'react';
import { Bookmark, BookmarkCheck, Plus, Share2, Trash2 } from 'lucide-react';
import '../../lib/common-strings';
import './strings';
import { EmptyArt } from '../../components/illustrations';
import { Button, Callout, Card, EmptyState, Screen, confirm, toast } from '../../components/ui';
import { track } from '../../lib/analytics';
import { daysBetween, formatDate, todayISO } from '../../lib/format';
import { useT } from '../../lib/i18n';
import { readCache } from '../../lib/cache';
import { useNav, useRoute } from '../../lib/nav';
import { KEYS, store, useCollection } from '../../lib/store';
import { shareText } from '../../services/native';
import { useSaved } from '../../services/saved';
import {
  readingsOf,
  removeSoilReport,
  scoreLabelKey,
  soilHealthScore,
  soilRecsCacheName,
  soilTypeLabelKey,
  useSoilReports,
  type SoilRecommendations,
  type SoilReportExt,
} from '../../services/soil';
import type { Farm } from '../../types/models';
import { RecommendationsPanel, SOIL_FORM_RESET_KEY, ScoreInfoSheet, SoilResultCard, soilReportShareText } from './parts';

const OLD_TEST_DAYS = 730;

export default function SoilReportScreen() {
  const t = useT();
  const nav = useNav();
  const { params } = useRoute<{ id?: string }>();
  const { get } = useSoilReports();
  const report = params.id ? get(params.id) : undefined;

  if (!report) {
    return (
      <Screen title={t('soil.report.title')}>
        <EmptyState
          art={<EmptyArt kind="soil" tone="amber" />}
          title={t('soil.report.notFoundTitle')}
          body={t('soil.report.notFoundBody')}
          action={{ label: t('soil.report.open'), onPress: () => nav.replace('soil') }}
        />
      </Screen>
    );
  }
  return <ReportView report={report} />;
}

function ReportView({ report }: { report: SoilReportExt }) {
  const t = useT();
  const nav = useNav();
  const saved = useSaved();
  const farms = useCollection<Farm>(KEYS.farms).items;
  const [infoOpen, setInfoOpen] = useState(false);
  const [requested, setRequested] = useState(false);
  const detailsId = useId();

  const result = useMemo(() => soilHealthScore(readingsOf(report)), [report]);
  const farm = report.farmId ? farms.find(f => f.id === report.farmId) : undefined;
  const dateLabel = formatDate(report.date, { year: true });
  const isOld = daysBetween(report.date, todayISO()) > OLD_TEST_DAYS;
  const isSaved = saved.isSaved('soil-report', report.id);
  // Records with too few readings (only from early test builds) have no meaningful score:
  // SoilResultCard says so instead of showing "0/100 कमज़ोर".
  const scoreText = result.enough
    ? t('soil.past.score', { score: result.score, label: t(scoreLabelKey(result.score)) })
    : t('soil.past.noScore');

  const toggleSave = () => {
    const now = saved.toggle({
      type: 'soil-report',
      refId: report.id,
      title: t('soil.report.savedTitle', { date: dateLabel }),
      snippet: scoreText,
      target: { screen: 'soil-report', params: { id: report.id } },
    });
    if (now) toast.success(t('common.saved'));
    else toast(t('soil.report.removedSaved'));
  };

  const share = async () => {
    const recs = readCache<SoilRecommendations>(soilRecsCacheName(report.id))?.data;
    const { title, text } = soilReportShareText(report, recs, t, dateLabel);
    const res = await shareText(title, text);
    if (res === 'copied') toast(t('common.copied'));
    if (res !== 'failed') track('share', { type: 'soil-report' });
  };

  const remove = async () => {
    const ok = await confirm({ title: t('common.confirmDelete'), message: t('soil.report.deleteBody'), tone: 'danger', icon: Trash2 });
    if (!ok) return;
    removeSoilReport(report.id);
    toast(t('soil.report.deleted'));
    if (!nav.pop()) nav.replace('soil');
  };

  // Back to the soil form when we came from it, and tell it to start empty (it stayed mounted
  // with the old readings); otherwise open it on top.
  const openSoil = () => {
    if (nav.stack[nav.stack.length - 2]?.screen === 'soil') {
      nav.pop();
      store.set(SOIL_FORM_RESET_KEY, Date.now());
    } else nav.push('soil');
  };

  const details: [string, string][] = [
    [t('soil.report.date'), dateLabel],
    ...(farm ? ([[t('soil.report.farm'), farm.name]] as [string, string][]) : []),
    ...(report.soilType ? ([[t('soil.report.soilType'), t(soilTypeLabelKey(report.soilType))]] as [string, string][]) : []),
  ];

  return (
    <Screen
      title={t('soil.report.title')}
      subtitle={farm ? `${dateLabel} · ${farm.name}` : dateLabel}
      actions={[
        { icon: isSaved ? BookmarkCheck : Bookmark, label: isSaved ? t('common.unsave') : t('common.save'), onPress: toggleSave },
        { icon: Share2, label: t('common.share'), onPress: share },
      ]}
    >
      {isOld && <Callout tone="warning">{t('soil.form.oldDate')}</Callout>}

      <SoilResultCard result={result} unit={report.inputUnit ?? 'ha'} onHow={() => setInfoOpen(true)} />

      <Card as="section" aria-labelledby={detailsId}>
        <h2 id={detailsId} className="text-section font-bold text-ink">
          {t('soil.report.details')}
        </h2>
        <dl className="mt-2 divide-y divide-line">
          {details.map(([k, v]) => (
            <div key={k} className="flex min-h-12 items-center justify-between gap-3 py-2">
              <dt className="text-small text-ink-2">{k}</dt>
              <dd className="text-right text-body font-medium text-ink">{v}</dd>
            </div>
          ))}
        </dl>
      </Card>

      <RecommendationsPanel
        report={report}
        cropKeys={report.cropKeys ?? []}
        requested={requested}
        onRequest={() => setRequested(true)}
      />

      <div className="flex flex-col gap-2">
        <Button fullWidth variant="secondary" icon={Share2} onClick={share}>
          {t('common.share')}
        </Button>
        <Button fullWidth variant="ghost" icon={Plus} onClick={openSoil}>
          {t('soil.report.newTest')}
        </Button>
        <Button fullWidth variant="danger" icon={Trash2} onClick={remove} className="mt-2">
          {t('soil.report.delete')}
        </Button>
      </div>

      <ScoreInfoSheet open={infoOpen} onClose={() => setInfoOpen(false)} unit={report.inputUnit ?? 'ha'} />
    </Screen>
  );
}
