// Privacy policy for Kisan Mitra 2.0 (Hindi first, English via strings). Content: legal-strings.ts.
import './strings';
import './legal-strings';
import { ShieldCheck } from 'lucide-react';
import { PRIVACY_SECTIONS } from './legal-strings';
import { LegalDoc } from './LegalDoc';

export default function PrivacyScreen() {
  return <LegalDoc prefix="profile.privacy" sections={PRIVACY_SECTIONS} summaryCount={4} summaryIcon={ShieldCheck} />;
}
