import { achievements, type Game, type Temperature } from './model';
export const STORAGE_KEY = 'sat-shubo-arcade:v1';
export type Records = {
  version: 1;
  high: Record<Temperature, number>;
  achievements: string[];
  runs: number;
};
export const emptyRecords = (): Records => ({
  version: 1,
  high: { low: 0, middle: 0, high: 0 },
  achievements: [],
  runs: 0,
});
const allowed = [
  '初めての踏破',
  '20連鎖',
  '無傷の採取家',
  'スキルの使い手',
  '高めの挑戦者',
  'ミッション完遂',
];
const count = (n: unknown) =>
  typeof n === 'number' && Number.isFinite(n)
    ? Math.max(0, Math.min(999999999, Math.trunc(n)))
    : 0;
export function readRecords(storage: Pick<Storage, 'getItem'>): Records {
  try {
    const raw = JSON.parse(storage.getItem(STORAGE_KEY) ?? 'null');
    if (raw?.version !== 1) return emptyRecords();
    return {
      version: 1,
      high: {
        low: count(raw.high?.low),
        middle: count(raw.high?.middle),
        high: count(raw.high?.high),
      },
      runs: count(raw.runs),
      achievements: Array.isArray(raw.achievements)
        ? ([
            ...new Set(
              raw.achievements.filter(
                (x: unknown): x is string =>
                  typeof x === 'string' && allowed.includes(x),
              ),
            ),
          ] as string[])
        : [],
    };
  } catch {
    return emptyRecords();
  }
}
export function recordRun(old: Records, g: Game): Records {
  if (g.status !== 'won' && g.status !== 'lost') return old;
  return {
    version: 1,
    high: {
      ...old.high,
      [g.temperature]: Math.max(old.high[g.temperature], g.score),
    },
    runs: old.runs + 1,
    achievements: [...new Set([...old.achievements, ...achievements(g)])],
  };
}
export function saveRecords(
  storage: Pick<Storage, 'setItem'>,
  records: Records,
) {
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(records));
    return true;
  } catch {
    return false;
  }
}
