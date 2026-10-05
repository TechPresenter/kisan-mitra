// Android status/navigation bar icon colour for the screens shown before the main app (the app
// shell only syncs the bars inside the main app). No-op on the web.
// TODO(lead): replace with a shared setStatusBarStyle helper in services/native when it exists.
import { SystemBars, SystemBarsStyle, SystemBarType } from '@capacitor/core';
import { isNative } from '../../services/native';

type Icons = 'dark' | 'light';

/** Dark icons go on light backgrounds (SystemBarsStyle.Light) and light icons on dark ones. */
const styleFor = (icons: Icons) => (icons === 'dark' ? SystemBarsStyle.Light : SystemBarsStyle.Dark);

export function setStatusBars({ statusIcons, navIcons }: { statusIcons: Icons; navIcons: Icons }): void {
  if (!isNative) return;
  SystemBars.setStyle({ bar: SystemBarType.StatusBar, style: styleFor(statusIcons) }).catch(() => {});
  SystemBars.setStyle({ bar: SystemBarType.NavigationBar, style: styleFor(navIcons) }).catch(() => {});
}
