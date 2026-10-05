// Location picker sheet: GPS detection, search (Hindi or English, with voice) and popular
// agricultural districts. Used by Home, Weather, Mandi, Onboarding and Profile.
import { useEffect, useRef, useState } from 'react';
import { LocateFixed, MapPin } from 'lucide-react';
import { Button, ListGroup, ListRow, SearchBar, Sheet, SkeletonList, ToneIcon, toast } from '../ui';
import { placeLabel, usePlace } from '../../lib/app-state';
import { useT } from '../../lib/i18n';
import { POPULAR_PLACES, LocationError, detectCurrentPlace, searchPlaces } from '../../services/location';
import type { GeoPlace } from '../../types/models';
import '../../services/location-strings';
import './strings';

export interface LocationSheetProps {
  open: boolean;
  onClose: () => void;
  /** Called after the place is chosen. By default the choice also becomes the app's selected place. */
  onSelect?: (place: GeoPlace) => void;
  /** Set false to only report the choice (e.g. picking a farm's location). */
  setAsCurrent?: boolean;
  title?: string;
  /** The place being edited (defaults to the app's selected place) — shown and ticked in the list. */
  current?: GeoPlace;
}

export function LocationSheet({ open, onClose, onSelect, setAsCurrent = true, title, current }: LocationSheetProps) {
  const t = useT();
  const [appPlace, setPlace] = usePlace();
  const place = current ?? appPlace;
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<GeoPlace[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [detecting, setDetecting] = useState(false);
  const seq = useRef(0);

  useEffect(() => {
    if (!open) {
      setQuery('');
      setResults(null);
    }
  }, [open]);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setResults(null);
      setSearching(false);
      return;
    }
    const id = ++seq.current;
    setSearching(true);
    const timer = setTimeout(async () => {
      try {
        const found = await searchPlaces(q);
        if (seq.current === id) setResults(found);
      } catch {
        if (seq.current === id) {
          setResults([]);
          toast.error(t('location.error.search'));
        }
      } finally {
        if (seq.current === id) setSearching(false);
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [query, t]);

  const choose = (p: GeoPlace) => {
    if (setAsCurrent) setPlace(p);
    onSelect?.(p);
    onClose();
  };

  const detect = async () => {
    setDetecting(true);
    try {
      choose(await detectCurrentPlace());
    } catch (e) {
      const code = e instanceof LocationError ? e.code : 'unavailable';
      toast.error(t(`location.error.${code}`));
    } finally {
      setDetecting(false);
    }
  };

  const rows = (list: GeoPlace[]) =>
    list.map(p => (
      <ListRow
        key={`${p.lat},${p.lon},${p.name}`}
        variant="plain"
        leading={<ToneIcon icon={MapPin} tone="green" size="sm" />}
        title={p.name}
        subtitle={[p.district && p.district !== p.name ? p.district : null, p.state].filter(Boolean).join(', ') || undefined}
        trailing={p.lat === place.lat && p.lon === place.lon ? <span className="text-small font-semibold text-brand-700">✓</span> : undefined}
        onPress={() => choose(p)}
      />
    ));

  return (
    <Sheet open={open} onClose={onClose} size="tall" title={title || t('shared.location.title')} description={placeLabel(place)}>
      <div className="space-y-4">
        <SearchBar value={query} onChange={setQuery} voice placeholder={t('location.searchPlaceholder')} />
        <Button variant="secondary" fullWidth icon={LocateFixed} loading={detecting} onClick={detect}>
          {detecting ? t('location.detecting') : t('location.useCurrent')}
        </Button>
        {query.trim().length >= 2 ? (
          searching && !results ? (
            <SkeletonList rows={4} variant="plain" media="circle" />
          ) : results && results.length ? (
            <ListGroup ariaLabel={t('shared.location.results')}>{rows(results)}</ListGroup>
          ) : (
            <p className="text-center text-ink-2 py-6">{t('location.noResults')}</p>
          )
        ) : (
          <section>
            <h3 className="text-small font-semibold text-ink-2 mb-2 px-1">{t('location.popular')}</h3>
            <ListGroup ariaLabel={t('location.popular')}>{rows(POPULAR_PLACES)}</ListGroup>
          </section>
        )}
      </div>
    </Sheet>
  );
}

export default LocationSheet;
