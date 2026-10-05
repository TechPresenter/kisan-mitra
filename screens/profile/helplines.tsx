// Official farmer helplines shown in Help, Community and Experts.
//
// Only numbers verified on an official government page are listed here (checked 2026-10-05):
// - Kisan Call Centre 1800-180-1551, 6 AM – 10 PM on all seven days, 22 local languages:
//   https://mkisan.gov.in/Home/AboutKCC (Ministry of Agriculture & Farmers Welfare, mKisan portal)
//   also shown as "किसान हेल्पलाइन केंद्र डॉयल 1800 180 1551" on https://agriwelfare.gov.in/
//   and in ICAR's notice https://icar.org.in/node/2765 (number changed from 1551 to 1800-180-1551).
// The KVK locator (kvk.icar.gov.in) could not be reached to verify it, so no KVK link or number
// is shown; farmers are told to contact their district KVK / agriculture officer instead.
import type { ReactNode } from 'react';
import { PhoneCall } from 'lucide-react';
import { Badge, Card, ToneIcon } from '../../components/ui';
import { registerStrings, useT } from '../../lib/i18n';
import '../../lib/common-strings';

export const KISAN_CALL_CENTRE = {
  /** Display form. */
  number: '1800-180-1551',
  /** Dialable form for tel: links. */
  tel: '18001801551',
  sources: ['https://mkisan.gov.in/Home/AboutKCC', 'https://agriwelfare.gov.in/', 'https://icar.org.in/node/2765'],
} as const;

registerStrings({
  hi: {
    'profile.helpline.kcc': 'किसान कॉल सेंटर',
    'profile.helpline.kccDesc': 'खेती से जुड़ा कोई भी सवाल पूछें — कृषि विशेषज्ञ आपकी बोली में जवाब देते हैं।',
    'profile.helpline.free': 'मुफ़्त कॉल',
    'profile.helpline.hours': 'सुबह 6 से रात 10 बजे, सातों दिन',
    'profile.helpline.langs': '22 भाषाओं में',
    'profile.helpline.call': 'कॉल करें',
    'profile.helpline.callAria': 'किसान कॉल सेंटर को मुफ़्त कॉल करें: {number}',
    'profile.helpline.source': 'स्रोत: कृषि एवं किसान कल्याण मंत्रालय (mkisan.gov.in)',
    'profile.helpline.kvkTitle': 'कृषि विज्ञान केंद्र (KVK)',
    'profile.helpline.kvkBody':
      'मिट्टी जांच, अच्छे बीज या फसल की गंभीर समस्या के लिए अपने ज़िले के कृषि विज्ञान केंद्र या कृषि अधिकारी से मिलें। नज़दीकी KVK का पता किसान कॉल सेंटर से भी पूछ सकते हैं।',
  },
  en: {
    'profile.helpline.kcc': 'Kisan Call Centre',
    'profile.helpline.kccDesc': 'Ask any farming question — agriculture experts answer in your own language.',
    'profile.helpline.free': 'Toll-free',
    'profile.helpline.hours': '6 AM to 10 PM, all 7 days',
    'profile.helpline.langs': 'In 22 languages',
    'profile.helpline.call': 'Call',
    'profile.helpline.callAria': 'Call Kisan Call Centre for free: {number}',
    'profile.helpline.source': 'Source: Ministry of Agriculture & Farmers Welfare (mkisan.gov.in)',
    'profile.helpline.kvkTitle': 'Krishi Vigyan Kendra (KVK)',
    'profile.helpline.kvkBody':
      'For soil testing, good seed or a serious crop problem, visit the Krishi Vigyan Kendra or agriculture officer of your district. You can also ask the Kisan Call Centre for the nearest KVK.',
  },
});

/** Tap-to-call link styled like the kit's primary Button (the kit has no link variant). */
export function CallLink({ tel, children, ariaLabel, className = '' }: { tel: string; children: ReactNode; ariaLabel: string; className?: string }) {
  return (
    <a
      href={`tel:${tel}`}
      aria-label={ariaLabel}
      className={`press inline-flex min-h-12 items-center justify-center gap-2 rounded-btn bg-brand-700 px-5 py-2 text-center text-body leading-snug font-bold text-white select-none hover:bg-brand-800 active:bg-brand-800 ${className}`}
    >
      <PhoneCall aria-hidden className="size-5 shrink-0" strokeWidth={2.25} />
      <span className="min-w-0 pt-0.5">{children}</span>
    </a>
  );
}

/** Verified Kisan Call Centre card with a tap-to-call button. */
export function KisanCallCentreCard({ showSource = true }: { showSource?: boolean }) {
  const t = useT();
  return (
    <Card as="section" aria-labelledby="kcc-title" className="flex flex-col gap-3">
      <div className="flex items-start gap-3">
        <ToneIcon icon={PhoneCall} tone="green" size="lg" shape="rounded" />
        <div className="min-w-0 flex-1">
          <h3 id="kcc-title" className="text-card-title font-semibold text-ink">
            {t('profile.helpline.kcc')}
          </h3>
          <p className="mt-0.5 text-[1.5rem] leading-snug font-bold tracking-wide text-brand">{KISAN_CALL_CENTRE.number}</p>
        </div>
      </div>
      <p className="text-small text-ink-2">{t('profile.helpline.kccDesc')}</p>
      <div className="flex flex-wrap gap-2">
        <Badge tone="green">{t('profile.helpline.free')}</Badge>
        <Badge tone="sky">{t('profile.helpline.hours')}</Badge>
        <Badge tone="indigo">{t('profile.helpline.langs')}</Badge>
      </div>
      <CallLink tel={KISAN_CALL_CENTRE.tel} ariaLabel={t('profile.helpline.callAria', { number: KISAN_CALL_CENTRE.number })} className="w-full">
        {t('profile.helpline.call')} {KISAN_CALL_CENTRE.number}
      </CallLink>
      {showSource && <p className="text-caption text-ink-3">{t('profile.helpline.source')}</p>}
    </Card>
  );
}
