import bundledJson from '../content/bundled.json';
import { Content, Exercise } from './types';
import { loadCachedContent, saveCachedContent } from './storage';

/** Rishu's admin page publishes plans, foods and targets here. Nothing personal is ever fetched or sent. */
export const CONTENT_URL = 'https://drishabhh.github.io/sapna-health/content/content.json';
const SITE_BASE = 'https://drishabhh.github.io/sapna-health/';

export const BUNDLED: Content = bundledJson as Content;
const BUNDLED_MEDIA = new Set(
  BUNDLED.exercises.map((e) => e.gif).filter((g) => g.startsWith('media/')),
);

function valid(c: unknown): c is Content {
  if (!c || typeof c !== 'object') return false;
  const x = c as Content;
  return (
    Array.isArray(x.plans) &&
    Array.isArray(x.exercises) &&
    Array.isArray(x.foods) &&
    !!x.targets &&
    typeof x.targets.kcal === 'number' &&
    typeof x.targets.protein === 'number'
  );
}

function newer(a: Content, b: Content): boolean {
  return Date.parse(a.updatedAt || '') > Date.parse(b.updatedAt || '');
}

/** Offline-first: cached copy (or the copy shipped inside the app) is used immediately. */
export async function initialContent(): Promise<Content> {
  const cached = await loadCachedContent();
  if (cached && valid(cached) && !newer(BUNDLED, cached)) return cached;
  return BUNDLED;
}

/** Background refresh. Returns new content only when Rishu has published something newer. */
export async function refreshContent(current: Content): Promise<Content | null> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 8000);
  try {
    const res = await fetch(`${CONTENT_URL}?t=${Date.now()}`, { cache: 'no-store', signal: ctrl.signal });
    if (!res.ok) return null;
    const data = await res.json();
    if (!valid(data)) return null;
    if (!newer(data, current)) return null;
    await saveCachedContent(data);
    return data;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export function gifSrc(ex: Exercise | undefined): string {
  if (!ex) return '';
  const g = ex.gif || '';
  if (/^https:\/\//.test(g)) return g;
  if (BUNDLED_MEDIA.has(g)) return `./${g}`;
  return SITE_BASE + g.replace(/^\.?\//, '');
}
