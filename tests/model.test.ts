import { describe, it, expect } from 'vitest';
import {
  createGame,
  begin,
  steer,
  step,
  skill,
  pause,
  resume,
  nextWave,
  walkable,
  board,
  equal,
  MODES,
  WAVES,
  FEVER,
  rank,
  achievements,
  missionComplete,
  type Temperature,
  type Game,
} from '../src/model';
import {
  readRecords,
  emptyRecords,
  recordRun,
  saveRecords,
} from '../src/storage';
function ticks(g: Game, n: number) {
  for (let i = 0; i < n; i++) step(g);
}
function takePickup(g: Game, kind: 'sugar' | 'gold' | 'acid' = 'sugar') {
  // Isolate collection from route choice: one real movement onto a supplied pickup.
  g.player = { x: 1, y: 1 };
  g.pickups = [{ x: 2, y: 1, kind }];
  g.moveClock = MODES[g.temperature].playerStep;
  steer(g, 'right');
  step(g);
  steer(g, 'stop');
}
function reachableTiles(tiles: string[]) {
  const seen = new Set(['1,1']);
  const q = [{ x: 1, y: 1 }];
  for (let i = 0; i < q.length; i++)
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
      const p = { x: q[i].x + dx, y: q[i].y + dy };
      const key = `${p.x},${p.y}`;
      if (walkable(tiles, p) && !seen.has(key)) {
        seen.add(key);
        q.push(p);
      }
    }
  return seen;
}
describe('deterministic arcade model', () => {
  it('replays seeds and action timelines exactly', () => {
    function play() {
      const g = createGame('high', 'breaker', 123);
      begin(g);
      for (let i = 0; i < 1000; i++) {
        if (i % 90 === 0)
          steer(
            g,
            (['right', 'down', 'left', 'up'] as const)[Math.floor(i / 90) % 4],
          );
        if (i % 180 === 0) skill(g, 'pulse');
        step(g);
      }
      return g;
    }
    expect(play()).toEqual(play());
    expect(createGame('low', 'gatherer', 123).pickups).not.toEqual(
      createGame('low', 'gatherer', 124).pickups,
    );
  });
  it('keeps every stage connected and supplies enough sugar for the goal', () => {
    for (let wave = 0; wave < 3; wave++) {
      const tiles = board(wave),
        seen = new Set(['1,1']),
        q = [{ x: 1, y: 1 }];
      for (let i = 0; i < q.length; i++)
        for (const [dx, dy] of [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
        ]) {
          const p = { x: q[i].x + dx, y: q[i].y + dy },
            key = `${p.x},${p.y}`;
          if (walkable(tiles, p) && !seen.has(key)) {
            seen.add(key);
            q.push(p);
          }
        }
      expect(seen.size).toBe(
        tiles
          .join('')
          .split('')
          .filter((t) => t === '.').length,
      );
      for (const t of ['low', 'middle', 'high'] as const) {
        const g = createGame(t);
        g.wave = wave - 1;
        g.status = 'wave';
        nextWave(g);
        expect(
          g.pickups.filter((p) => p.kind !== 'acid').length,
        ).toBeGreaterThan(WAVES[wave].goal);
      }
    }
  });
  it('preserves classic layouts and creates repeatable distinct daily routes in high density', () => {
    const maps = new Set<string>();
    for (let wave = 0; wave < 3; wave++) {
      const classic = board(wave);
      expect(classic).toEqual(board(wave, 260907));
      expect(classic.join('').split('.').length - 1).toBe(
        wave === 0 ? 176 : 173,
      );
      expect(classic[1]).toBe('#...............#');
      expect(classic[2]).toBe('#.#.#.#.#.#.#.#.#');
    }
    for (let seed = 20260912; seed < 20260922; seed++) {
      const first = createGame('high', 'gatherer', seed);
      const replay = createGame('high', 'gatherer', seed);
      expect(first).toEqual(replay);
      expect(first.tiles).not.toEqual(board(0));
      maps.add(first.tiles.join('\n'));
      first.status = 'wave';
      replay.status = 'wave';
      nextWave(first, 'time');
      nextWave(replay, 'time');
      expect(first).toEqual(replay);
    }
    expect(maps.size).toBe(10);
    expect(createGame('high', 'gatherer', 20260912).pickups).not.toEqual(
      createGame('high', 'gatherer', 20260913).pickups,
    );
  });
  it('keeps fifty daily seeds connected, supplied and fair at spawn across every stage and mode', () => {
    for (let seed = 20260901; seed < 20260951; seed++)
      for (const temperature of ['low', 'middle', 'high'] as const) {
        const g = createGame(temperature, 'gatherer', seed);
        for (let wave = 0; wave < 3; wave++) {
          if (wave > 0) {
            g.status = 'wave';
            nextWave(g);
          }
          const reachable = reachableTiles(g.tiles);
          expect(reachable.size).toBe(g.tiles.join('').split('.').length - 1);
          expect(g.tiles).toEqual(board(wave, seed));
          for (const point of [
            { x: 1, y: 1 },
            { x: 2, y: 1 },
            { x: 1, y: 2 },
          ])
            expect(walkable(g.tiles, point)).toBe(true);
          expect(
            g.pickups.filter((p) => p.kind !== 'acid').length,
          ).toBeGreaterThanOrEqual(WAVES[wave].goal);
          expect(g.pickups.filter((p) => p.kind === 'acid')).toHaveLength(4);
          for (const p of [...g.pickups, ...g.enemies])
            expect(reachable.has(`${p.x},${p.y}`)).toBe(true);
          expect(new Set(g.enemies.map((e) => `${e.x},${e.y}`)).size).toBe(
            g.enemies.length,
          );
          expect(new Set(g.pickups.map((p) => `${p.x},${p.y}`)).size).toBe(
            g.pickups.length,
          );
          for (const e of g.enemies)
            expect(
              Math.abs(e.x - g.player.x) + Math.abs(e.y - g.player.y),
            ).toBeGreaterThanOrEqual(10);
        }
      }
  });
  it('actually moves, respects walls, buffers turns and collects resources', () => {
    const g = createGame();
    begin(g);
    steer(g, 'right');
    ticks(g, 10);
    expect(g.player).toEqual({ x: 2, y: 1 });
    expect(g.collected).toBe(1);
    expect(g.score).toBeGreaterThan(0);
    steer(g, 'up');
    ticks(g, 10);
    expect(g.player.y).toBe(1);
    expect(g.player.x).toBe(3);
    steer(g, 'stop');
    const p = { ...g.player };
    ticks(g, 20);
    expect(g.player).toEqual(p);
  });
  it('does not advance paused, ready, wave or terminal states', () => {
    for (const status of ['paused', 'ready', 'wave', 'won', 'lost'] as const) {
      const g = createGame();
      g.status = status;
      const saved = structuredClone(g);
      ticks(g, 300);
      expect(g).toEqual(saved);
      expect(skill(g, 'pulse')).toBe(false);
    }
    const g = createGame();
    begin(g);
    pause(g);
    resume(g);
    expect(g.status).toBe('playing');
  });
  it('gives temperature measurable movement, pressure, resource, acid, recovery and score differences', () => {
    expect(MODES.low.playerStep).toBeGreaterThan(MODES.high.playerStep);
    expect(MODES.low.enemyStep).toBeGreaterThan(MODES.high.enemyStep);
    expect(MODES.low.enemies).toBeLessThan(MODES.high.enemies);
    expect(MODES.low.density).toBeLessThan(MODES.high.density);
    expect(MODES.low.spawnEvery).toBeGreaterThan(MODES.high.spawnEvery);
    const scenarios = (['low', 'middle', 'high'] as const).map((t) => {
      const g = createGame(t);
      g.energy = 0;
      begin(g);
      steer(g, 'right');
      ticks(g, 30);
      return g;
    });
    expect(scenarios[0].player.x).toBeLessThan(scenarios[2].player.x);
    expect(scenarios[0].acid).toBeGreaterThan(scenarios[2].acid);
    expect(scenarios[0].score).toBeLessThan(scenarios[2].score);
  });
  it('pulse costs energy, stuns in range and blocks cooldown spam', () => {
    const g = createGame('middle', 'breaker');
    begin(g);
    g.enemies[0] = { ...g.enemies[0], x: 5, y: 1, stunned: 0 };
    g.enemies[1].stunned = 0;
    expect(skill(g, 'pulse')).toBe(true);
    expect(g.energy).toBe(35);
    expect(g.enemies[0].stunned).toBe(3.2);
    expect(g.enemies[1].stunned).toBe(0);
    expect(skill(g, 'pulse')).toBe(false);
    expect(g.message).toContain('スキル回復まで');
    ticks(g, 250);
    g.energy = 29;
    expect(skill(g, 'pulse')).toBe(false);
    expect(g.message).toContain('あと1必要');
  });
  it('explains insufficient dash energy without consuming a skill or its cooldown', () => {
    const g = createGame();
    begin(g);
    g.energy = 24.4;
    expect(skill(g, 'dash')).toBe(false);
    expect(g.message).toContain('あと1必要');
    expect(g.skills).toBe(0);
    expect(g.cooldown).toBe(0);
    expect(g.energy).toBe(24.4);
    g.energy = 25;
    expect(skill(g, 'dash')).toBe(true);
    expect(g.energy).toBe(0);
  });
  it('dash speeds movement and blocks contact; collision deducts one heart with a grace period', () => {
    const g = createGame();
    begin(g);
    g.invincible = 0;
    g.enemies.forEach((e) => {
      e.x = 1;
      e.y = 1;
      e.stunned = 0;
      e.clock = 0;
    });
    ticks(g, 10);
    expect(g.hp).toBe(2);
    ticks(g, 10);
    expect(g.hp).toBe(2);
    g.cooldown = 0;
    g.energy = 100;
    skill(g, 'dash');
    expect(g.invincible).toBeGreaterThan(0);
    expect(g.dash).toBeGreaterThan(0);
    expect(g.energy).toBe(75);
  });
  it('combo expires and acid tokens are distinct from required sugar', () => {
    const g = createGame();
    begin(g);
    g.pickups = [{ x: 2, y: 1, kind: 'acid' }];
    steer(g, 'right');
    ticks(g, 10);
    expect(g.acidCollected).toBe(1);
    expect(g.collected).toBe(0);
    expect(g.combo).toBe(1);
    expect(g.acid).toBeGreaterThan(18);
    steer(g, 'stop');
    g.enemies = [];
    ticks(g, 300);
    expect(g.combo).toBe(0);
  });
  it('charges fever from ten chained sugars, doubles collection points and protects contact', () => {
    const g = createGame('middle');
    g.enemies = [];
    begin(g);
    for (let i = 0; i < 9; i++) takePickup(g, i === 8 ? 'gold' : 'sugar');
    expect(g.feverCharge).toBe(9);
    expect(g.fever).toBe(0);
    const before = g.score;
    takePickup(g);
    expect(g.score - before).toBe(
      50 * MODES.middle.multiplier * 2 * FEVER.multiplier,
    );
    expect(g.fever).toBe(FEVER.seconds);
    expect(g.feverCount).toBe(1);
    expect(g.feverCharge).toBe(0);
    expect(g.message).toContain('FEVER');
    g.invincible = 0;
    g.enemies = [{ ...g.player, id: 0, stunned: 0, clock: 0, type: 'chase' }];
    step(g);
    expect(g.hp).toBe(3);
    expect(g.waveHits).toBe(0);
  });
  it('does not let pickups extend or recharge active fever, and requires a fresh ten afterwards', () => {
    const g = createGame();
    g.wave = 2;
    g.enemies = [];
    begin(g);
    for (let i = 0; i < 10; i++) takePickup(g);
    for (let i = 0; i < 8; i++) {
      ticks(g, 26);
      const before = g.fever;
      takePickup(g);
      expect(g.fever).toBeLessThan(before);
      expect(g.feverCharge).toBe(0);
    }
    expect(g.feverCount).toBe(1);
    ticks(g, 30);
    expect(g.fever).toBe(0);
    expect(g.feverCharge).toBe(0);
    for (let i = 0; i < 9; i++) takePickup(g);
    expect(g.feverCount).toBe(1);
    expect(g.feverCharge).toBe(9);
    takePickup(g);
    expect(g.feverCount).toBe(2);
    expect(g.status).toBe('playing');
  });
  it('green pickups sustain a combo but do not charge fever; expired combos discard charge', () => {
    const g = createGame();
    g.enemies = [];
    begin(g);
    for (let i = 0; i < 5; i++) takePickup(g);
    takePickup(g, 'acid');
    expect(g.combo).toBe(6);
    expect(g.feverCharge).toBe(5);
    ticks(g, 300);
    expect(g.combo).toBe(0);
    expect(g.feverCharge).toBe(0);
    takePickup(g);
    expect(g.feverCharge).toBe(1);
  });
  it('freezes active fever during a pause and resumes without extending the burst', () => {
    const g = createGame();
    g.enemies = [];
    begin(g);
    for (let i = 0; i < 10; i++) takePickup(g);
    ticks(g, 30);
    pause(g);
    const saved = structuredClone(g);
    ticks(g, 600);
    expect(g).toEqual(saved);
    resume(g);
    ticks(g, 220);
    expect(g.fever).toBe(0);
    expect(g.feverCount).toBe(1);
  });
  it('registers shield expiry and a stunned competitor waking on the player without a movement tick', () => {
    for (const waking of [false, true]) {
      const g = createGame();
      begin(g);
      g.invincible = waking ? 0 : 0.001;
      g.moveClock = 0;
      g.feverCharge = 4;
      g.enemies = [
        {
          ...g.player,
          id: 0,
          stunned: waking ? 0.001 : 0,
          clock: 0,
          type: 'chase',
        },
      ];
      step(g);
      expect(g.hp).toBe(2);
      expect(g.feverCharge).toBe(0);
      expect(g.moveClock).toBeLessThan(MODES.middle.playerStep);
      step(g);
      expect(g.hp).toBe(2);
    }
  });
  it('awards near-miss risk points independently of ordinary sugar score', () => {
    const normal = createGame(),
      risky = createGame();
    for (const g of [normal, risky]) {
      g.enemies = [];
      begin(g);
      steer(g, 'right');
    }
    risky.enemies = [
      { x: 3, y: 1, id: 0, type: 'chase', stunned: 0, clock: 0 },
    ];
    ticks(normal, 10);
    ticks(risky, 10);
    expect(risky.score).toBe(Math.round(normal.score * 1.5));
  });
  it('ends in timeout and heart loss, then same-seed fresh retry resets all transient state', () => {
    const g = createGame();
    begin(g);
    g.enemies = [];
    ticks(g, 2800);
    expect(g.status).toBe('lost');
    expect(g.reason).toContain('時間切れ');
    const second = createGame('high');
    begin(second);
    second.hp = 1;
    second.invincible = 0;
    second.enemies[0] = { ...second.enemies[0], x: 1, y: 1, stunned: 0 };
    ticks(second, 10);
    expect(second.status).toBe('lost');
    expect(second.hp).toBe(0);
    const retry = createGame(second.temperature, second.style, second.seed);
    expect(retry).toEqual(createGame('high'));
  });
  it('clears exactly three stages, preserves run score and ranks completion', () => {
    const g = createGame();
    begin(g);
    for (let i = 0; i < 3; i++) {
      g.collected = WAVES[i].goal;
      g.waveMaxCombo = 8;
      g.acidCollected = 2;
      g.waveHits = 0;
      expect(missionComplete(g)).toBe(true);
      step(g);
      expect(g.status).toBe(i === 2 ? 'won' : 'wave');
      if (i < 2) nextWave(g);
    }
    expect(g.missions).toBe(3);
    expect(rank(g)).toBe('S');
    expect(achievements(g)).toContain('ミッション完遂');
    const snapshot = structuredClone(g);
    ticks(g, 100);
    expect(g).toEqual(snapshot);
  });
  it('offers distinct next-stage boosts, grants them once, and resets temporary power', () => {
    for (const boost of ['shield', 'energy', 'time'] as const) {
      const g = createGame();
      begin(g);
      g.collected = WAVES[0].goal;
      step(g);
      expect(g.status).toBe('wave');
      const clearScore = g.score;
      ticks(g, 600);
      expect(g.score).toBe(clearScore);
      g.energy = 10;
      g.fever = 2;
      g.feverCharge = 9;
      nextWave(g, boost);
      expect(g.wave).toBe(1);
      expect(g.lastBoost).toBe(boost);
      expect(g.fever).toBe(0);
      expect(g.feverCharge).toBe(0);
      expect(g.invincible).toBe(boost === 'shield' ? 6 : 2);
      expect(g.energy).toBe(boost === 'energy' ? 100 : 35);
      expect(g.timeLeft).toBe(WAVES[1].seconds + (boost === 'time' ? 12 : 0));
      const snapshot = structuredClone(g);
      nextWave(g, boost);
      expect(g).toEqual(snapshot);
      if (boost === 'shield') {
        g.enemies = [
          { ...g.player, id: 0, stunned: 0, clock: 0, type: 'chase' },
        ];
        step(g);
        expect(g.hp).toBe(3);
      }
      g.enemies = [];
      ticks(g, 361);
      expect(g.invincible).toBe(0);
      if (boost === 'shield') {
        g.enemies = [
          { ...g.player, id: 0, stunned: 0, clock: 0, type: 'chase' },
        ];
        step(g);
        expect(g.hp).toBe(2);
      }
      if (boost === 'energy') {
        expect(skill(g, 'pulse')).toBe(true);
        expect(g.energy).toBe(60);
      }
      g.collected = WAVES[1].goal;
      step(g);
      nextWave(g);
      expect(g.wave).toBe(2);
      expect(g.lastBoost).toBe(null);
      expect(g.timeLeft).toBe(WAVES[2].seconds);
      expect(g.invincible).toBe(2);
    }
  });
  it('bounds all game values during diverse seeded play', () => {
    for (let seed = 1; seed <= 32; seed++) {
      const g = createGame(
        (['low', 'middle', 'high'] as Temperature[])[seed % 3],
        'breaker',
        seed,
      );
      begin(g);
      for (let i = 0; i < 3500; i++) {
        if (i % 30 === 0)
          steer(
            g,
            (['right', 'down', 'left', 'up'] as const)[
              (seed + Math.floor(i / 30)) % 4
            ],
          );
        if (i % 90 === 0) skill(g, i % 180 ? 'dash' : 'pulse');
        step(g);
      }
      expect(g.hp).toBeGreaterThanOrEqual(0);
      expect(g.hp).toBeLessThanOrEqual(3);
      expect(walkable(g.tiles, g.player)).toBe(true);
      for (const v of [g.energy, g.acid]) {
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThanOrEqual(100);
      }
      expect(g.fever).toBeGreaterThanOrEqual(0);
      expect(g.fever).toBeLessThanOrEqual(FEVER.seconds);
      expect(g.feverCharge).toBeGreaterThanOrEqual(0);
      expect(g.feverCharge).toBeLessThan(FEVER.goal);
      expect(Number.isFinite(g.score)).toBe(true);
      expect(g.pickups.some((p) => !walkable(g.tiles, p))).toBe(false);
      expect(new Set(g.pickups.map((p) => `${p.x},${p.y}`)).size).toBe(
        g.pickups.length,
      );
    }
  });
  it('normalizes invalid seeds and ignores invalid dt', () => {
    expect(createGame('low', 'gatherer', NaN).seed).toBe(260907);
    const g = createGame();
    begin(g);
    const snapshot = structuredClone(g);
    step(g, NaN);
    step(g, -1);
    expect(g).toEqual(snapshot);
    expect(equal(g.player, { x: 1, y: 1 })).toBe(true);
  });
});
describe('local-only records', () => {
  it('recovers malformed, wrong-version and hostile local data', () => {
    expect(readRecords({ getItem: () => '{' })).toEqual(emptyRecords());
    expect(readRecords({ getItem: () => '{"version":2}' })).toEqual(
      emptyRecords(),
    );
    const r = readRecords({
      getItem: () =>
        JSON.stringify({
          version: 1,
          high: { low: -50, middle: '42', high: 123 },
          runs: -1,
          achievements: ['<script>', '20連鎖', '20連鎖'],
        }),
    });
    expect(r.high).toEqual({ low: 0, middle: 0, high: 123 });
    expect(r.achievements).toEqual(['20連鎖']);
    expect(r.runs).toBe(0);
  });
  it('writes only terminal runs and keeps separate temperature records', () => {
    const g = createGame('high');
    expect(recordRun(emptyRecords(), g).runs).toBe(0);
    g.status = 'lost';
    g.score = 450;
    const first = recordRun(emptyRecords(), g);
    g.score = 100;
    const second = recordRun(first, g);
    expect(second.high.high).toBe(450);
    expect(second.high.low).toBe(0);
    expect(second.runs).toBe(2);
  });
  it('tolerates denied/quota-exceeded storage', () => {
    expect(
      saveRecords(
        {
          setItem: () => {
            throw Error('QuotaExceeded');
          },
        },
        emptyRecords(),
      ),
    ).toBe(false);
    expect(
      readRecords({
        getItem: () => {
          throw Error('denied');
        },
      }),
    ).toEqual(emptyRecords());
  });
});
