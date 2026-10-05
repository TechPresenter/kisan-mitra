// Shared layout for the privacy policy and terms: effective date, a short summary, then
// numbered sections as cards, each with a read-aloud button for farmers who prefer listening.
import './legal-strings';
import { useMemo } from 'react';
import { CalendarCheck, type LucideIcon } from 'lucide-react';
import { Callout, Card, ListenButton, Screen } from '../../components/ui';
import { useT, type TFunction } from '../../lib/i18n';
import type { LegalSection } from './legal-strings';

export interface LegalDocProps {
  /** 'profile.privacy' or 'profile.terms' */
  prefix: string;
  sections: LegalSection[];
  /** Number of summary lines: <prefix>.summary1 … N */
  summaryCount: number;
  summaryIcon: LucideIcon;
}

const range = (n = 0) => Array.from({ length: n }, (_, i) => i + 1);

function sectionText(t: TFunction, prefix: string, s: LegalSection) {
  const base = `${prefix}.${s.id}`;
  return {
    title: t(`${base}.title`),
    paragraphs: range(s.paragraphs).map(i => t(`${base}.p${i}`)),
    bullets: range(s.bullets).map(i => t(`${base}.b${i}`)),
    after: s.after ? t(`${base}.after`) : null,
  };
}

export function LegalDoc({ prefix, sections, summaryCount, summaryIcon }: LegalDocProps) {
  const t = useT();
  const content = useMemo(() => sections.map(s => ({ id: s.id, ...sectionText(t, prefix, s) })), [t, prefix, sections]);
  const summary = useMemo(() => range(summaryCount).map(i => t(`${prefix}.summary${i}`)), [t, prefix, summaryCount]);

  return (
    <Screen title={t(`${prefix}.title`)} subtitle={t(`${prefix}.subtitle`)}>
      <div className="flex flex-col gap-2">
        <p className="inline-flex items-center gap-1.5 text-small font-semibold text-ink-2">
          <CalendarCheck aria-hidden className="size-4.5 shrink-0 text-brand" />
          <span className="pt-0.5">{t('profile.legal.effective')}</span>
        </p>
        <p className="text-body leading-relaxed text-ink">{t(`${prefix}.intro`)}</p>
      </div>

      <Callout tone="brand" icon={summaryIcon} title={t('profile.legal.summary')}>
        <ul className="mt-1 flex list-disc flex-col gap-1 ps-5 text-body text-ink">
          {summary.map(line => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      </Callout>

      {content.map(sec => (
        <Card key={sec.id} as="section" aria-labelledby={`legal-${sec.id}`} className="flex flex-col gap-2.5">
          <div className="flex items-start justify-between gap-3">
            <h2 id={`legal-${sec.id}`} className="pt-2 text-card-title leading-snug font-semibold text-ink">
              {sec.title}
            </h2>
            <ListenButton
              id={`${prefix}-${sec.id}`}
              text={[sec.title, ...sec.paragraphs, ...sec.bullets, sec.after].filter(Boolean).join('\n')}
              variant="icon"
            />
          </div>
          {sec.paragraphs.map(p => (
            <p key={p} className="text-body leading-relaxed text-ink-2">
              {p}
            </p>
          ))}
          {sec.bullets.length > 0 && (
            <ul className="flex list-disc flex-col gap-1.5 ps-5 text-body leading-relaxed text-ink-2 marker:text-brand">
              {sec.bullets.map(b => (
                <li key={b}>{b}</li>
              ))}
            </ul>
          )}
          {sec.after && <p className="text-body leading-relaxed text-ink-2">{sec.after}</p>}
        </Card>
      ))}
    </Screen>
  );
}

export default LegalDoc;
