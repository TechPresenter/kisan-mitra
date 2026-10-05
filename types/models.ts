// Core data models for Kisan Mitra 2.0. Everything persists on-device (see lib/store.ts);
// ids are strings so records can later sync to a backend without remapping.

export type ID = string;
/** ISO date (YYYY-MM-DD) in the farmer's local time zone. */
export type ISODate = string;
/** ISO timestamp (Date#toISOString). */
export type ISOTime = string;

export type AreaUnit = 'acre' | 'bigha' | 'hectare';
export type SoilType = 'alluvial' | 'black' | 'red' | 'laterite' | 'sandy' | 'clay' | 'loamy' | 'unknown';
export type IrrigationType = 'canal' | 'tubewell' | 'drip' | 'sprinkler' | 'rainfed' | 'pond' | 'other';
export type FarmingType = 'conventional' | 'organic' | 'natural' | 'mixed';

export interface GeoPlace {
  /** Display name, usually in Hindi (e.g. "वाराणसी"). */
  name: string;
  /** English name when known (used for search / grounding prompts). */
  nameEn?: string;
  district?: string;
  state?: string;
  lat: number;
  lon: number;
}

// ---------- Users & farms ----------

export interface UserProfile {
  name: string;
  email?: string;
  phone?: string;
  picture?: string;
  village?: string;
  district?: string;
  state?: string;
  /** Total land the farmer reports during onboarding. */
  landArea?: number;
  landUnit?: AreaUnit;
  farmingType?: FarmingType;
  soilType?: SoilType;
  irrigation?: IrrigationType;
  /** Crop catalog keys chosen during onboarding (see data/crops.ts). */
  cropKeys?: string[];
  isVerified?: boolean;
  onboardedAt?: ISOTime;
}

export interface Farm {
  id: ID;
  name: string;
  place?: GeoPlace;
  area: number;
  unit: AreaUnit;
  soilType?: SoilType;
  irrigation?: IrrigationType;
  createdAt: ISOTime;
}

// ---------- Crops ----------

export type CropStage =
  | 'planned'
  | 'germination'
  | 'vegetative'
  | 'flowering'
  | 'fruiting'
  | 'maturity'
  | 'harvested';

export interface Crop {
  id: ID;
  /** Key into the crop catalog (data/crops.ts); 'other' for free-text crops. */
  cropKey: string;
  /** Display name (Hindi by default), editable by the farmer. */
  name: string;
  variety?: string;
  farmId?: ID;
  area: number;
  unit: AreaUnit;
  sowingDate?: ISODate;
  /** For transplanted crops (paddy, onion, tomato…): date seedlings went to the field. */
  transplantDate?: ISODate;
  /** Growing season; inferred from the sowing date when absent (see data/crops.ts timelineFor). */
  season?: 'kharif' | 'rabi' | 'zaid';
  expectedHarvestDate?: ISODate;
  soilType?: SoilType;
  irrigation?: IrrigationType;
  place?: GeoPlace;
  notes?: string;
  createdAt: ISOTime;
  updatedAt: ISOTime;
}

export type RiskLevel = 'low' | 'medium' | 'high';

export interface CropAdvisory {
  id: ID;
  cropId: ID;
  generatedAt: ISOTime;
  /** Short imperative lines in the farmer's language. */
  today: string[];
  thisWeek: string[];
  thisMonth?: string[];
  nextTask?: { title: string; due?: ISODate };
  risks: { level: RiskLevel; text: string }[];
  health?: { status: 'good' | 'watch' | 'risk'; note: string };
  source: 'ai' | 'rules';
}

/** "आज किसान के लिए" daily recommendation lines on Home. */
export interface DailyRecommendation {
  kind: 'do' | 'warn' | 'info';
  text: string;
  cropId?: ID;
}

// ---------- Weather ----------

export interface CurrentWeather {
  temperatureC: number;
  feelsLikeC?: number;
  humidityPct: number;
  windKmh: number;
  windGustKmh?: number;
  precipitationMm?: number;
  /** WMO weather code (https://open-meteo.com/en/docs). */
  weatherCode: number;
  isDay: boolean;
}

export interface DailyForecast {
  date: ISODate;
  weatherCode: number;
  tempMaxC: number;
  tempMinC: number;
  rainProbabilityPct: number;
  rainMm: number;
  windMaxKmh: number;
  sunrise?: ISOTime;
  sunset?: ISOTime;
  uvIndexMax?: number;
}

export interface HourlyForecast {
  time: ISOTime;
  temperatureC: number;
  rainProbabilityPct: number;
  rainMm: number;
  windKmh: number;
  humidityPct: number;
  weatherCode: number;
}

export type WeatherAlertKind = 'heavy-rain' | 'heatwave' | 'frost' | 'strong-wind' | 'cold-wave' | 'storm';

export interface WeatherAlert {
  kind: WeatherAlertKind;
  severity: 'important' | 'urgent';
  /** First forecast date the alert applies to. */
  date: ISODate;
  title: string;
  message: string;
}

export interface SprayAdvice {
  suitable: boolean;
  /** e.g. "शाम 4–6 बजे" */
  bestWindow?: string;
  reason: string;
}

export interface WeatherSnapshot {
  place: GeoPlace;
  fetchedAt: ISOTime;
  current: CurrentWeather;
  daily: DailyForecast[];
  hourly: HourlyForecast[];
  /** European/US AQI from Open-Meteo air-quality API when available. */
  aqi?: number;
  alerts: WeatherAlert[];
  spray: SprayAdvice;
}

// ---------- Mandi ----------

export type PriceTrend = 'up' | 'down' | 'stable';

export interface GroundingSource {
  title: string;
  uri: string;
}

export interface MandiPrice {
  /** Crop catalog key when matched, else a slug of the commodity name. */
  commodityKey: string;
  commodity: string;
  market?: string;
  /** Modal price in ₹ per quintal. */
  price: number;
  minPrice?: number;
  maxPrice?: number;
  /** Previous reported modal price (₹/quintal) when the source gives one. */
  previousPrice?: number;
  changePct?: number;
  trend: PriceTrend;
  /** Date the price refers to, as reported by the source. */
  priceDate?: ISODate;
}

export interface MandiSnapshot {
  place: GeoPlace;
  fetchedAt: ISOTime;
  prices: MandiPrice[];
  nearbyMandis: string[];
  sources: GroundingSource[];
  /** Always true for AI/search-derived prices; shown as a disclaimer. */
  indicative: true;
}

/** One locally observed price per commodity per day, used to build our own 7-day trend. */
export interface MandiHistoryPoint {
  commodityKey: string;
  date: ISODate;
  price: number;
  market?: string;
}

// ---------- AI ----------

export interface StructuredAnswer {
  /** समस्या */
  problem?: string;
  /** संभावित कारण */
  causes?: string[];
  /** क्या करें */
  doList?: string[];
  /** क्या न करें */
  dontList?: string[];
  /** कब दोबारा जांचें */
  recheck?: string;
}

export interface AIMessage {
  id: ID;
  role: 'user' | 'assistant';
  text: string;
  /** Compressed JPEG data URL (thumbnail-sized) for user photos. */
  image?: string;
  structured?: StructuredAnswer;
  sources?: GroundingSource[];
  createdAt: ISOTime;
  error?: boolean;
  viaVoice?: boolean;
}

export interface AIConversation {
  id: ID;
  title: string;
  createdAt: ISOTime;
  updatedAt: ISOTime;
  messages: AIMessage[];
}

export interface CropDiagnosis {
  id: ID;
  cropKey: string;
  cropName: string;
  /** Compressed JPEG data URL. */
  image: string;
  createdAt: ISOTime;
  healthy: boolean;
  issue: string;
  issueEn?: string;
  /** Model-reported confidence 0–100; always presented as an estimate. */
  confidence: number;
  symptoms: string[];
  causes: string[];
  immediate: string[];
  organic: string[];
  chemical: string[];
  prevention: string[];
  /** When the model could not analyse the photo (blurry, not a plant…). */
  unusableReason?: string;
}

// ---------- Soil, money, tasks ----------

export interface SoilReport {
  id: ID;
  farmId?: ID;
  date: ISODate;
  ph?: number;
  /** Available N, kg/ha */
  nitrogen?: number;
  /** Available P (P2O5), kg/ha */
  phosphorus?: number;
  /** Available K (K2O), kg/ha */
  potassium?: number;
  /** Organic carbon, % */
  organicCarbon?: number;
  soilType?: SoilType;
  score: number;
  recommendations?: string[];
  createdAt: ISOTime;
}

export type ExpenseCategory = 'seed' | 'fertilizer' | 'pesticide' | 'labour' | 'irrigation' | 'machine' | 'diesel' | 'other';
export type IncomeCategory = 'crop-sale' | 'mandi-sale' | 'other';

export interface FarmExpense {
  id: ID;
  category: ExpenseCategory;
  amount: number;
  date: ISODate;
  cropId?: ID;
  farmId?: ID;
  note?: string;
  createdAt: ISOTime;
}

export interface FarmIncome {
  id: ID;
  category: IncomeCategory;
  amount: number;
  date: ISODate;
  /** Quantity sold in quintals, optional. */
  quantityQtl?: number;
  cropId?: ID;
  farmId?: ID;
  note?: string;
  createdAt: ISOTime;
}

export type TaskType =
  | 'seed-treatment'
  | 'sowing'
  | 'irrigation'
  | 'fertilizer'
  | 'pest-scouting'
  | 'crop-protection'
  | 'weeding'
  | 'harvest'
  | 'other';

export interface FarmingTask {
  id: ID;
  title: string;
  type: TaskType;
  dueDate: ISODate;
  cropId?: ID;
  done: boolean;
  doneAt?: ISOTime;
  /** Local notification time, if the farmer set a reminder. */
  reminderAt?: ISOTime;
  source: 'auto' | 'user';
  /** For auto tasks: `${cropKey}:${templateId}` (data/task-templates.ts) so text follows the UI language. */
  templateId?: string;
  note?: string;
}

// ---------- Schemes, notifications, saved ----------

export type SchemeCategory = 'support' | 'insurance' | 'credit' | 'subsidy' | 'machinery' | 'seed' | 'irrigation';

export interface GovernmentScheme {
  id: ID;
  name: string;
  nameHi: string;
  category: SchemeCategory;
  ministry?: string;
  summaryHi: string;
  eligibilityHi: string[];
  benefitsHi: string[];
  documentsHi: string[];
  howToApplyHi: string[];
  officialUrl: string;
  /** Other official pages consulted. */
  sourceUrls: string[];
  /** Date the details were last checked against the official source. */
  lastVerified: ISODate;
}

export type NotificationCategory = 'weather' | 'crop' | 'mandi' | 'government' | 'reminder' | 'ai';
export type NotificationPriority = 'normal' | 'important' | 'urgent';

/** Where tapping a notification / saved item / search hit should go. */
export interface NavTarget {
  screen: string;
  params?: Record<string, unknown>;
}

export interface AppNotification {
  id: ID;
  category: NotificationCategory;
  priority: NotificationPriority;
  title: string;
  body: string;
  createdAt: ISOTime;
  read: boolean;
  /** Stable key so the same alert is not added twice (e.g. "weather:heavy-rain:2026-10-06"). */
  dedupeKey?: string;
  target?: NavTarget;
}

export type SavedType = 'ai-answer' | 'guide' | 'advice' | 'mandi-crop' | 'scheme' | 'diagnosis' | 'soil-report';

export interface SavedItem {
  id: ID;
  type: SavedType;
  /** Stable id of the underlying thing (message id, scheme id…) so it can be un-saved. */
  refId: string;
  title: string;
  snippet: string;
  target?: NavTarget;
  savedAt: ISOTime;
}

// ---------- Future modules (feature-flagged) ----------

export interface CommunityPost {
  id: ID;
  authorName: string;
  cropKey?: string;
  text: string;
  image?: string;
  createdAt: ISOTime;
  likes: number;
  /** Only answers marked by a verified expert may be shown as verified advice. */
  verifiedAnswer?: { expertName: string; text: string };
}

export interface Expert {
  id: ID;
  name: string;
  specialization: string;
  experienceYears: number;
  languages: string[];
  availability: string;
  feeInr: number;
  modes: ('chat' | 'voice' | 'video')[];
}

// ---------- App settings ----------

export interface AppSettings {
  languageCode: string;
  theme: 'light' | 'dark';
  /** 1 = default; 1.15 / 1.3 for large text. */
  textScale: 1 | 1.15 | 1.3;
  highContrast: boolean;
  voiceURI?: string | null;
  notifications: {
    enabled: boolean;
    weather: boolean;
    crop: boolean;
    mandi: boolean;
    government: boolean;
    reminders: boolean;
  };
  /** Local definition of 1 bigha in square metres (varies by state). */
  bighaSqm: number;
  bighaPreset?: string;
}
