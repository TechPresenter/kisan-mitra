// Terms & conditions for Kisan Mitra 2.0 (Hindi first, English via strings). Content: legal-strings.ts.
import './strings';
import './legal-strings';
import { FileCheck2 } from 'lucide-react';
import { TERMS_SECTIONS } from './legal-strings';
import { LegalDoc } from './LegalDoc';

export default function TermsScreen() {
  return <LegalDoc prefix="profile.terms" sections={TERMS_SECTIONS} summaryCount={4} summaryIcon={FileCheck2} />;
}
