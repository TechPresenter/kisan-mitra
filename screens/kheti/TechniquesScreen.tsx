// "खेती तकनीक": every technique in the catalog, filterable by tag and searchable (Hindi or
// English, voice too). Content ships in data/techniques.ts, so this works fully offline.
// Params: techniques { tag?: string (Hindi tag), q?: string }
import { useMemo, useState } from 'react';
import '../../lib/common-strings';
import './strings';
import { EmptyArt } from '../../components/illustrations';
import { ChipGroup, EmptyState, Screen, SearchBar, type ChipOption } from '../../components/ui';
import { TECHNIQUES, TECHNIQUE_TAGS, searchTechniques } from '../../data/techniques';
import { track } from '../../lib/analytics';
import { useLanguage, useT } from '../../lib/i18n';
import { useNav, useRoute } from '../../lib/nav';
import { TechniqueCard, techniqueTagText } from './parts';

const ALL = 'all';

export default function TechniquesScreen() {
  const t = useT();
  const nav = useNav();
  const { params } = useRoute<{ tag?: string; q?: string }>();
  const { language } = useLanguage();
  const lang = language.code;

  const initialTag = params.tag && TECHNIQUE_TAGS.some(x => x.hi === params.tag) ? params.tag : ALL;
  const [tag, setTag] = useState<string>(initialTag);
  const [query, setQuery] = useState<string>(typeof params.q === 'string' ? params.q : '');

  const options = useMemo<ChipOption[]>(
    () => [
      { value: ALL, label: t('kheti.tech.all') },
      ...TECHNIQUE_TAGS.map(x => ({ value: x.hi, label: techniqueTagText(x, lang) })),
    ],
    [t, lang],
  );

  const list = useMemo(() => {
    const q = query.trim();
    const base = q ? searchTechniques(q, TECHNIQUES.length) : TECHNIQUES;
    return tag === ALL ? base : base.filter(x => x.tagHi === tag);
  }, [query, tag]);

  const reset = () => {
    setQuery('');
    setTag(ALL);
  };

  return (
    <Screen title={t('kheti.tech.title')} subtitle={t('kheti.tech.subtitle')}>
      <div className="flex flex-col gap-3">
        <SearchBar
          value={query}
          onChange={setQuery}
          onSubmit={q => track('search', { area: 'techniques', results: q.trim() ? searchTechniques(q, TECHNIQUES.length).length : 0 })}
          voice
          placeholder={t('kheti.tech.search')}
          ariaLabel={t('kheti.tech.search')}
        />
        <ChipGroup ariaLabel={t('kheti.tech.filter')} value={tag} onChange={setTag} options={options} />
      </div>

      {list.length ? (
        <section aria-label={t('kheti.tech.list')} className="flex flex-col gap-3">
          <p className="text-small text-ink-2" aria-live="polite">
            {list.length === 1 ? t('kheti.tech.countOne') : t('kheti.tech.count', { n: list.length })}
          </p>
          <ul className="flex flex-col gap-3">
            {list.map(tech => (
              <li key={tech.id}>
                <TechniqueCard tech={tech} lang={lang} onPress={() => nav.push('technique', { id: tech.id })} />
              </li>
            ))}
          </ul>
        </section>
      ) : (
        <EmptyState
          art={<EmptyArt kind="search" />}
          title={t('kheti.tech.emptyTitle')}
          body={t('kheti.tech.emptyBody')}
          action={{ label: t('kheti.tech.showAll'), onPress: reset }}
        />
      )}
    </Screen>
  );
}
