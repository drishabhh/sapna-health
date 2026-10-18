import { createContext, useContext } from 'react';
import { Meal } from './lib/types';

export type Tab = 'today' | 'food' | 'workout' | 'cycle' | 'progress';

export interface Nav {
  tab: Tab;
  go: (t: Tab) => void;
  openLogger: (meal: Meal, date?: string) => void;
  openSettings: () => void;
  startWorkout: () => void;
}

export const NavCtx = createContext<Nav | null>(null);
export function useNav(): Nav {
  const n = useContext(NavCtx);
  if (!n) throw new Error('NavCtx missing');
  return n;
}
