/** All timings, temperature effects, scores, acid and combat below are FICTIONAL GAME COEFFICIENTS.
 * They do not estimate fermentation, pH, microbial counts, quality or drinkability. */
export type Temperature = 'low' | 'middle' | 'high';
export type Style = 'gatherer' | 'breaker';
export type Direction = 'up' | 'down' | 'left' | 'right' | 'stop';
export type Status = 'ready' | 'playing' | 'paused' | 'wave' | 'won' | 'lost';
export type Point = { x: number; y: number };
export const SIZE = 17;
export const STEP = 1 / 60;
export const MODES = {
  low: {
    label: '低め',
    name: 'じっくり採取',
    description: '競合はゆっくり。糖の少ない道を見極め、緑の区画を足場に。',
    playerStep: 0.19,
    enemyStep: 0.56,
    enemies: 2,
    density: 0.7,
    spawnEvery: 3.8,
    acidRate: 1.7,
    regen: 2.8,
    cooldown: 3.0,
    multiplier: 1,
    comboWindow: 4.5,
  },
  middle: {
    label: '中間',
    name: 'コンボをつなぐ',
    description: '移動・補給・回復が均衡。途切れない採取ルートで得点を伸ばす。',
    playerStep: 0.15,
    enemyStep: 0.4,
    enemies: 3,
    density: 0.86,
    spawnEvery: 2.7,
    acidRate: 1,
    regen: 2.2,
    cooldown: 4,
    multiplier: 1.4,
    comboWindow: 3.5,
  },
  high: {
    label: '高め',
    name: '攻めて突破',
    description: '糖も競合も多い高速戦。スキルの使いどころが高得点への鍵。',
    playerStep: 0.115,
    enemyStep: 0.29,
    enemies: 4,
    density: 1,
    spawnEvery: 1.8,
    acidRate: 0.45,
    regen: 1.5,
    cooldown: 5,
    multiplier: 2,
    comboWindow: 2.8,
  },
} as const;
export const WAVES = [
  {
    name: '糖の道をひらく',
    goal: 18,
    seconds: 45,
    mission: '8コンボをつなぐ',
    missionType: 'combo',
  },
  {
    name: '緑の区画をめぐる',
    goal: 24,
    seconds: 50,
    mission: '緑の粒を2個拾う',
    missionType: 'acid',
  },
  {
    name: '最後のひとめぐり',
    goal: 30,
    seconds: 55,
    mission: 'ノーダメージで突破',
    missionType: 'clean',
  },
] as const;
export const DIRS: Record<Direction, Point> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
  stop: { x: 0, y: 0 },
};
export type Pickup = Point & { kind: 'sugar' | 'acid' | 'gold' };
export type Enemy = Point & {
  id: number;
  stunned: number;
  clock: number;
  type: 'chase' | 'ambush' | 'patrol';
};
export type Game = {
  status: Status;
  temperature: Temperature;
  style: Style;
  seed: number;
  rng: number;
  wave: number;
  tiles: string[];
  player: Point;
  previous: Point;
  direction: Direction;
  desired: Direction;
  moveClock: number;
  enemies: Enemy[];
  pickups: Pickup[];
  score: number;
  hp: number;
  energy: number;
  acid: number;
  combo: number;
  maxCombo: number;
  comboLeft: number;
  collected: number;
  totalCollected: number;
  acidCollected: number;
  waveMaxCombo: number;
  waveHits: number;
  totalHits: number;
  missions: number;
  timeLeft: number;
  elapsed: number;
  invincible: number;
  dash: number;
  pulse: number;
  cooldown: number;
  spawnClock: number;
  skills: number;
  reason: string;
  message: string;
  messageLeft: number;
};
export const equal = (a: Point, b: Point) => a.x === b.x && a.y === b.y;
export const distance = (a: Point, b: Point) =>
  Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
export function walkable(tiles: string[], p: Point) {
  return tiles[p.y]?.[p.x] === '.';
}
export function board(wave: number): string[] {
  // Even/even blocks form one connected network; each wave adds a different short partition.
  return Array.from({ length: SIZE }, (_, y) =>
    Array.from({ length: SIZE }, (_, x) => {
      if (x === 0 || y === 0 || x === 16 || y === 16) return '#';
      if (x % 2 === 0 && y % 2 === 0) return '#';
      if (wave === 1 && x === 8 && [3, 7, 11].includes(y)) return '#';
      if (wave === 2 && y === 8 && [3, 7, 11].includes(x)) return '#';
      return '.';
    }).join(''),
  );
}
function random(g: Game) {
  g.rng = (Math.imul(g.rng, 1664525) + 1013904223) >>> 0;
  return g.rng / 4294967296;
}
export function createGame(
  temperature: Temperature = 'middle',
  style: Style = 'gatherer',
  seed = 260907,
): Game {
  const safeSeed = Number.isFinite(seed)
    ? Math.max(1, Math.abs(Math.trunc(seed)) >>> 0)
    : 260907;
  const g: Game = {
    status: 'ready',
    temperature,
    style,
    seed: safeSeed,
    rng: safeSeed,
    wave: 0,
    tiles: [],
    player: { x: 1, y: 1 },
    previous: { x: 1, y: 1 },
    direction: 'stop',
    desired: 'stop',
    moveClock: 0,
    enemies: [],
    pickups: [],
    score: 0,
    hp: 3,
    energy: 65,
    acid: 0,
    combo: 0,
    maxCombo: 0,
    comboLeft: 0,
    collected: 0,
    totalCollected: 0,
    acidCollected: 0,
    waveMaxCombo: 0,
    waveHits: 0,
    totalHits: 0,
    missions: 0,
    timeLeft: 45,
    elapsed: 0,
    invincible: 2,
    dash: 0,
    pulse: 0,
    cooldown: 0,
    spawnClock: 0,
    skills: 0,
    reason: '',
    message: '糖を18個集めよう',
    messageLeft: 3,
  };
  populate(g);
  return g;
}
function populate(g: Game) {
  g.tiles = board(g.wave);
  g.player = { x: 1, y: 1 };
  g.previous = { ...g.player };
  g.direction = 'stop';
  g.desired = 'stop';
  g.moveClock = 0;
  g.pickups = [];
  const mode = MODES[g.temperature];
  for (let y = 1; y < 16; y++)
    for (let x = 1; x < 16; x++) {
      if (!walkable(g.tiles, { x, y }) || (x === 1 && y === 1)) continue;
      const draw = random(g);
      if ((x === 3 || x === 13) && (y === 3 || y === 13))
        g.pickups.push({ x, y, kind: 'acid' });
      else if (
        (x === 15 && y === 1) ||
        (x === 1 && y === 15) ||
        (x === 15 && y === 15)
      )
        g.pickups.push({ x, y, kind: 'gold' });
      else if (draw < mode.density || y === 1)
        g.pickups.push({ x, y, kind: 'sugar' });
    }
  const starts = [
    { x: 15, y: 15 },
    { x: 1, y: 15 },
    { x: 15, y: 1 },
    { x: 9, y: 9 },
    { x: 9, y: 15 },
  ];
  g.enemies = starts
    .slice(0, Math.min(5, mode.enemies + (g.wave === 2 ? 1 : 0)))
    .map((p, id) => ({
      ...p,
      id,
      stunned: 2,
      clock: 0,
      type: (['chase', 'patrol', 'ambush'] as const)[id % 3],
    }));
  g.collected = 0;
  g.acidCollected = 0;
  g.waveHits = 0;
  g.waveMaxCombo = 0;
  g.combo = 0;
  g.comboLeft = 0;
  g.timeLeft = WAVES[g.wave].seconds;
  g.invincible = 2;
  g.dash = 0;
  g.pulse = 0;
  g.cooldown = 0;
  g.spawnClock = 0;
}
export function begin(g: Game) {
  if (g.status === 'ready') g.status = 'playing';
}
export function steer(g: Game, direction: Direction) {
  if (g.status !== 'playing') return;
  g.desired = direction;
  if (direction === 'stop') g.direction = 'stop';
}
export function pause(g: Game) {
  if (g.status === 'playing') {
    g.status = 'paused';
    g.desired = 'stop';
    g.direction = 'stop';
  }
}
export function resume(g: Game) {
  if (g.status === 'paused') g.status = 'playing';
}
export function nextWave(g: Game) {
  if (g.status !== 'wave') return;
  g.wave++;
  populate(g);
  g.energy = Math.min(100, g.energy + 25);
  g.status = 'playing';
  g.message = `STAGE ${g.wave + 1} / ${WAVES[g.wave].goal}個を集めよう`;
  g.messageLeft = 3;
}
function say(g: Game, text: string) {
  g.message = text;
  g.messageLeft = 1.8;
}
export function skill(g: Game, kind: 'pulse' | 'dash'): boolean {
  const cost = kind === 'dash' ? 25 : g.style === 'breaker' ? 30 : 40;
  if (g.status !== 'playing' || g.cooldown > 0 || g.energy < cost) return false;
  g.energy -= cost;
  g.skills++;
  g.cooldown = MODES[g.temperature].cooldown;
  if (kind === 'dash') {
    g.dash = 1.05;
    g.invincible = Math.max(g.invincible, 1.05);
    say(g, 'ダッシュ！ 接触をすり抜ける');
  } else {
    g.pulse = 0.55;
    const radius = g.style === 'breaker' ? 5 : 4;
    let hits = 0;
    for (const e of g.enemies)
      if (distance(e, g.player) <= radius) {
        e.stunned = 3.2;
        hits++;
      }
    g.score += Math.round(hits * 90 * MODES[g.temperature].multiplier);
    say(g, hits ? `${hits}体をストップ！` : 'パルス！ 近くの競合を足止め');
  }
  return true;
}
export function missionComplete(g: Game) {
  return g.wave === 0
    ? g.waveMaxCombo >= 8
    : g.wave === 1
      ? g.acidCollected >= 2
      : g.waveHits === 0;
}
function collect(g: Game) {
  const index = g.pickups.findIndex((p) => equal(p, g.player));
  if (index < 0) return;
  const [p] = g.pickups.splice(index, 1);
  g.combo++;
  g.maxCombo = Math.max(g.maxCombo, g.combo);
  g.waveMaxCombo = Math.max(g.waveMaxCombo, g.combo);
  g.comboLeft =
    MODES[g.temperature].comboWindow + (g.style === 'gatherer' ? 1 : 0);
  const comboMultiplier = 1 + Math.min(3, Math.floor(g.combo / 5)) * 0.5;
  const risk = g.enemies.some(
    (e) => e.stunned <= 0 && distance(e, g.player) <= 2,
  )
    ? 1.5
    : 1;
  g.score += Math.round(
    (p.kind === 'gold' ? 180 : p.kind === 'acid' ? 70 : 50) *
      MODES[g.temperature].multiplier *
      comboMultiplier *
      risk,
  );
  g.energy = Math.min(100, g.energy + (g.style === 'gatherer' ? 8 : 6));
  if (p.kind === 'acid') {
    g.acid = Math.min(100, g.acid + 18);
    g.acidCollected++;
    say(g, '緑の粒 +18 / 酸性化ゲージ（架空）');
  } else {
    g.collected++;
    g.totalCollected++;
    if (p.kind === 'gold') say(g, '大粒の糖！ 基礎点180');
    else if (g.combo % 5 === 0) say(g, `${g.combo} COMBO！`);
  }
  if (risk > 1) say(g, 'ニアミス採取 ×1.5！');
}
export function neighbor(g: Game, p: Point, d: Direction): Point {
  const v = DIRS[d];
  return { x: p.x + v.x, y: p.y + v.y };
}
function enemyTarget(g: Game, e: Enemy): Point {
  if (e.type === 'patrol' && Math.floor(g.elapsed / 7) % 2 === 0)
    return [
      { x: 15, y: 1 },
      { x: 15, y: 15 },
      { x: 1, y: 15 },
      { x: 1, y: 1 },
    ][Math.floor(g.elapsed / 4) % 4];
  if (e.type === 'ambush') {
    const a = neighbor(g, g.player, g.direction);
    if (walkable(g.tiles, a)) return a;
  }
  return g.player;
}
function chase(g: Game, e: Enemy) {
  const target = enemyTarget(g, e);
  const queue: Point[] = [target];
  const distances = new Map<string, number>([[`${target.x},${target.y}`, 0]]);
  for (let i = 0; i < queue.length; i++) {
    const p = queue[i];
    for (const d of ['up', 'right', 'down', 'left'] as const) {
      const n = neighbor(g, p, d);
      const key = `${n.x},${n.y}`;
      if (walkable(g.tiles, n) && !distances.has(key)) {
        distances.set(key, distances.get(`${p.x},${p.y}`)! + 1);
        queue.push(n);
      }
    }
  }
  const options = (['up', 'right', 'down', 'left'] as const)
    .map((d) => neighbor(g, e, d))
    .filter((p) => walkable(g.tiles, p));
  options.sort(
    (a, b) =>
      (distances.get(`${a.x},${a.y}`) ?? 999) -
      (distances.get(`${b.x},${b.y}`) ?? 999),
  );
  const chosen = options[0];
  if (chosen) {
    e.x = chosen.x;
    e.y = chosen.y;
  }
}
function collision(g: Game) {
  if (g.invincible > 0) return;
  if (g.enemies.some((e) => e.stunned <= 0 && equal(e, g.player))) {
    g.hp--;
    g.waveHits++;
    g.totalHits++;
    g.combo = 0;
    g.comboLeft = 0;
    g.invincible = 2.2;
    g.energy = Math.max(0, g.energy - 15);
    say(g, '接触！ ハート −1 / 2秒の保護');
  }
}
export function protectedZone(p: Point) {
  return (p.x <= 4 || p.x >= 12) && (p.y <= 4 || p.y >= 12);
}
export function step(g: Game, dt = STEP) {
  if (g.status !== 'playing' || !Number.isFinite(dt) || dt <= 0) return;
  dt = Math.min(dt, 0.05);
  const m = MODES[g.temperature];
  g.elapsed += dt;
  g.timeLeft = Math.max(0, g.timeLeft - dt);
  g.invincible = Math.max(0, g.invincible - dt);
  g.dash = Math.max(0, g.dash - dt);
  g.pulse = Math.max(0, g.pulse - dt);
  g.cooldown = Math.max(0, g.cooldown - dt);
  g.messageLeft = Math.max(0, g.messageLeft - dt);
  g.comboLeft = Math.max(0, g.comboLeft - dt);
  if (!g.comboLeft) g.combo = 0;
  g.energy = Math.min(100, g.energy + m.regen * dt);
  g.acid = Math.min(100, g.acid + m.acidRate * dt);
  g.moveClock += dt;
  const interval = m.playerStep / (g.dash > 0 ? 1.65 : 1);
  if (g.moveClock >= interval) {
    g.moveClock -= interval;
    g.previous = { ...g.player };
    if (
      g.desired !== 'stop' &&
      walkable(g.tiles, neighbor(g, g.player, g.desired))
    )
      g.direction = g.desired;
    if (g.direction !== 'stop') {
      const n = neighbor(g, g.player, g.direction);
      if (walkable(g.tiles, n)) g.player = n;
    }
    collect(g);
    collision(g);
  }
  for (const e of g.enemies) {
    e.stunned = Math.max(0, e.stunned - dt);
    if (e.stunned > 0) continue;
    e.clock += dt;
    const slow = g.acid >= 60 && protectedZone(e) ? 1.6 : 1;
    if (e.clock >= (m.enemyStep * slow) / (1 + g.wave * 0.08)) {
      e.clock = 0;
      chase(g, e);
      collision(g);
    }
  }
  g.spawnClock += dt;
  if (g.spawnClock >= m.spawnEvery) {
    g.spawnClock = 0;
    const candidates: Point[] = [];
    for (let y = 1; y < 16; y++)
      for (let x = 1; x < 16; x++)
        if (
          walkable(g.tiles, { x, y }) &&
          !equal(g.player, { x, y }) &&
          !g.pickups.some((p) => p.x === x && p.y === y)
        )
          candidates.push({ x, y });
    if (candidates.length)
      g.pickups.push({
        ...candidates[Math.floor(random(g) * candidates.length)],
        kind: 'sugar',
      });
  }
  if (g.hp <= 0 || g.timeLeft <= 0) {
    g.status = 'lost';
    g.reason =
      g.hp <= 0
        ? 'ハートがなくなりました。パルスで道を確保して再挑戦。'
        : '時間切れ。糖の多い道をつなぎ、早めにダッシュを。';
  } else if (g.collected >= WAVES[g.wave].goal) {
    const mission = missionComplete(g);
    if (mission) g.missions++;
    g.score += Math.round(
      (g.timeLeft * 10 + (mission ? 500 : 0)) * m.multiplier,
    );
    g.status = g.wave === 2 ? 'won' : 'wave';
  }
}
export function rank(g: Game) {
  return g.status === 'won'
    ? g.missions === 3 && g.totalHits === 0
      ? 'S'
      : g.missions >= 2
        ? 'A'
        : 'B'
    : 'C';
}
export function achievements(g: Game): string[] {
  return [
    ...(g.status === 'won' ? ['初めての踏破'] : []),
    ...(g.maxCombo >= 20 ? ['20連鎖'] : []),
    ...(g.status === 'won' && g.totalHits === 0 ? ['無傷の採取家'] : []),
    ...(g.skills >= 5 ? ['スキルの使い手'] : []),
    ...(g.status === 'won' && g.temperature === 'high' ? ['高めの挑戦者'] : []),
    ...(g.missions === 3 ? ['ミッション完遂'] : []),
  ];
}
