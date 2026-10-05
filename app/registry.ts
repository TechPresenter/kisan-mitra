// Screen registry: route name → lazily loaded screen component (code-split per screen
// so the app launches fast on low-end phones). Params are read with useRoute().params.
import { lazy, type ComponentType, type LazyExoticComponent } from 'react';

type Screen = LazyExoticComponent<ComponentType>;

export const SCREENS: Record<string, Screen> = {
  // Home tab
  home: lazy(() => import('../screens/home/HomeScreen')),
  // Weather — params: weather-day { date: ISODate }
  weather: lazy(() => import('../screens/weather/WeatherScreen')),
  'weather-day': lazy(() => import('../screens/weather/WeatherDayScreen')),
  // Mandi tab — mandi-detail { commodityKey }
  mandi: lazy(() => import('../screens/mandi/MandiScreen')),
  'mandi-detail': lazy(() => import('../screens/mandi/MandiDetailScreen')),
  // Kheti tab hub + techniques — technique { id }
  kheti: lazy(() => import('../screens/kheti/KhetiHubScreen')),
  techniques: lazy(() => import('../screens/kheti/TechniquesScreen')),
  technique: lazy(() => import('../screens/kheti/TechniqueDetailScreen')),
  // Soil — soil-report { id }
  soil: lazy(() => import('../screens/soil/SoilScreen')),
  'soil-report': lazy(() => import('../screens/soil/SoilReportScreen')),
  // My crops — crop-edit { id? , cropKey? }, crop-detail { id }, crop-advisory { id, tab?: 'today'|'week'|'month' }
  crops: lazy(() => import('../screens/crops/CropsScreen')),
  'crop-edit': lazy(() => import('../screens/crops/CropEditScreen')),
  'crop-detail': lazy(() => import('../screens/crops/CropDetailScreen')),
  'crop-advisory': lazy(() => import('../screens/crops/CropAdvisoryScreen')),
  // Calendar — calendar { cropId? }
  calendar: lazy(() => import('../screens/calendar/CalendarScreen')),
  // AI tab — ai { conversationId?, prompt?, cropId? }, ai-voice {}, ai-history {}
  ai: lazy(() => import('../screens/ai/AIChatScreen')),
  'ai-voice': lazy(() => import('../screens/ai/AIVoiceScreen')),
  'ai-history': lazy(() => import('../screens/ai/AIHistoryScreen')),
  // Crop doctor — crop-doctor { cropKey? }, diagnosis { id }
  'crop-doctor': lazy(() => import('../screens/doctor/CropDoctorScreen')),
  diagnosis: lazy(() => import('../screens/doctor/DiagnosisResultScreen')),
  'diagnosis-history': lazy(() => import('../screens/doctor/DiagnosisHistoryScreen')),
  // Money — hisab-entry { kind: 'expense'|'income', id? }
  hisab: lazy(() => import('../screens/hisab/HisabScreen')),
  'hisab-entry': lazy(() => import('../screens/hisab/HisabEntryScreen')),
  // Calculators — calculator { kind }
  calculators: lazy(() => import('../screens/calculators/CalculatorsScreen')),
  calculator: lazy(() => import('../screens/calculators/CalculatorScreen')),
  // Schemes — schemes { category? }, scheme { id }
  schemes: lazy(() => import('../screens/schemes/SchemesScreen')),
  scheme: lazy(() => import('../screens/schemes/SchemeDetailScreen')),
  // Cross-cutting — search { q? }
  notifications: lazy(() => import('../screens/notifications/NotificationsScreen')),
  search: lazy(() => import('../screens/search/SearchScreen')),
  saved: lazy(() => import('../screens/saved/SavedScreen')),
  // Profile tab — farm-edit { id? }
  profile: lazy(() => import('../screens/profile/ProfileScreen')),
  settings: lazy(() => import('../screens/profile/SettingsScreen')),
  help: lazy(() => import('../screens/profile/HelpScreen')),
  privacy: lazy(() => import('../screens/profile/PrivacyScreen')),
  terms: lazy(() => import('../screens/profile/TermsScreen')),
  farms: lazy(() => import('../screens/profile/FarmsScreen')),
  'farm-edit': lazy(() => import('../screens/profile/FarmEditScreen')),
  // Future-ready modules (feature-flagged in lib/features.ts) — community-post { id }
  community: lazy(() => import('../screens/community/CommunityScreen')),
  'community-post': lazy(() => import('../screens/community/CommunityPostScreen')),
  experts: lazy(() => import('../screens/experts/ExpertsScreen')),
};

export type ScreenName = keyof typeof SCREENS;
