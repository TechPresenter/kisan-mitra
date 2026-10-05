// Kisan Mitra UI kit. Import from 'components/ui' (see docs/UI_KIT.md).
import './strings';

export { cx } from './cx';
export { renderIcon, DUOTONE, type IconLike } from './icon';
export { TONES, TINT_BG, TONE_TEXT, TONE_FILL, SOLID_BG, LEVEL_TONE, toneFor, toneVar, type Tone, type LevelStatus } from './tones';
export { applyAppearance, useApplyAppearance, type Appearance } from './theme';
export { useOptionalNav, useElementWidth, useRoving, useModalFocus, usePresence } from './hooks';

// Layout
export { Screen, type ScreenProps } from './Screen';
export { AppBar, AppBarActions, HeaderPill, type AppBarProps, type AppBarAction, type HeaderPillProps } from './AppBar';
export { BottomNav, type BottomNavProps, type BottomNavItem } from './BottomNav';
export { SectionHeader, type SectionHeaderProps, type SectionAction } from './SectionHeader';

// Actions
export { Button, type ButtonProps, type ButtonVariant } from './Button';
export { IconButton, type IconButtonProps, type IconButtonVariant } from './IconButton';
export { Spinner, type SpinnerProps } from './Spinner';

// Surfaces & lists
export { Card, type CardProps, type CardTone } from './Card';
export { ListRow, ListGroup, type ListRowProps, type ListGroupProps } from './ListRow';
export { ToneIcon, Thumbnail, DateTile, PaginationDots, type ToneIconProps, type ThumbnailProps, type DateTileProps, type PaginationDotsProps } from './Media';
export { Avatar, initials, type AvatarProps } from './Avatar';
export { IconTile, TileGrid, type IconTileProps, type TileGridProps } from './IconTile';
export { StatCard, type StatCardProps } from './StatCard';
export { Callout, Disclaimer, type CalloutProps, type CalloutTone, type DisclaimerProps } from './Callout';

// Selection
export { Chip, ChipGroup, type ChipProps, type ChipGroupProps, type ChipOption } from './Chip';
export { SegmentedTabs, type SegmentedTabsProps, type SegmentOption } from './SegmentedTabs';
export { Badge, CountBadge, TrendBadge, trendOf, type BadgeProps, type CountBadgeProps, type TrendBadgeProps, type TrendDirection } from './Badge';

// Forms
export {
  FieldShell,
  TextField,
  NumberField,
  SelectField,
  DateField,
  TextArea,
  parseNumber,
  type FieldShellProps,
  type TextFieldProps,
  type NumberFieldProps,
  type SelectFieldProps,
  type SelectOption,
  type DateFieldProps,
  type TextAreaProps,
} from './Field';
export { SearchBar, type SearchBarProps } from './SearchBar';
export { Toggle, type ToggleProps } from './Toggle';
export { Checkbox, type CheckboxProps } from './Checkbox';
export { RadioCards, type RadioCardsProps, type RadioCardOption } from './RadioCards';

// Overlays
export { Sheet, SelectSheet, type SheetProps, type SelectSheetProps, type SelectSheetOption } from './Sheet';
export { Dialog, DialogHost, confirm, showAlert, type DialogProps, type DialogTone, type ConfirmOptions } from './Dialog';
export { toast, Toaster, type ToastOptions, type ToastTone, type ToasterProps } from './Toast';

// Feedback & state
export { Skeleton, SkeletonText, SkeletonCard, SkeletonList, type SkeletonProps, type SkeletonCardProps, type SkeletonListProps } from './Skeleton';
export { EmptyState, ErrorState, OfflineBanner, LastUpdated, type EmptyStateProps, type ErrorStateProps, type OfflineBannerProps, type LastUpdatedProps, type StateAction } from './States';

// Data viz
export { Gauge, gaugeTone, type GaugeProps } from './Gauge';
export { ProgressBar, LevelBar, type ProgressBarProps, type LevelBarProps } from './Progress';
export { BarChart, type BarChartProps, type BarSeries, type BarDatum } from './BarChart';
export { LineChart, Sparkline, type LineChartProps, type LinePoint, type SparklineProps } from './LineChart';
export { WeatherGlyph, weatherKind, weatherConditionKey, type WeatherGlyphProps, type WeatherKind } from './WeatherGlyph';
export { WeatherCard, WeatherChip, type WeatherCardProps, type WeatherChipProps } from './WeatherCard';
export { VIZ_COLORS, LINE_COLOR, formatCompact, tickFormatter, niceScale, type LineTone, type Scale } from './viz';

// Voice
export { MicButton, ListenButton, type MicButtonProps, type ListenButtonProps } from './Voice';
