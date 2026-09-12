import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  begin,
  createGame,
  MODES,
  WAVES,
  pause,
  resume,
  step,
  steer,
  skill,
  nextWave,
  rank,
  missionComplete,
  achievements,
  type Game,
  type Direction,
  type Temperature,
  type Style,
  type WaveBoost,
} from './model';
import {
  emptyRecords,
  readRecords,
  recordRun,
  saveRecords,
  type Records,
} from './storage';
import {
  scientificFacts,
  educationalNote,
  fictionalNote,
  disclaimer,
} from './science';
import { createSound } from './audio';
import './style.css';
const arrows: Record<Direction, string> = {
  up: '↑',
  down: '↓',
  left: '←',
  right: '→',
  stop: '■',
};
const PREF_KEY = 'shubo-run:preferences:v2';
function dailySeed() {
  return Number(
    new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Tokyo',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    })
      .format(new Date())
      .replace(/\D/g, ''),
  );
}
const nf = new Intl.NumberFormat('ja-JP');
const KEYS: Record<string, Direction> = {
  ArrowUp: 'up',
  w: 'up',
  W: 'up',
  ArrowDown: 'down',
  s: 'down',
  S: 'down',
  ArrowLeft: 'left',
  a: 'left',
  A: 'left',
  ArrowRight: 'right',
  d: 'right',
  D: 'right',
  x: 'stop',
  X: 'stop',
};
function Board({ g }: { g: Game }) {
  const mode = MODES[g.temperature];
  // SVG needs an explicit image role for its dynamic, accessible arena description.
  // oxlint-disable jsx-a11y/prefer-tag-over-role
  return (
    <svg
      viewBox="0 0 510 510"
      role="img"
      aria-label={`酒母の迷路。自分は左から${g.player.x}、上から${g.player.y}。糖${g.collected}個、ハート${g.hp}。`}
      className={`board ${g.fever > 0 ? 'fever-board' : ''}`}
      data-testid="board"
      data-status={g.status}
      data-x={g.player.x}
      data-y={g.player.y}
      data-step={mode.playerStep}
      data-wave={g.wave}
      data-hp={g.hp}
      data-fever={g.fever.toFixed(2)}
      data-energy={Math.floor(g.energy)}
    >
      <defs>
        <pattern
          id="paper"
          width="15"
          height="15"
          patternUnits="userSpaceOnUse"
        >
          <circle cx="2" cy="2" r=".7" fill="#384744" />
        </pattern>
      </defs>
      <rect width="510" height="510" fill="#102c2b" />
      <rect width="510" height="510" fill="url(#paper)" />
      {[
        { x: 30, y: 30 },
        { x: 360, y: 30 },
        { x: 30, y: 360 },
        { x: 360, y: 360 },
      ].map((p, i) => (
        <rect
          key={i}
          {...p}
          width="120"
          height="120"
          rx="26"
          className={g.acid >= 60 ? 'zone active' : 'zone'}
        />
      ))}
      {g.tiles.flatMap((row, y) =>
        row
          .split('')
          .map((tile, x) =>
            tile === '#' ? (
              <rect
                key={`${x},${y}`}
                data-wall={`${x},${y}`}
                x={x * 30 + 3}
                y={y * 30 + 3}
                width="24"
                height="24"
                rx={x === 0 || y === 0 || x === 16 || y === 16 ? 8 : 9}
                fill={
                  x === 0 || y === 0 || x === 16 || y === 16
                    ? '#284f48'
                    : '#35544c'
                }
                stroke="#6d9180"
                strokeWidth="1.5"
              />
            ) : null,
          ),
      )}
      {g.pickups.map((p) => (
        <g
          key={`${p.x},${p.y}`}
          data-pickup={p.kind}
          data-x={p.x}
          data-y={p.y}
          transform={`translate(${p.x * 30 + 15} ${p.y * 30 + 15})`}
        >
          {p.kind === 'acid' ? (
            <>
              <rect
                x="-8"
                y="-8"
                width="16"
                height="16"
                rx="5"
                fill="#166a50"
                stroke="#152f25"
              />
              <path d="M-4 0H4M0 -4V4" stroke="#fff9e9" strokeWidth="2" />
            </>
          ) : p.kind === 'gold' ? (
            <>
              <path
                d="M0 -10L10 0L0 10L-10 0Z"
                fill="#efac20"
                stroke="#57420e"
                strokeWidth="2"
              />
              <circle r="3" fill="#fff8d6" />
            </>
          ) : (
            <circle r="4.3" fill="#ffe2a0" stroke="#c19549" strokeWidth="1" />
          )}
        </g>
      ))}
      {g.enemies.map((e) => (
        <g
          key={e.id}
          data-enemy={e.id}
          data-x={e.x}
          data-y={e.y}
          data-stunned={e.stunned > 0}
          className={`actor enemy ${e.stunned > 0 ? 'stunned' : ''}`}
          style={{
            transform: `translate(${e.x * 30 + 15}px,${e.y * 30 + 15}px)`,
          }}
        >
          <path
            d="M0 -12L5 -8L11 -8L10 -2L13 3L7 6L5 12L0 9L-5 12L-7 6L-13 3L-10 -2L-11 -8L-5 -8Z"
            fill={
              e.stunned > 0
                ? '#e9e5da'
                : e.type === 'chase'
                  ? '#e7858b'
                  : e.type === 'ambush'
                    ? '#bf9be7'
                    : '#72bbd0'
            }
            stroke="#28392e"
            strokeWidth="2"
          />
          {e.stunned > 0 ? (
            <path
              d="M-6 -3l4 4m0 -4l-4 4m8 -4l4 4m0 -4l-4 4"
              stroke="#233c33"
              strokeWidth="1.5"
            />
          ) : (
            <>
              <circle cx="-4" cy="-2" r="2" fill="#233c33" />
              <circle cx="4" cy="-2" r="2" fill="#233c33" />
            </>
          )}
        </g>
      ))}
      {g.status === 'playing' && g.direction !== 'stop' && (
        <path
          className="motion-trail"
          d={`M${g.previous.x * 30 + 15} ${g.previous.y * 30 + 15}L${g.player.x * 30 + 15} ${g.player.y * 30 + 15}`}
          stroke={g.fever > 0 ? '#ffe3a0' : '#ec703c'}
          strokeWidth={g.dash > 0 ? 18 : 9}
          strokeLinecap="round"
          opacity=".35"
        />
      )}
      <g
        className={`actor player ${g.dash > 0 ? 'dashing' : ''}`}
        style={{
          transform: `translate(${g.player.x * 30 + 15}px,${g.player.y * 30 + 15}px)`,
        }}
      >
        {(g.invincible > 0 || g.fever > 0) && (
          <circle
            r="17"
            fill="none"
            stroke="#15674e"
            strokeWidth="2"
            strokeDasharray="4 3"
          />
        )}
        {g.pulse > 0 && (
          <circle
            className="pulse-ring"
            r={(g.style === 'breaker' ? 5 : 4) * 30}
            fill="#ed702029"
            stroke="#bd471d"
            strokeWidth="3"
          />
        )}
        <circle
          r="12"
          fill={g.fever > 0 ? '#ffe06d' : '#ff8857'}
          stroke="#332e24"
          strokeWidth="2"
        />
        <circle
          cx="9"
          cy="-8"
          r="5"
          fill="#f7a37f"
          stroke="#332e24"
          strokeWidth="1.8"
        />
        <path
          d={
            g.direction === 'left'
              ? 'M-7 -3v2m6 -2v2'
              : g.direction === 'up'
                ? 'M-4 -6v2m7 -2v2'
                : 'M-2 -3v2m7 -2v2'
          }
          stroke="#272d25"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
        <path
          d="M-2 5Q1 8 5 4"
          fill="none"
          stroke="#272d25"
          strokeWidth="1.5"
        />
      </g>
    </svg>
  );
}
// oxlint-enable jsx-a11y/prefer-tag-over-role
function App() {
  const game = useRef<Game>(createGame());
  const [g, setG] = useState<Game>({ ...game.current });
  const [records, setRecords] = useState<Records>(emptyRecords);
  const [temperature, setTemperature] = useState<Temperature>('middle');
  const [style, setStyle] = useState<Style>('gatherer');
  const [seed, setSeed] = useState('260907');
  const [storageMessage, setStorageMessage] = useState(
    '記録はこの端末だけに保存',
  );
  const [pauseReason, setPauseReason] = useState('');
  const [announcement, setAnnouncement] = useState('');
  const arena = useRef<HTMLDivElement>(null);
  const primary = useRef<HTMLButtonElement>(null);
  const recorded = useRef(false);
  const [theatre, setTheatre] = useState(false);
  const [daily, setDaily] = useState(false);
  const [boost, setBoost] = useState<WaveBoost>('shield');
  const [soundEnabled, setSoundEnabled] = useState(false);
  const [sound] = useState(() => createSound());
  const swipe = useRef<{ id: number; x: number; y: number } | null>(null);
  const bestBefore = useRef(0);
  const feedback = useRef({
    score: 0,
    hp: 3,
    combo: 0,
    skills: 0,
    fever: 0,
    status: 'ready',
  });
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(PREF_KEY) || '{}');
      if (saved.sound === true) {
        setSoundEnabled(true);
        sound.setEnabled(true);
      }
      if (saved.daily === true) {
        const n = dailySeed();
        setDaily(true);
        setSeed(String(n));
        game.current = createGame('middle', 'gatherer', n);
        setG({ ...game.current });
      }
    } catch {
      /* Optional preferences must not block play. */
    }
    return () => sound.dispose();
  }, [sound]);
  useEffect(() => {
    const old = feedback.current;
    if (g.status === 'playing') {
      if (g.hp < old.hp) sound.play('hit');
      else if (g.fever > 0 && old.fever <= 0) sound.play('fever');
      else if (g.skills > old.skills) sound.play(g.dash > 0 ? 'dash' : 'pulse');
      else if (g.score > old.score)
        sound.play(g.combo >= 5 && g.combo % 5 === 0 ? 'combo' : 'collect');
    }
    if (g.status !== old.status) {
      if (g.status === 'wave') {
        sound.play('clear');
        setBoost('shield');
      }
      if (g.status === 'won') sound.play('win');
      if (g.status === 'lost') sound.play('lose');
      if (g.status === 'paused') sound.suspend();
    }
    feedback.current = {
      score: g.score,
      hp: g.hp,
      combo: g.combo,
      skills: g.skills,
      fever: g.fever,
      status: g.status,
    };
  }, [g, sound]);
  useEffect(() => {
    let landscape = window.innerWidth > window.innerHeight;
    const viewport = () => {
      document.documentElement.style.setProperty(
        '--play-height',
        `${window.visualViewport?.height || window.innerHeight}px`,
      );
      const next = window.innerWidth > window.innerHeight;
      if (next !== landscape && game.current.status === 'playing') {
        pause(game.current);
        setPauseReason('画面の向きが変わったため停止しました。');
        setG({ ...game.current });
        swipe.current = null;
      }
      landscape = next;
    };
    viewport();
    window.visualViewport?.addEventListener('resize', viewport);
    window.addEventListener('resize', viewport);
    const rotate = () => {
      if (game.current.status === 'playing') {
        pause(game.current);
        setPauseReason('画面の向きが変わったため停止しました。');
        setG({ ...game.current });
      }
      swipe.current = null;
    };
    window.addEventListener('orientationchange', rotate);
    return () => {
      window.visualViewport?.removeEventListener('resize', viewport);
      window.removeEventListener('resize', viewport);
      window.removeEventListener('orientationchange', rotate);
    };
  }, []);
  useEffect(() => {
    document.body.classList.toggle('game-open', theatre);
    return () => document.body.classList.remove('game-open');
  }, [theatre]);
  const active =
    g.status === 'playing' || g.status === 'paused' || g.status === 'wave';
  const update = () => setG({ ...game.current });
  useEffect(() => {
    try {
      setRecords(readRecords(window.localStorage));
    } catch {
      setStorageMessage('保存を利用できません。今回のプレイは続けられます。');
    }
  }, []);
  useEffect(() => {
    let raf = 0,
      last = 0,
      acc = 0,
      paint = 0;
    const loop = (now: number) => {
      if (last) acc += Math.min((now - last) / 1000, 0.1);
      last = now;
      const before = game.current.status;
      while (acc >= 1 / 60) {
        step(game.current);
        acc -= 1 / 60;
      }
      if (
        (game.current.status === 'playing' && now - paint >= 32) ||
        before !== game.current.status
      ) {
        setG({ ...game.current });
        paint = now;
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);
  useEffect(() => {
    if ((g.status === 'won' || g.status === 'lost') && !recorded.current) {
      recorded.current = true;
      setRecords((old) => {
        const next = recordRun(old, game.current);
        try {
          if (!saveRecords(window.localStorage, next))
            setStorageMessage(
              '保存できませんでした。今回のスコアは画面で確認できます。',
            );
        } catch {
          setStorageMessage('保存できませんでした。');
        }
        return next;
      });
    }
    if (['ready', 'paused', 'wave', 'won', 'lost'].includes(g.status))
      primary.current?.focus({ preventScroll: true });
    setAnnouncement(
      g.status === 'won'
        ? '全3ステージクリア！'
        : g.status === 'lost'
          ? game.current.reason
          : g.status === 'wave'
            ? 'ステージクリア。次のステージへ進めます。'
            : g.status === 'paused'
              ? '一時停止しました。再開するまで時間は進みません。'
              : '',
    );
  }, [g.status]);
  useEffect(() => {
    const autoPause = (reason: string) => {
      if (game.current.status === 'playing') {
        pause(game.current);
        setPauseReason(reason);
        setG({ ...game.current });
      }
    };
    const visibility = () => {
      if (document.hidden) autoPause('タブが非表示になったため停止しました。');
    };
    const blur = () =>
      autoPause('画面からフォーカスが外れたため停止しました。');
    document.addEventListener('visibilitychange', visibility);
    window.addEventListener('blur', blur);
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting)
        autoPause('ゲーム画面が画面外になったため停止しました。');
    });
    if (arena.current) observer.observe(arena.current);
    return () => {
      observer.disconnect();
      document.removeEventListener('visibilitychange', visibility);
      window.removeEventListener('blur', blur);
    };
  }, []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLSelectElement ||
        e.target instanceof HTMLTextAreaElement
      )
        return;
      const s = game.current;
      if (
        KEYS[e.key] ||
        ['Escape', 'p', 'P', 'j', 'J', 'k', 'K', 'Shift', ' '].includes(e.key)
      )
        sound.unlock();
      if (e.key === 'Escape' || e.key === 'p' || e.key === 'P') {
        if (s.status === 'playing') {
          pause(s);
          setPauseReason('');
        } else if (s.status === 'paused') resume(s);
        setG({ ...s });
        return;
      }
      if (s.status !== 'playing') return;
      if (KEYS[e.key]) {
        e.preventDefault();
        steer(s, KEYS[e.key]);
      } else if (
        (e.code === 'Space' && !(e.target instanceof HTMLButtonElement)) ||
        e.key === 'j' ||
        e.key === 'J'
      ) {
        e.preventDefault();
        if (!e.repeat) skill(s, 'pulse');
      } else if (e.key === 'Shift' || e.key === 'k' || e.key === 'K') {
        e.preventDefault();
        if (!e.repeat) skill(s, 'dash');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [sound]);
  const focusArena = () => arena.current?.focus({ preventScroll: true });
  const frameGame = () => {
    arena.current
      ?.closest('.field')
      ?.scrollIntoView({ block: 'start', behavior: 'instant' });
    focusArena();
  };
  const start = (same = false) => {
    sound.unlock();
    setTheatre(true);
    bestBefore.current = records.high[same ? g.temperature : temperature];
    feedback.current = {
      score: 0,
      hp: 3,
      combo: 0,
      skills: 0,
      fever: 0,
      status: 'ready',
    };
    game.current = createGame(
      same ? g.temperature : temperature,
      same ? g.style : style,
      same ? g.seed : Number(seed),
    );
    begin(game.current);
    recorded.current = false;
    setPauseReason('');
    update();
    frameGame();
  };
  const selectMode = (t: Temperature) => {
    setTemperature(t);
    game.current = createGame(t, style, Number(seed));
    update();
  };
  const selectStyle = (s: Style) => {
    setStyle(s);
    game.current = createGame(temperature, s, Number(seed));
    update();
  };
  const act = (kind: 'pulse' | 'dash') => {
    sound.unlock();
    skill(game.current, kind);
    update();
    focusArena();
  };
  const move = (direction: Direction) => {
    sound.unlock();
    steer(game.current, direction);
    update();
    focusArena();
  };
  const togglePause = () => {
    sound.unlock();
    if (g.status === 'playing') {
      pause(game.current);
      setPauseReason('');
    } else resume(game.current);
    update();
    focusArena();
  };
  const wave = WAVES[g.wave];
  const terminal = g.status === 'won' || g.status === 'lost';
  return (
    <div className={theatre ? 'play-session' : ''}>
      <header className="brand-bar">
        <a href="#main" className="brand">
          <span className="sat-mark">SAT</span>
          <span>
            SAKE ART TOKYO<small>FERMENTATION PLAYGROUND</small>
          </span>
        </a>
        <span className="edition">ARCADE / 02</span>
      </header>
      <main id="main">
        <div className="title-line">
          <div>
            <p className="eyebrow">酒母の中を、駆けめぐれ。</p>
            <h1>
              SHUBO <span>RUN</span>
              <i>酒母ラン</i>
            </h1>
          </div>
          <span className="local-stamp">
            3 STAGES
            <br />
            FEVER EDITION
          </span>
        </div>
        <div className="game-layout">
          <section className="setup" aria-label="プレイ設定">
            <div className="daily-selector">
              <button
                aria-label="今日のコース"
                disabled={active}
                aria-pressed={daily}
                onClick={() => {
                  const n = daily ? 260907 : dailySeed();
                  setDaily(!daily);
                  setSeed(String(n));
                  game.current = createGame(temperature, style, n);
                  update();
                  try {
                    localStorage.setItem(
                      PREF_KEY,
                      JSON.stringify({ sound: soundEnabled, daily: !daily }),
                    );
                  } catch {
                    /* optional */
                  }
                }}
              >
                <span>◈</span> 今日のコース{' '}
                <small>{daily ? '選択中' : '毎日かわる'}</small>
              </button>
              <span>
                {daily
                  ? '日本時間で毎日更新。同じ日・設定で同じ配置。'
                  : 'まずは定番コース。何度でも腕試し。'}
              </span>
            </div>
            <div className="section-cap">
              01 / ENVIRONMENT <span>ゲーム内の相対環境</span>
            </div>
            <fieldset className="temperatures" aria-label="温度を選ぶ">
              {(Object.keys(MODES) as Temperature[]).map((t) => (
                <button
                  key={t}
                  disabled={active}
                  aria-pressed={temperature === t}
                  onClick={() => selectMode(t)}
                  className={`temp ${t}`}
                >
                  <span>{MODES[t].label}</span>
                  <small>×{MODES[t].multiplier.toFixed(1)}</small>
                </button>
              ))}
            </fieldset>
            <div className="mode-detail">
              <h2>{MODES[temperature].name}</h2>
              <p>{MODES[temperature].description}</p>
              <dl className="mode-facts">
                <div>
                  <dt>移動</dt>
                  <dd>
                    {temperature === 'low'
                      ? 'ゆっくり'
                      : temperature === 'high'
                        ? '高速'
                        : '標準'}
                  </dd>
                </div>
                <div>
                  <dt>競合</dt>
                  <dd>{MODES[temperature].enemies}体〜</dd>
                </div>
                <div>
                  <dt>酸ゲージ</dt>
                  <dd>+{MODES[temperature].acidRate}/秒</dd>
                </div>
              </dl>
            </div>
            <label className="style-select">
              プレイスタイル{' '}
              <select
                aria-label="プレイスタイル"
                disabled={active}
                value={style}
                onChange={(e) => selectStyle(e.target.value as Style)}
              >
                <option value="gatherer">採取家 / コンボ +1秒</option>
                <option value="breaker">突破役 / パルス強化</option>
              </select>
            </label>
            <details className="setup-extra">
              <summary>コース番号・スタイルの説明</summary>
              <p>
                {style === 'gatherer'
                  ? '1粒でエネルギー+8。コンボの猶予も長く、拾い続けるほど強い。'
                  : 'パルス消費30・射程5マス。採取でエネルギー+6。競合の間を切りひらく。'}
              </p>
              <label className="seed-label">
                コース番号（シード）
                <input
                  aria-label="コース番号"
                  type="number"
                  min="1"
                  max="4294967295"
                  disabled={active}
                  value={seed}
                  onChange={(e) => {
                    setDaily(false);
                    setSeed(e.target.value);
                    try {
                      localStorage.setItem(
                        PREF_KEY,
                        JSON.stringify({ sound: soundEnabled, daily: false }),
                      );
                    } catch {
                      /*optional*/
                    }
                  }}
                  onBlur={() =>
                    setSeed(
                      String(createGame(temperature, style, Number(seed)).seed),
                    )
                  }
                />
              </label>
              <p className="small">
                同じ番号・温度・スタイルで、同じ配置に再挑戦できます。
              </p>
            </details>
          </section>
          <section
            className={`field ${g.fever > 0 ? 'is-fever' : ''}`}
            aria-label="酒母アーケード"
          >
            <div className="play-topline">
              <b>
                SHUBO RUN <span>/ {daily ? 'DAILY' : 'ARCADE'}</span>
              </b>
              <button
                className="sound-toggle"
                aria-label="サウンド"
                aria-pressed={soundEnabled}
                onClick={() => {
                  const on = !soundEnabled;
                  setSoundEnabled(on);
                  sound.setEnabled(on);
                  sound.unlock();
                  if (on) sound.play('collect');
                  try {
                    localStorage.setItem(
                      PREF_KEY,
                      JSON.stringify({ sound: on, daily }),
                    );
                  } catch {
                    /* optional */
                  }
                }}
              >
                {soundEnabled ? '♪ 音 ON' : '♪ 音 OFF'}
              </button>
            </div>
            <div className="scoreboard">
              <div>
                <span className="stat-label">SCORE</span>
                <strong data-testid="score">
                  {nf.format(g.score).padStart(5, '0')}
                </strong>
              </div>
              <div className="stage-stat">
                <span className="stat-label">STAGE</span>
                <strong>
                  {String(g.wave + 1).padStart(2, '0')}
                  <em>/03</em>
                </strong>
              </div>
              <div>
                <span className="stat-label">TIME</span>
                <strong
                  className={g.timeLeft < 10 ? 'urgent' : ''}
                  data-testid="time"
                >
                  {Math.ceil(g.timeLeft)}
                  <em>s</em>
                </strong>
              </div>
              <button
                className="pause-button"
                disabled={!['playing', 'paused'].includes(g.status)}
                onClick={togglePause}
                aria-label={g.status === 'paused' ? '再開' : '一時停止'}
              >
                {g.status === 'paused' ? '▶' : 'Ⅱ'}
              </button>
            </div>
            <div className="mission-line">
              <span>
                <b>
                  糖 {g.collected}/{wave.goal}
                </b>
                <span className="wave-title"> · {wave.name}</span>
              </span>
              <span className="hearts" aria-label={`ハート残り${g.hp}`}>
                <span aria-hidden="true">
                  {'♥'.repeat(g.hp)}
                  <span className="empty-hearts">{'♡'.repeat(3 - g.hp)}</span>
                </span>
              </span>
            </div>
            <progress
              className="goal-track"
              aria-label="ステージの糖"
              value={g.collected}
              max={wave.goal}
            />
            {/* The focusable game surface owns arrow/WASD controls and is the focus return target. */}
            {/* oxlint-disable jsx-a11y/no-noninteractive-tabindex */}
            <div
              ref={arena}
              className="arena"
              onPointerDown={(e) => {
                if (
                  game.current.status !== 'playing' ||
                  !e.isPrimary ||
                  e.button !== 0
                )
                  return;
                swipe.current = { id: e.pointerId, x: e.clientX, y: e.clientY };
                e.currentTarget.setPointerCapture(e.pointerId);
              }}
              onPointerMove={(e) => {
                const p = swipe.current;
                if (!p || p.id !== e.pointerId) return;
                const dx = e.clientX - p.x,
                  dy = e.clientY - p.y;
                if (Math.max(Math.abs(dx), Math.abs(dy)) < 18) return;
                move(
                  Math.abs(dx) > Math.abs(dy)
                    ? dx > 0
                      ? 'right'
                      : 'left'
                    : dy > 0
                      ? 'down'
                      : 'up',
                );
                swipe.current = { id: p.id, x: e.clientX, y: e.clientY };
              }}
              onPointerUp={(e) => {
                if (swipe.current?.id === e.pointerId) swipe.current = null;
              }}
              onPointerCancel={() => {
                swipe.current = null;
              }}
              onLostPointerCapture={() => {
                swipe.current = null;
              }}
              tabIndex={0}
              role="application"
              aria-label="操作エリア。スワイプまたは方向ボタンで移動、パルスで足止め、ダッシュで回避。キーボードにも対応。"
              aria-describedby="controls-help"
            >
              <Board g={g} />
              {g.status === 'playing' && (
                <>
                  <div className="fever-status" data-testid="fever-status">
                    {g.fever > 0 ? (
                      <>
                        <b>FEVER!</b> 採取点×2・接触無効{' '}
                        <span>{g.fever.toFixed(1)}s</span>
                      </>
                    ) : (
                      <>
                        FEVER <b>{g.feverCharge}/10</b>
                        <i style={{ width: `${g.feverCharge * 10}%` }} />
                      </>
                    )}
                  </div>
                  <div className="combo-tag" aria-label={`${g.combo}コンボ`}>
                    <b>{g.combo}</b> COMBO{' '}
                    <span>
                      ×
                      {(1 + Math.min(3, Math.floor(g.combo / 5)) * 0.5).toFixed(
                        1,
                      )}
                    </span>
                  </div>
                  {g.messageLeft > 0 && (
                    <div className="game-toast">{g.message}</div>
                  )}
                </>
              )}
              {g.status !== 'playing' && (
                <div className="overlay">
                  <div
                    className={`overlay-card ${terminal ? 'result-card' : ''}`}
                  >
                    <p className="eyebrow">
                      {g.status === 'ready'
                        ? 'YOU ARE THE YEAST'
                        : g.status === 'paused'
                          ? 'TAKE A BREATH'
                          : g.status === 'wave'
                            ? 'STAGE COMPLETE'
                            : g.status === 'won'
                              ? 'ALL STAGES CLEAR'
                              : 'TRY ANOTHER ROUTE'}
                    </p>
                    <h2>
                      {g.status === 'ready' ? (
                        <>
                          糖を集めて、
                          <br />
                          道をひらこう。
                        </>
                      ) : g.status === 'paused' ? (
                        'ひと休み。'
                      ) : g.status === 'wave' ? (
                        `STAGE ${g.wave + 1} クリア`
                      ) : g.status === 'won' ? (
                        '踏破、おめでとう！'
                      ) : (
                        'もう一度、いける。'
                      )}
                    </h2>
                    {g.status === 'ready' ? (
                      <>
                        <p>
                          橙の酵母キャラを操作。
                          <br />
                          10連続でフィーバー。競合をかわして3ステージへ。
                        </p>
                        <div className="start-instructions">
                          <span>◆ 糖を{wave.goal}個</span>
                          <span>♥ ハート3つ</span>
                          <span>✳ パルスで足止め</span>
                        </div>
                        <button
                          ref={primary}
                          className="primary"
                          aria-label="プレイ開始"
                          onClick={() => start()}
                        >
                          プレイ開始 <span>→</span>
                        </button>
                        <p className="small">スワイプ、または下の矢印で進む</p>
                      </>
                    ) : g.status === 'paused' ? (
                      <>
                        <p>{pauseReason || '時間も競合も止まっています。'}</p>
                        <button
                          ref={primary}
                          className="primary"
                          onClick={togglePause}
                        >
                          プレイを再開 →
                        </button>
                        <button
                          className="text-button"
                          onClick={() => {
                            setTheatre(false);
                            game.current = createGame(
                              temperature,
                              style,
                              Number(seed),
                            );
                            update();
                          }}
                        >
                          このプレイをやめる
                        </button>
                      </>
                    ) : g.status === 'wave' ? (
                      <>
                        <p>
                          追加ミッション：
                          {missionComplete(g)
                            ? '達成！ +500 × 温度倍率'
                            : '未達成。次の周回で挑戦！'}
                        </p>
                        <p>
                          次は糖を{WAVES[g.wave + 1].goal}個。
                          <br />
                          エネルギー+25。支援をひとつ選ぼう。
                        </p>
                        <fieldset
                          className="boost-choices"
                          aria-label="次のステージの支援"
                        >
                          {(
                            [
                              {
                                id: 'shield',
                                icon: '◉',
                                name: '守りを固める',
                                detail: '6秒の接触無効',
                              },
                              {
                                id: 'energy',
                                icon: 'ϟ',
                                name: '補給を満タン',
                                detail: 'エネルギー100',
                              },
                              {
                                id: 'time',
                                icon: '◷',
                                name: '時間を増やす',
                                detail: '制限時間＋12秒',
                              },
                            ] as const
                          ).map((b) => (
                            <button
                              key={b.id}
                              aria-label={b.name}
                              aria-pressed={boost === b.id}
                              onClick={() => setBoost(b.id)}
                            >
                              <b>{b.icon}</b>
                              <strong>{b.name}</strong>
                              <small>{b.detail}</small>
                            </button>
                          ))}
                        </fieldset>
                        <button
                          ref={primary}
                          className="primary"
                          onClick={() => {
                            sound.unlock();
                            nextWave(game.current, boost);
                            update();
                            focusArena();
                          }}
                        >
                          次のステージへ →
                        </button>
                      </>
                    ) : (
                      <>
                        {g.score > bestBefore.current && (
                          <div className="new-best">
                            ✦ NEW BEST / 自己ベスト更新
                          </div>
                        )}
                        <div className="rank-line">
                          <b>{rank(g)}</b>
                          <div>
                            RANK
                            <strong>
                              {nf.format(g.score)}
                              <small> pts</small>
                            </strong>
                          </div>
                        </div>
                        <p>
                          {g.status === 'lost'
                            ? g.reason
                            : `3ステージ踏破 / ミッション ${g.missions}/3`}
                        </p>
                        <div className="result-mini">
                          <span>最大 {g.maxCombo}連鎖</span>
                          <span>糖 {g.totalCollected}個</span>
                          <span>接触 {g.totalHits}回</span>
                        </div>
                        <button
                          ref={primary}
                          className="primary"
                          onClick={() => start(true)}
                        >
                          同じコースで再挑戦 ↻
                        </button>
                        <button
                          className="text-button"
                          onClick={() => {
                            setTheatre(false);
                            setDaily(false);
                            try {
                              localStorage.setItem(
                                PREF_KEY,
                                JSON.stringify({
                                  sound: soundEnabled,
                                  daily: false,
                                }),
                              );
                            } catch {
                              /* optional */
                            }
                            const next = (g.seed % 4294967294) + 1;
                            setSeed(String(next));
                            game.current = createGame(temperature, style, next);
                            update();
                          }}
                        >
                          別のコース・設定を選ぶ →
                        </button>
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>
            {/* oxlint-enable jsx-a11y/no-noninteractive-tabindex */}
            <div className="meters">
              <div>
                <label htmlFor="energy">
                  エネルギー <b>{Math.floor(g.energy)}</b>
                </label>
                <meter id="energy" min="0" max="100" value={g.energy} />
              </div>
              <div>
                <label htmlFor="acid">
                  酸性化 <small>架空</small> <b>{Math.floor(g.acid)}</b>
                </label>
                <meter id="acid" min="0" max="100" value={g.acid} />
              </div>
            </div>
            <div className="direction-hint" data-testid="direction-hint">
              <span>
                <b>{arrows[g.desired]}</b>{' '}
                {g.desired === 'stop'
                  ? '方向を選んで進む'
                  : g.desired !== g.direction
                    ? '次の曲がり角で曲がる'
                    : 'この方向に進行中'}
              </span>
              <small>スワイプでも操作できます</small>
            </div>
            <div className="touch-controls" aria-label="タッチ操作">
              <div className="dpad">
                {(
                  [
                    { d: 'up', label: '上', icon: '↑' },
                    { d: 'left', label: '左', icon: '←' },
                    { d: 'stop', label: '停止', icon: '■' },
                    { d: 'right', label: '右', icon: '→' },
                    { d: 'down', label: '下', icon: '↓' },
                  ] as const
                ).map(({ d, label, icon }) => (
                  <button
                    key={d}
                    className={`direction ${d}`}
                    aria-label={label}
                    disabled={g.status !== 'playing'}
                    aria-pressed={g.desired === d}
                    onPointerDown={(e) => {
                      if (!e.isPrimary || e.button !== 0) return;
                      e.preventDefault();
                      move(d);
                    }}
                    onClick={(e) => {
                      if (e.detail === 0) move(d);
                    }}
                  >
                    {icon}
                  </button>
                ))}
              </div>
              <div className="skill-buttons">
                <button
                  className="pulse-button"
                  disabled={g.status !== 'playing'}
                  onClick={() => act('pulse')}
                >
                  ✳ パルス{' '}
                  <small>
                    {g.cooldown > 0
                      ? `あと${g.cooldown.toFixed(1)}秒`
                      : g.energy < (style === 'breaker' ? 30 : 40)
                        ? 'エネルギー不足'
                        : '近くの競合を止める'}
                  </small>
                </button>
                <button
                  className="dash-button"
                  disabled={g.status !== 'playing'}
                  onClick={() => act('dash')}
                >
                  ↗ ダッシュ{' '}
                  <small>
                    {g.cooldown > 0
                      ? `あと${g.cooldown.toFixed(1)}秒`
                      : g.energy < 25
                        ? 'エネルギー不足'
                        : '加速＋接触をすり抜ける'}
                  </small>
                </button>
                <span className="cooldown" data-testid="cooldown">
                  {g.cooldown > 0
                    ? `回復まで ${g.cooldown.toFixed(1)}秒`
                    : 'スキル準備OK'}
                </span>
              </div>
            </div>
            <p id="controls-help" className="control-help">
              方向を押すと進み続けます。■で停止。
              <span className="keyboard-help">
                {' '}
                矢印・WASD / J：パルス / K：ダッシュ / P：ポーズ
              </span>
            </p>
          </section>
          <aside className="notebook">
            <div className="section-cap">02 / FIELD NOTES</div>
            <h2>今回のミッション</h2>
            <p className="mission-note">
              {wave.mission}
              <span>達成で +500 × 温度倍率</span>
            </p>
            <ul className="legend">
              <li>
                <i className="dot sugar" />
                糖：採取目標 +1 / 基礎50点
              </li>
              <li>
                <i className="dot gold" />
                大粒の糖：目標 +1 / 基礎180点
              </li>
              <li>
                <i className="dot acid">+</i>緑の粒：酸ゲージ +18
              </li>
              <li>
                <i className="dot enemy-dot">✳</i>競合：接触でハート −1
              </li>
            </ul>
            <p className="small">
              酸ゲージ60以上で緑の区画の競合が減速。危険な接近採取は×1.5。どちらもゲーム専用のルールです。
            </p>
            <details>
              <summary>攻略ノート・全ルール</summary>
              <p>
                5連鎖ごとにコンボ倍率+0.5、最大×2.5。粒を拾うと連鎖の残り時間が戻ります。
              </p>
              <p>
                パルスは近くの競合を3.2秒停止。ダッシュは約1秒、1.65倍速で接触を無効化。スキルは回復時間を共有します。
              </p>
              <p>
                各ステージは45 / 50 / 55秒。糖18 / 24 /
                30個で通過。残り1秒あたり10点×温度倍率を加算します。
              </p>
              <p>
                S：全ミッション＋無傷で踏破、A：2ミッション以上で踏破、B：踏破、C：途中終了。
              </p>
              <p>
                途中の温度・スタイル変更はできません。ポーズから終了すると記録は保存されません。
              </p>
            </details>
          </aside>
        </div>
        <section className="records">
          <div>
            <p className="eyebrow">YOUR LOCAL RECORDS</p>
            <h2>自分の記録を、超えていく。</h2>
            <output className="small">
              {storageMessage} / 完走・終了 {records.runs}回
            </output>
          </div>
          <div className="highs">
            {(Object.keys(MODES) as Temperature[]).map((t) => (
              <div key={t}>
                <span>{MODES[t].label} BEST</span>
                <b data-testid={`best-${t}`}>{nf.format(records.high[t])}</b>
              </div>
            ))}
          </div>
          <div className="achievements" aria-label="実績">
            {[
              '初めての踏破',
              '20連鎖',
              '無傷の採取家',
              'スキルの使い手',
              '高めの挑戦者',
              'ミッション完遂',
            ].map((a) => (
              <span
                key={a}
                className={records.achievements.includes(a) ? 'unlocked' : ''}
              >
                {records.achievements.includes(a) ? '✓' : '○'} {a}
              </span>
            ))}
          </div>
          {terminal && achievements(g).length > 0 && (
            <p className="small">今回の達成：{achievements(g).join(' / ')}</p>
          )}
        </section>
        <section className="science">
          <div className="science-heading">
            <p className="eyebrow">03 / SCIENCE & FICTION</p>
            <h2>遊びと科学の、境界線。</h2>
            <p>{disclaimer}</p>
          </div>
          <details>
            <summary>出典とゲーム表現の違いを見る</summary>
            <div className="science-grid">
              <article>
                <span className="evidence fact">出典で確認</span>
                {scientificFacts.map((f) => (
                  <div key={f.title}>
                    <h3>{f.title}</h3>
                    <p>{f.text}</p>
                    <a href={f.url} target="_blank" rel="noreferrer">
                      {f.source} ↗
                    </a>
                    <p className="small">確認日 {f.checkedOn}</p>
                  </div>
                ))}
              </article>
              <article>
                <span className="evidence teaching">教育用の簡略化</span>
                <p>{educationalNote.text}</p>
              </article>
              <article>
                <span className="evidence fiction">架空のゲーム係数</span>
                <p>{fictionalNote.text}</p>
                <p>
                  「低め・中間・高め」はゲーム内の相対環境です。実際の醸造温度や日程を示しません。
                </p>
              </article>
            </div>
          </details>
        </section>
      </main>
      <footer>
        <b>SAT / SHUBO RUN</b>
        <span>
          会員登録なし・広告なし・外部送信なし
          <br />
          FEVER EDITION — 2026
        </span>
      </footer>
      <output className="sr-only" aria-live="polite">
        {announcement}
      </output>
    </div>
  );
}
createRoot(document.getElementById('root')!).render(<App />);
