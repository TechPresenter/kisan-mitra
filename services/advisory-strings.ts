import { registerStrings } from '../lib/i18n';

registerStrings({
  hi: {
    'advisory.sprayOk': 'आज {window} कीटनाशक/दवा छिड़काव के लिए अच्छा समय है',
    'advisory.sprayNo': 'आज छिड़काव न करें — {reason}',
    'advisory.rainTomorrow': 'कल बारिश की संभावना {pct}% — सिंचाई और छिड़काव टालें',
  },
  en: {
    'advisory.sprayOk': 'Today {window} is a good time to spray',
    'advisory.sprayNo': 'Avoid spraying today — {reason}',
    'advisory.rainTomorrow': '{pct}% chance of rain tomorrow — postpone irrigation and spraying',
  },
});
