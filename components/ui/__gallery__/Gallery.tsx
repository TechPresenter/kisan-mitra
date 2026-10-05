// Visual check of the UI kit against the reference screens (dev only, demo data inline).
import { useEffect, useState } from 'react';
import {
  Bell,
  Bot,
  Bug,
  Calculator,
  CalendarDays,
  Camera,
  CloudSun,
  Contrast,
  Droplets,
  FlaskConical,
  House,
  Image,
  Landmark,
  Languages,
  LifeBuoy,
  MapPin,
  Moon,
  Plus,
  Search,
  Settings,
  Sprout,
  Store,
  Tractor,
  Trash2,
  Type,
  UserRound,
  Wheat,
  Wind,
} from 'lucide-react';
import { useSettings } from '../../../lib/app-state';
import {
  Avatar,
  Badge,
  BarChart,
  BottomNav,
  Button,
  Callout,
  Card,
  Checkbox,
  Chip,
  ChipGroup,
  DateField,
  DateTile,
  DialogHost,
  Disclaimer,
  EmptyState,
  ErrorState,
  Gauge,
  HeaderPill,
  IconButton,
  IconTile,
  LastUpdated,
  LevelBar,
  LineChart,
  ListenButton,
  ListGroup,
  ListRow,
  MicButton,
  NumberField,
  OfflineBanner,
  PaginationDots,
  ProgressBar,
  RadioCards,
  Screen,
  SearchBar,
  SectionHeader,
  SegmentedTabs,
  SelectField,
  SelectSheet,
  Sheet,
  SkeletonCard,
  SkeletonList,
  Sparkline,
  StatCard,
  TextArea,
  TextField,
  Thumbnail,
  TileGrid,
  Toaster,
  Toggle,
  ToneIcon,
  TrendBadge,
  WeatherCard,
  WeatherChip,
  WeatherGlyph,
  confirm,
  toast,
  applyAppearance,
  useApplyAppearance,
} from '..';

type Page = 'home' | 'mandi' | 'kheti' | 'ai' | 'profile';

const NAV = [
  { key: 'home' as const, label: 'होम', icon: House },
  { key: 'mandi' as const, label: 'मंडी', icon: Store, badge: 2 },
  { key: 'kheti' as const, label: 'खेती', icon: Tractor },
  { key: 'ai' as const, label: 'AI', icon: Bot, highlight: true },
  { key: 'profile' as const, label: 'प्रोफाइल', icon: UserRound },
];

function Logo() {
  return (
    <span className="inline-flex size-10 items-center justify-center rounded-xl bg-brand-600 text-white">
      <Sprout className="size-6" strokeWidth={2.25} />
    </span>
  );
}

/** ?theme=dark&hc=1&scale=1.3 previews an appearance without touching saved settings. */
function GalleryAppearance() {
  const params = new URLSearchParams(location.search);
  if (!params.has('theme') && !params.has('hc') && !params.has('scale')) return <SavedAppearance />;
  applyAppearance({
    theme: params.get('theme') === 'dark' ? 'dark' : 'light',
    highContrast: params.get('hc') === '1',
    textScale: (Number(params.get('scale')) || 1) as 1 | 1.15 | 1.3,
  });
  return null;
}

function SavedAppearance() {
  useApplyAppearance();
  return null;
}

export function Gallery() {
  // The page lives in the URL hash so dev-server reloads keep it.
  const [page, setPageState] = useState<Page>(() => (location.hash.slice(1) as Page) || 'home');
  const setPage = (p: Page) => {
    location.hash = p;
    setPageState(p);
  };
  return (
    <div className="h-dvh">
      <GalleryAppearance />
      {page === 'home' && <HomePage />}
      {page === 'mandi' && <MandiPage />}
      {page === 'kheti' && <KhetiPage />}
      {page === 'ai' && <FormsPage />}
      {page === 'profile' && <ProfilePage />}
      <BottomNav items={NAV} active={page} onSelect={setPage} ariaLabel="मुख्य नेविगेशन" />
      <Toaster />
      <DialogHost />
    </div>
  );
}

function HomePage() {
  return (
    <Screen
      leading={<Logo />}
      title="किसान मित्र"
      actions={[
        { icon: Search, label: 'खोजें', onPress: () => toast('खोज') },
        { icon: Bell, label: 'सूचनाएं', badge: true, onPress: () => toast('सूचनाएं') },
      ]}
      headerContent={<HeaderPill icon={MapPin} label="वाराणसी, उत्तर प्रदेश" onPress={() => toast('स्थान बदलें')} />}
    >
      <WeatherCard
        title="आज का मौसम"
        temperature="32°C"
        condition="धूप खिली है (Sunny)"
        code={0}
        onPress={() => toast('मौसम')}
        chips={
          <>
            <WeatherChip icon={Droplets}>48% नमी</WeatherChip>
            <WeatherChip icon={Wind}>12 km/h</WeatherChip>
            <WeatherChip icon={CloudSun}>AQI 58</WeatherChip>
          </>
        }
      />

      <TileGrid columns={4}>
        <IconTile icon={Sprout} label="फसल सलाह" tone="green" />
        <IconTile icon={Store} label="मंडी भाव" tone="orange" />
        <IconTile icon={CloudSun} label="मौसम" tone="sky" />
        <IconTile icon={Bug} label="फसल रोग" tone="red" badge={3} />
        <IconTile icon={FlaskConical} label="मिट्टी जांच" tone="amber" />
        <IconTile icon={Landmark} label="सरकारी योजना" tone="teal" />
        <IconTile icon={CalendarDays} label="कैलेंडर" tone="rose" />
        <IconTile icon={UserRound} label="विशेषज्ञ" tone="indigo" />
      </TileGrid>

      <section className="flex flex-col gap-3">
        <SectionHeader title="मेरी फसलें" action={{ onPress: () => toast('सभी फसलें') }} />
        <ListRow
          leading={<Thumbnail fallback={<Wheat className="size-7 text-tone-amber" />} />}
          title="गेहूं"
          subtitle="2 एकड़ • बढ़वार अवस्था"
          onPress={() => toast('गेहूं')}
        />
        <ListRow
          leading={<ToneIcon icon={Droplets} tone="sky" />}
          title="सिंचाई करें"
          subtitle="अगले 2 दिन में हल्की सिंचाई करें, मिट्टी में नमी कम है।"
          trailing={<ListenButton id="g-irrigate" text="अगले 2 दिन में हल्की सिंचाई करें" variant="icon" size="sm" />}
          onPress={() => toast('सिंचाई')}
        />
      </section>

      <Callout tone="brand" title="क्या आज स्प्रे करना सही है?">
        आज शाम 4–6 बजे स्प्रे के लिए अच्छा समय है।
      </Callout>
      <Disclaimer kind="ai" />
      <SkeletonCard banner />
    </Screen>
  );
}

function MandiPage() {
  const [tab, setTab] = useState<'near' | 'crop'>('near');
  const [chip, setChip] = useState('all');
  const rows = [
    { name: 'गेहूं', price: '₹2,480/क्विंटल', trend: 1.8, data: [2390, 2410, 2405, 2430, 2440, 2465, 2480] },
    { name: 'धान', price: '₹2,183/क्विंटल', trend: -0.5, data: [2210, 2200, 2205, 2195, 2190, 2186, 2183] },
    { name: 'सरसों', price: '₹5,650/क्विंटल', trend: 0, data: [5650, 5640, 5655, 5650, 5645, 5650, 5650] },
  ];
  return (
    <Screen title="मंडी भाव" subtitle="वाराणसी मंडी" actions={[{ icon: Search, label: 'खोजें', onPress: () => {} }]} onRefresh={() => toast.success('भाव ताज़ा हुए')}>
      <OfflineBanner show />
      <SegmentedTabs
        ariaLabel="मंडी दृश्य"
        value={tab}
        onChange={setTab}
        options={[
          { value: 'near', label: 'नजदीकी मंडी' },
          { value: 'crop', label: 'फसल भाव' },
        ]}
      />
      <ChipGroup
        ariaLabel="फसल फ़िल्टर"
        value={chip}
        onChange={setChip}
        options={[
          { value: 'all', label: 'सभी' },
          { value: 'grain', label: 'अनाज' },
          { value: 'veg', label: 'सब्ज़ी' },
          { value: 'oil', label: 'तिलहन' },
          { value: 'pulse', label: 'दलहन' },
          { value: 'fruit', label: 'फल' },
        ]}
      />
      <div className="flex flex-col gap-3">
        {rows.map(r => (
          <ListRow
            key={r.name}
            leading={<Thumbnail fallback={<Wheat className="size-7 text-tone-amber" />} />}
            title={r.name}
            subtitle={<span className="font-bold text-brand-700">{r.price}</span>}
            trailing={
              <div className="flex flex-col items-end gap-1">
                <TrendBadge value={r.trend} />
                <Sparkline values={r.data} tone={r.trend > 0 ? 'up' : r.trend < 0 ? 'down' : 'stable'} className="w-16" height={24} />
              </div>
            }
            onPress={() => toast(r.name)}
          />
        ))}
      </div>
      <LastUpdated at={Date.now() - 26 * 3600_000} stale onRefresh={() => toast('ताज़ा')} />
      <Callout tone="tech" title="AI बाजार संकेत" action={<Button size="sm" variant="tech">AI सुझाव देखें</Button>}>
        गेहूं के भाव अगले 2 हफ्तों में स्थिर से हल्के ऊपर रह सकते हैं।
      </Callout>
      <Card>
        <SectionHeader title="गेहूं — पिछले 7 दिन" as="h3" className="mb-3" />
        <LineChart
          title="गेहूं का भाव"
          formatValue={n => `₹${n.toLocaleString('en-IN')}`}
          data={['मंगल', 'बुध', 'गुरु', 'शुक्र', 'शनि', 'रवि', 'सोम'].map((label, i) => ({ label, value: rows[0].data[i] }))}
        />
      </Card>
      <Disclaimer kind="price" />
    </Screen>
  );
}

function KhetiPage() {
  const [done, setDone] = useState<Record<string, boolean>>({ a: true });
  return (
    <Screen
      tone="hero"
      title="मौसम"
      subtitle="वाराणसी"
      hero={
        <div className="appbar-pt bg-weather px-5 pb-8 text-white">
          <div className="mt-4 flex items-center justify-between">
            <div>
              <p className="text-[3rem] leading-none font-bold">32°C</p>
              <p className="mt-2 text-body">धूप खिली है (Sunny)</p>
            </div>
            <WeatherGlyph code={1} colored={false} className="size-24 text-[#ffd54f]" />
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <WeatherChip icon={Droplets}>48% नमी</WeatherChip>
            <WeatherChip icon={Wind}>12 km/h</WeatherChip>
          </div>
        </div>
      }
      footer={
        <Button fullWidth size="lg" onClick={() => toast.success('सेव हो गया', { action: { label: 'वापस लें', onPress: () => {} } })}>
          सेव करें
        </Button>
      }
    >
      <Card padding="sm">
        <p className="px-1 pb-2 text-small font-semibold text-ink">अगले 7 दिन का अनुमान</p>
        <div className="grid grid-cols-7 text-center">
          {[0, 2, 3, 61, 80, 95, 45].map((code, i) => (
            <div key={i} className="flex flex-col items-center gap-1 py-1">
              <span className="text-caption text-ink-2">{['सोम', 'मंगल', 'बुध', 'गुरु', 'शुक्र', 'शनि', 'रवि'][i]}</span>
              <WeatherGlyph code={code} className="size-6" />
              <span className="text-small font-semibold text-ink">{32 - i}°</span>
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <Gauge value={72} label="मध्यम" tone="orange" caption="मिट्टी स्वास्थ्य स्कोर" />
        <div className="mt-2 divide-y divide-line">
          <LevelBar label="pH" detail="6.8" value={68} status="good" />
          <LevelBar label="नाइट्रोजन (N)" detail="180 kg/ha" value={30} status="low" />
          <LevelBar label="फॉस्फोरस (P)" value={55} status="medium" />
          <LevelBar label="पोटाश (K)" value={88} status="high" />
        </div>
      </Card>

      <section className="flex flex-col gap-3">
        <SectionHeader title="कैलेंडर" />
        {[
          ['a', '2026-10-15', 'गेहूं की बुवाई', 'खेत की तैयारी पूरी करें'],
          ['b', '2026-10-22', 'पहली सिंचाई', 'बुवाई के 21 दिन बाद'],
        ].map(([id, date, title, sub]) => (
          <ListRow
            key={id}
            leading={<DateTile date={date} />}
            title={title}
            subtitle={sub}
            trailing={<Checkbox checked={!!done[id]} onChange={v => setDone(d => ({ ...d, [id]: v }))} aria-label={`${title} पूरा`} />}
          />
        ))}
      </section>

      <div className="grid grid-cols-2 gap-3">
        <StatCard label="कुल खर्च" value="₹28,500" tone="red" />
        <StatCard label="कुल आय" value="₹1,25,000" tone="green" />
      </div>
      <StatCard size="lg" label="अनुमानित लाभ" value="₹43,500" tone="teal" hint="यह सीजन • गेहूं" />
      <Card>
        <SectionHeader title="खर्च और आय" as="h3" className="mb-3" />
        <BarChart
          title="खर्च और आय"
          series={[
            { key: 'income', label: 'आय' },
            { key: 'expense', label: 'खर्च' },
          ]}
          formatValue={n => `₹${n.toLocaleString('en-IN')}`}
          data={[
            { label: 'अग', values: [12000, 8000] },
            { label: 'सित', values: [18000, 9500] },
            { label: 'अक्टू', values: [42000, 11000] },
            { label: 'नवं', values: [0, 4000] },
          ]}
        />
      </Card>
      <TileGrid columns={2}>
        <IconTile variant="card" icon={Sprout} label="बीज कैलकुलेटर" tone="green" description="प्रति एकड़ बीज" />
        <IconTile variant="card" icon={FlaskConical} label="खाद कैलकुलेटर" tone="amber" />
        <IconTile variant="card" icon={Droplets} label="सिंचाई कैलकुलेटर" tone="sky" />
        <IconTile variant="card" icon={Calculator} label="लाभ कैलकुलेटर" tone="indigo" />
      </TileGrid>
      <ProgressBar label="फसल अवस्था" valueLabel="60%" value={60} />
    </Screen>
  );
}

function FormsPage() {
  const [q, setQ] = useState('');
  const [name, setName] = useState('');
  const [area, setArea] = useState<number | null>(2);
  const [unit, setUnit] = useState('acre');
  const [date, setDate] = useState('2026-10-05');
  const [note, setNote] = useState('');
  const [toggle, setToggle] = useState(true);
  const [farming, setFarming] = useState<string | null>('organic');
  const [crops, setCrops] = useState<string[]>(['wheat']);
  const [period, setPeriod] = useState('week');
  const [dot, setDot] = useState(1);
  return (
    <Screen title="फसल डॉक्टर" subtitle="फोटो से पहचानें फसल की समस्या" back={() => toast('वापस')}>
      <SearchBar value={q} onChange={setQ} voice placeholder="फसल, रोग या योजना खोजें" />
      <div className="flex flex-col gap-3">
        <Button fullWidth size="lg" icon={Camera}>
          फोटो लें
        </Button>
        <Button fullWidth variant="secondary" icon={Image}>
          गैलरी से चुनें
        </Button>
        <div className="flex flex-wrap gap-2">
          <Button size="sm">प्राथमिक</Button>
          <Button size="sm" variant="ghost">
            घोस्ट
          </Button>
          <Button size="sm" variant="soft" icon={Plus}>
            जोड़ें
          </Button>
          <Button size="sm" variant="danger" icon={Trash2}>
            हटाएं
          </Button>
          <Button size="sm" variant="tech" loading>
            AI
          </Button>
          <Chip label="यह सीजन" dropdown />
          <Chip label="चुना" selected />
        </div>
      </div>
      <Card className="flex flex-col gap-4">
        <TextField label="नाम" value={name} onValueChange={setName} placeholder="जैसे: राम कुमार" hint="जैसा आधार कार्ड पर है" />
        <NumberField label="ज़मीन" value={area} onChange={setArea} unit="एकड़" min={0} max={500} step={0.5} stepper />
        <SelectField
          label="इकाई"
          value={unit}
          onChange={setUnit}
          options={[
            { value: 'acre', label: 'एकड़' },
            { value: 'bigha', label: 'बीघा' },
            { value: 'hectare', label: 'हेक्टेयर' },
          ]}
        />
        <DateField label="बुवाई की तारीख" value={date} onChange={setDate} />
        <TextField label="मोबाइल" inputMode="tel" prefix="+91" error="10 अंकों का नंबर लिखें" value="98765" onValueChange={() => {}} />
        <TextArea
          label="समस्या बताएं"
          optional
          value={note}
          onChange={setNote}
          maxLength={300}
          placeholder="पत्तियों पर पीले धब्बे…"
          trailing={<MicButton size="sm" onResult={text => setNote(n => (n ? `${n} ${text}` : text))} />}
        />
        <Toggle checked={toggle} onChange={setToggle} label="मौसम चेतावनी" description="तेज़ बारिश और पाले की सूचना" icon={Bell} />
      </Card>
      <RadioCards
        label="खेती का तरीका"
        value={farming}
        onChange={setFarming}
        options={[
          { value: 'conventional', label: 'सामान्य खेती', description: 'रासायनिक खाद के साथ', icon: Tractor, tone: 'orange' },
          { value: 'organic', label: 'जैविक खेती', description: 'गोबर खाद, जीवामृत', icon: Sprout, tone: 'green' },
        ]}
      />
      <RadioCards
        multiple
        columns={3}
        label="आपकी फसलें"
        value={crops}
        onChange={setCrops}
        options={[
          { value: 'wheat', label: 'गेहूं', icon: Wheat, tone: 'amber' },
          { value: 'paddy', label: 'धान', icon: Sprout, tone: 'green' },
          { value: 'mustard', label: 'सरसों', icon: Sprout, tone: 'amber' },
        ]}
      />
      <div className="flex items-center gap-3">
        <MicButton size="lg" variant="solid" onResult={t => toast(t)} />
        <ListenButton id="g-listen" text="यह AI आधारित प्रारंभिक सुझाव है।" />
      </div>
      <SegmentedTabs
        size="sm"
        ariaLabel="समय चुनें"
        value={period}
        onChange={setPeriod}
        options={[
          { value: 'today', label: 'आज' },
          { value: 'week', label: 'इस सप्ताह' },
          { value: 'month', label: 'इस महीने' },
        ]}
      />
      <div className="flex items-center justify-between">
        <PaginationDots count={3} index={dot} onSelect={setDot} />
        <Toggle checked={toggle} onChange={setToggle} aria-label="मौसम चेतावनी" />
      </div>
    </Screen>
  );
}

function ProfilePage() {
  const [settings, update] = useSettings();
  const [sheet, setSheet] = useState(false);
  const [pick, setPick] = useState(false);
  const [season, setSeason] = useState('rabi');
  // ?open=sheet|select|confirm|toast opens an overlay on load (for screenshots).
  useEffect(() => {
    const open = new URLSearchParams(location.search).get('open');
    if (open === 'sheet') setSheet(true);
    if (open === 'select') setPick(true);
    if (open === 'confirm') confirm({ title: 'क्या आप इसे हटाना चाहते हैं?', message: 'यह खर्च हमेशा के लिए हट जाएगा।', tone: 'danger', icon: Trash2 });
    if (open === 'toast') {
      toast.success('सेव हो गया', { action: { label: 'वापस लें', onPress: () => {} }, duration: 60_000 });
      toast.error('इंटरनेट नहीं है', { duration: 60_000 });
    }
  }, []);
  return (
    <Screen title="प्रोफाइल" back={false}>
      <div className="flex flex-col items-center gap-2 pt-2">
        <Avatar name="राम कुमार" size="xl" />
        <p className="text-section font-bold text-ink">राम कुमार</p>
        <p className="text-small text-ink-2">+91 98765 43210</p>
        <Badge tone="green">सत्यापित किसान</Badge>
      </div>
      <ListGroup ariaLabel="प्रोफाइल विकल्प">
        <ListRow variant="plain" leading={<ToneIcon icon={Tractor} tone="green" size="sm" />} title="मेरे खेत" onPress={() => setSheet(true)} />
        <ListRow variant="plain" leading={<ToneIcon icon={Settings} tone="gray" size="sm" />} title="सेटिंग्स" onPress={() => setPick(true)} />
        <ListRow variant="plain" leading={<ToneIcon icon={Languages} tone="sky" size="sm" />} title="भाषा" trailing={<span className="text-small text-ink-2">हिंदी</span>} chevron onPress={() => {}} />
        <ListRow variant="plain" leading={<ToneIcon icon={LifeBuoy} tone="rose" size="sm" />} title="सहायता केंद्र" onPress={() => {}} />
      </ListGroup>
      <Card className="flex flex-col">
        <Toggle checked={settings.theme === 'dark'} onChange={v => update({ theme: v ? 'dark' : 'light' })} label="डार्क मोड" icon={Moon} />
        <Toggle checked={settings.highContrast} onChange={v => update({ highContrast: v })} label="हाई कंट्रास्ट" icon={Contrast} />
        <div className="flex items-center gap-3 py-2">
          <Type aria-hidden className="size-5.5 text-ink-2" />
          <SegmentedTabs
            className="flex-1"
            ariaLabel="अक्षर का आकार"
            value={String(settings.textScale)}
            onChange={v => update({ textScale: Number(v) as 1 | 1.15 | 1.3 })}
            options={[
              { value: '1', label: 'सामान्य' },
              { value: '1.15', label: 'बड़ा' },
              { value: '1.3', label: 'सबसे बड़ा' },
            ]}
          />
        </div>
      </Card>
      <div className="grid grid-cols-2 gap-3">
        <Button variant="secondary" onClick={() => toast.success('सेव हो गया', { action: { label: 'वापस लें', onPress: () => {} } })}>
          टोस्ट
        </Button>
        <Button
          variant="danger"
          onClick={async () => {
            const ok = await confirm({ title: 'क्या आप इसे हटाना चाहते हैं?', message: 'यह खर्च हमेशा के लिए हट जाएगा।', tone: 'danger', icon: Trash2 });
            toast(ok ? 'हटाया गया' : 'रद्द किया');
          }}
        >
          कन्फर्म
        </Button>
      </div>
      <SkeletonList rows={2} trailing />
      <EmptyState icon={Sprout} title="अभी कोई फसल नहीं जोड़ी" body="अपनी फसल जोड़ें और रोज़ की सलाह पाएं।" action={{ label: 'नई फसल जोड़ें', onPress: () => {}, icon: Plus }} />
      <ErrorState compact onRetry={() => {}} />
      <ErrorState onRetry={() => {}} />
      <Sheet
        open={sheet}
        onClose={() => setSheet(false)}
        title="मेरे खेत"
        description="खेत चुनें या नया जोड़ें"
        footer={
          <Button fullWidth size="lg" onClick={() => setSheet(false)}>
            आगे बढ़ें
          </Button>
        }
      >
        <div className="flex flex-col gap-3">
          <ListRow leading={<ToneIcon icon={Tractor} tone="green" />} title="बड़ा खेत" subtitle="3 एकड़ • दोमट मिट्टी" onPress={() => {}} />
          <ListRow leading={<ToneIcon icon={Tractor} tone="amber" />} title="नदी वाला खेत" subtitle="1.5 एकड़" onPress={() => {}} />
        </div>
      </Sheet>
      <SelectSheet
        open={pick}
        onClose={() => setPick(false)}
        title="सीजन चुनें"
        value={season}
        onChange={setSeason}
        options={[
          { value: 'rabi', label: 'रबी', description: 'अक्टूबर – मार्च' },
          { value: 'kharif', label: 'खरीफ', description: 'जून – अक्टूबर' },
          { value: 'zaid', label: 'ज़ायद', description: 'मार्च – जून' },
        ]}
      />
      <IconButton icon={Settings} label="सेटिंग्स" variant="soft" badge={4} onClick={() => setPick(true)} />
    </Screen>
  );
}
