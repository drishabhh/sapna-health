export type Meal = 'breakfast' | 'lunch' | 'snacks' | 'dinner';
export const MEALS: { id: Meal; label: string }[] = [
  { id: 'breakfast', label: 'Breakfast' },
  { id: 'lunch', label: 'Lunch' },
  { id: 'snacks', label: 'Snacks' },
  { id: 'dinner', label: 'Dinner' },
];

export interface Food {
  id: string;
  name: string;
  portion: string;
  kcal: number;
  protein: number;
  carbs?: number;
  fat?: number;
  fiber?: number;
  tags?: string[];
  custom?: boolean;
}

export interface Exercise {
  id: string;
  name: string;
  group: 'stretching' | 'exercises';
  part: string;
  equipment?: string;
  gif: string;
  cue?: string;
}

export interface PlanMove {
  exId: string;
  sets: number;
  reps: number;
  unit?: 'reps' | 'min' | 'sec';
  kg?: number;
}

export interface Plan {
  id: string;
  title: string;
  note?: string;
  moves: PlanMove[];
}

export interface Content {
  version: number;
  updatedAt: string;
  targets: { kcal: number; protein: number; water: number };
  plans: Plan[];
  exercises: Exercise[];
  foods: Food[];
  message?: string;
}

export interface FoodEntry {
  id: string;
  date: string;
  meal: Meal;
  foodId: string;
  name: string;
  portion: string;
  mult: number;
  kcal: number;
  protein: number;
  at: number;
}

export interface SetEntry {
  exId: string;
  set: number;
  kg: number;
  reps: number;
  at: number;
}

export interface Session {
  id: string;
  date: string;
  planId: string;
  title: string;
  startedAt: number;
  endedAt?: number;
  sets: SetEntry[];
}

export type Flow = 'none' | 'light' | 'medium' | 'heavy';
export interface CycleDay {
  flow?: Flow;
  symptoms?: string[];
}

export type Goal = 'lose' | 'strong' | 'energy' | 'keep';
export type Activity = 'desk' | 'light' | 'active';
export type DietType = 'veg' | 'egg' | 'non';
export type ShareCycle = 'phase' | 'all' | 'none';

export interface Profile {
  name: string;
  heightCm: number;
  weightKg: number;
  activity: Activity;
  goal: Goal;
  gymDays: number[]; // 0 = Sunday … 6 = Saturday
  diet: DietType;
  favFoods: string[];
  avoid: string;
  cycleEnabled: boolean;
  cycleLen: number;
  periodLen: number;
  shareCycle: ShareCycle;
}

export interface Reminders {
  meals: boolean;
  water: boolean;
  gym: boolean;
  weigh: boolean;
}

export interface AppData {
  v: 1;
  onboarded: boolean;
  createdAt: number;
  profile: Profile;
  reminders: Reminders;
  food: FoodEntry[];
  water: Record<string, number>;
  steps: Record<string, number>;
  weighIns: { date: string; kg: number }[];
  sessions: Session[];
  cycle: Record<string, CycleDay>;
  customFoods: Food[];
  lastBackupAt?: number;
  lastReportAt?: number;
}

export const DEFAULT_PROFILE: Profile = {
  name: 'Sapna',
  heightCm: 160,
  weightKg: 60,
  activity: 'light',
  goal: 'lose',
  gymDays: [1, 3, 5],
  diet: 'egg',
  favFoods: [],
  avoid: '',
  cycleEnabled: true,
  cycleLen: 28,
  periodLen: 5,
  shareCycle: 'phase',
};

export function emptyData(): AppData {
  return {
    v: 1,
    onboarded: false,
    createdAt: Date.now(),
    profile: { ...DEFAULT_PROFILE },
    reminders: { meals: true, water: true, gym: true, weigh: false },
    food: [],
    water: {},
    steps: {},
    weighIns: [],
    sessions: [],
    cycle: {},
    customFoods: [],
  };
}
