import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.rishu.sapnahealth',
  appName: 'Sapna Health',
  webDir: 'dist',
  backgroundColor: '#0c0c10',
  android: {
    allowMixedContent: false,
    webContentsDebuggingEnabled: false,
  },
  plugins: {
    SystemBars: { insetsHandling: 'css', initialViewportFitValueHint: 'cover', style: 'DARK' },
    SplashScreen: { launchShowDuration: 600, backgroundColor: '#0c0c10', showSpinner: false, androidScaleType: 'CENTER_CROP' },
    LocalNotifications: { smallIcon: 'ic_stat_sapna', iconColor: '#C6F432' },
  },
};

export default config;
