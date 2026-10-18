import { useCallback, useEffect, useMemo, useState } from 'react';
import { App as CapApp } from '@capacitor/app';
import { Capacitor, SystemBars, SystemBarsStyle } from '@capacitor/core';
import { SplashScreen } from '@capacitor/splash-screen';
import { haptic } from './lib/native';
import { StoreProvider, useStore } from './lib/store';
import { Meal } from './lib/types';
import { Nav, NavCtx, Tab } from './nav';
import CycleScreen from './screens/Cycle';
import FoodScreen from './screens/Food';
import { FoodLogger } from './screens/FoodLogger';
import Onboarding from './screens/Onboarding';
import ProgressScreen from './screens/Progress';
import Settings from './screens/Settings';
import Today from './screens/Today';
import WorkoutScreen from './screens/Workout';
import { Icon, popBack, ToastHost } from './ui';

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'today', label: 'Today', icon: 'home' },
  { id: 'food', label: 'Food', icon: 'food' },
  { id: 'workout', label: 'Workout', icon: 'dumbbell' },
  { id: 'cycle', label: 'Cycle', icon: 'drop' },
  { id: 'progress', label: 'Progress', icon: 'chart' },
];

function Shell() {
  const { ready, data } = useStore();
  const [tab, setTab] = useState<Tab>('today');
  const [logger, setLogger] = useState<{ open: boolean; meal: Meal; date?: string }>({ open: false, meal: 'breakfast' });
  const [settings, setSettings] = useState(false);
  const [autoStart, setAutoStart] = useState(false);

  useEffect(() => {
    if (ready && Capacitor.isNativePlatform()) SplashScreen.hide().catch(() => {});
  }, [ready]);

  // Status / navigation bar icons follow light–dark mode.
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    const mq = window.matchMedia('(prefers-color-scheme: light)');
    const apply = () => SystemBars.setStyle({ style: mq.matches ? SystemBarsStyle.Light : SystemBarsStyle.Dark }).catch(() => {});
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, []);

  // Android back button: close the top sheet first, then go to Today, then leave the app.
  useEffect(() => {
    const sub = CapApp.addListener('backButton', () => {
      if (popBack()) return;
      if (tab !== 'today') { setTab('today'); return; }
      CapApp.minimizeApp().catch(() => {});
    });
    return () => { sub.then((s) => s.remove()).catch(() => {}); };
  }, [tab]);

  const go = useCallback((t: Tab) => { haptic.tap(); setTab(t); }, []);
  const nav: Nav = useMemo(() => ({
    tab,
    go,
    openLogger: (meal: Meal, date?: string) => setLogger({ open: true, meal, date }),
    openSettings: () => setSettings(true),
    startWorkout: () => { setTab('workout'); setAutoStart(true); },
  }), [tab, go]);

  if (!ready) return <div className="app" style={{ background: 'var(--bg)' }} />;
  if (!data.onboarded) return <div className="app"><Onboarding /><ToastHost /></div>;

  return (
    <NavCtx.Provider value={nav}>
      <div className="app">
        {tab === 'today' && <Today />}
        {tab === 'food' && <FoodScreen />}
        {tab === 'workout' && <WorkoutScreen autoStart={autoStart} onAutoStartHandled={() => setAutoStart(false)} />}
        {tab === 'cycle' && <CycleScreen />}
        {tab === 'progress' && <ProgressScreen />}

        <nav className="tabbar" aria-label="Main" data-acc={tab}>
          {TABS.map((t) => (
            <button key={t.id} type="button" aria-current={tab === t.id ? 'page' : undefined} data-acc={t.id} onClick={() => go(t.id)}>
              <Icon name={t.icon} size={22} stroke={tab === t.id ? 2.3 : 1.9} />
              {t.label}
            </button>
          ))}
        </nav>

        <FoodLogger open={logger.open} meal={logger.meal} date={logger.date} onClose={() => setLogger((l) => ({ ...l, open: false }))} />
        <Settings open={settings} onClose={() => setSettings(false)} />
        <ToastHost />
      </div>
    </NavCtx.Provider>
  );
}

export default function App() {
  return (
    <StoreProvider>
      <Shell />
    </StoreProvider>
  );
}
