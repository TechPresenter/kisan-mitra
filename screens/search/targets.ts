// Guards for stored navigation targets (notifications, saved items, search hits). A target
// written by an older build may name a screen that no longer exists; the shell would then fall
// back to Home, which is confusing, so callers show the stored text instead.
import { SCREENS } from '../../app/registry';
import type { NavTarget } from '../../types/models';

export function canOpenTarget(target: NavTarget | undefined | null, exclude?: string): target is NavTarget {
  return (
    !!target &&
    typeof target.screen === 'string' &&
    Object.prototype.hasOwnProperty.call(SCREENS, target.screen) &&
    target.screen !== exclude
  );
}
