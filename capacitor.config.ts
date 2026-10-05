import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'in.appsgain.kisanmitra',
  appName: 'Kisan Mitra',
  webDir: 'dist',
  android: {
    allowMixedContent: false,
  },
  plugins: {
    SystemBars: {
      insetsHandling: 'css',
    },
  },
};

export default config;
