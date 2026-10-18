import { Capacitor } from '@capacitor/core';
import { Directory, Encoding, Filesystem } from '@capacitor/filesystem';
import { AppData, Content, emptyData } from './types';

/*
 * Everything lives on the phone. On Android the data file sits in the app's private
 * files directory, which Android Auto Backup copies to her Google account and restores
 * on reinstall. On the web (dev preview) it falls back to localStorage.
 */
const DATA_FILE = 'sapna-data.json';
const DATA_TMP = 'sapna-data.tmp.json';
const CONTENT_FILE = 'sapna-content.json';
const LS_DATA = 'sapna_app_data_v1';
const LS_CONTENT = 'sapna_app_content_v1';

const native = () => Capacitor.isNativePlatform();

async function readFile(path: string): Promise<string | null> {
  try {
    const r = await Filesystem.readFile({ path, directory: Directory.Data, encoding: Encoding.UTF8 });
    return typeof r.data === 'string' ? r.data : null;
  } catch {
    return null;
  }
}

async function writeFileSafe(path: string, tmp: string, text: string): Promise<void> {
  // Write to a temp file first, then swap, so a crash mid-write never corrupts her logs.
  await Filesystem.writeFile({ path: tmp, directory: Directory.Data, encoding: Encoding.UTF8, data: text });
  try {
    await Filesystem.deleteFile({ path, directory: Directory.Data });
  } catch {
    /* first save */
  }
  await Filesystem.rename({ from: tmp, to: path, directory: Directory.Data, toDirectory: Directory.Data });
}

export function migrate(raw: unknown): AppData {
  const base = emptyData();
  if (!raw || typeof raw !== 'object') return base;
  const d = raw as Partial<AppData>;
  return {
    ...base,
    ...d,
    v: 1,
    profile: { ...base.profile, ...(d.profile || {}) },
    reminders: { ...base.reminders, ...(d.reminders || {}) },
    food: Array.isArray(d.food) ? d.food : [],
    water: d.water && typeof d.water === 'object' ? d.water : {},
    steps: d.steps && typeof d.steps === 'object' ? d.steps : {},
    weighIns: Array.isArray(d.weighIns) ? d.weighIns : [],
    sessions: Array.isArray(d.sessions) ? d.sessions : [],
    cycle: d.cycle && typeof d.cycle === 'object' ? d.cycle : {},
    customFoods: Array.isArray(d.customFoods) ? d.customFoods : [],
  };
}

export async function loadData(): Promise<AppData> {
  let text: string | null = null;
  if (native()) {
    text = await readFile(DATA_FILE);
    if (!text) text = await readFile(DATA_TMP); // recover from an interrupted swap
  } else {
    try {
      text = localStorage.getItem(LS_DATA);
    } catch {
      text = null;
    }
  }
  if (!text) return emptyData();
  try {
    return migrate(JSON.parse(text));
  } catch {
    return emptyData();
  }
}

export async function saveData(data: AppData): Promise<void> {
  const text = JSON.stringify(data);
  if (native()) {
    await writeFileSafe(DATA_FILE, DATA_TMP, text);
  } else {
    try {
      localStorage.setItem(LS_DATA, text);
    } catch {
      /* private mode */
    }
  }
}

export async function loadCachedContent(): Promise<Content | null> {
  let text: string | null = null;
  if (native()) text = await readFile(CONTENT_FILE);
  else {
    try {
      text = localStorage.getItem(LS_CONTENT);
    } catch {
      text = null;
    }
  }
  if (!text) return null;
  try {
    return JSON.parse(text) as Content;
  } catch {
    return null;
  }
}

export async function saveCachedContent(c: Content): Promise<void> {
  const text = JSON.stringify(c);
  if (native()) {
    try {
      await Filesystem.writeFile({ path: CONTENT_FILE, directory: Directory.Data, encoding: Encoding.UTF8, data: text });
    } catch {
      /* non-fatal */
    }
  } else {
    try {
      localStorage.setItem(LS_CONTENT, text);
    } catch {
      /* ignore */
    }
  }
}
