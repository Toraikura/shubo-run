export type SoundEvent =
  | 'collect'
  | 'combo'
  | 'hit'
  | 'pulse'
  | 'dash'
  | 'clear'
  | 'win'
  | 'lose'
  | 'fever';

export type SoundController = {
  /** Call directly inside an explicit tap/click to unlock iPhone audio. */
  unlock(): void;
  setEnabled(enabled: boolean): void;
  play(event: SoundEvent): void;
  suspend(): void;
  dispose(): void;
};

type Tone = {
  frequency: number;
  duration: number;
  offset?: number;
  endFrequency?: number;
  volume?: number;
  wave?: OscillatorType;
};

const melodies: Record<SoundEvent, readonly Tone[]> = {
  collect: [{ frequency: 880, endFrequency: 1174, duration: 0.065, volume: 0.055 }],
  combo: [
    { frequency: 1047, duration: 0.09 },
    { frequency: 1568, duration: 0.12, offset: 0.065 },
  ],
  hit: [{ frequency: 155, endFrequency: 75, duration: 0.17, wave: 'triangle' }],
  pulse: [
    { frequency: 330, endFrequency: 660, duration: 0.14 },
    { frequency: 660, endFrequency: 990, duration: 0.14, offset: 0.09 },
  ],
  dash: [{ frequency: 440, endFrequency: 1320, duration: 0.14, wave: 'triangle' }],
  clear: [
    { frequency: 523, duration: 0.13 },
    { frequency: 659, duration: 0.13, offset: 0.09 },
    { frequency: 784, duration: 0.23, offset: 0.18 },
  ],
  win: [
    { frequency: 523, duration: 0.15 },
    { frequency: 659, duration: 0.15, offset: 0.1 },
    { frequency: 784, duration: 0.15, offset: 0.2 },
    { frequency: 1047, duration: 0.3, offset: 0.3 },
  ],
  lose: [
    { frequency: 392, duration: 0.17, volume: 0.07 },
    { frequency: 330, duration: 0.17, offset: 0.12, volume: 0.07 },
    { frequency: 262, duration: 0.26, offset: 0.24, volume: 0.065 },
  ],
  fever: [
    { frequency: 523, duration: 0.12 },
    { frequency: 659, duration: 0.12, offset: 0.065 },
    { frequency: 784, duration: 0.12, offset: 0.13 },
    { frequency: 1047, duration: 0.12, offset: 0.195 },
    { frequency: 1319, duration: 0.24, offset: 0.26 },
  ],
};

type Voice = { oscillator: OscillatorNode; envelope: GainNode };
const MAX_VOICES = 16;

/** Silent by default. All tones are synthesized locally; no files or timers. */
export function createSound(): SoundController {
  let enabled = false;
  let disposed = false;
  let context: AudioContext | undefined;
  let master: GainNode | undefined;
  const voices = new Set<Voice>();
  const lastPlayed = new Map<SoundEvent, number>();

  const forgetVoice = (voice: Voice) => {
    voice.oscillator.onended = null;
    try {
      voice.oscillator.disconnect();
      voice.envelope.disconnect();
    } catch {
      // An interrupted/closed audio device may already have disconnected it.
    }
    voices.delete(voice);
  };

  const stopVoice = (voice: Voice) => {
    try {
      voice.oscillator.stop();
    } catch {
      // The tone may already have ended, or may not have started successfully.
    }
    forgetVoice(voice);
  };

  const suspend = () => {
    for (const voice of voices) stopVoice(voice);
    lastPlayed.clear();
    try {
      if (context && context.state !== 'closed') {
        void context.suspend().catch(() => {});
      }
    } catch {
      // Gameplay remains available when WebAudio is unsupported/interrupted.
    }
  };

  const unlock = () => {
    if (disposed || !enabled || typeof window === 'undefined' || document.hidden) return;
    try {
      if (!context) {
        const AudioContextClass =
          window.AudioContext ??
          (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!AudioContextClass) return;
        context = new AudioContextClass();
        master = context.createGain();
        master.gain.value = 0.5;
        master.connect(context.destination);
      }
      // Invoke resume synchronously in the gesture handler, including Safari's
      // interrupted state. Never retry autonomously after leaving the game.
      if (context.state !== 'closed') void context.resume().catch(() => {});
    } catch {
      // A denied device or browser audio policy must not block a game action.
    }
  };

  const play = (event: SoundEvent) => {
    if (
      disposed ||
      !enabled ||
      !context ||
      !master ||
      context.state !== 'running' ||
      (typeof document !== 'undefined' && document.hidden)
    ) return;

    const now = context.currentTime;
    const gap = event === 'collect' ? 0.06 : event === 'hit' ? 0.2 : 0.08;
    if (now - (lastPlayed.get(event) ?? -Infinity) < gap) return;
    lastPlayed.set(event, now);

    for (const tone of melodies[event]) {
      if (voices.size >= MAX_VOICES) {
        const oldest = voices.values().next().value;
        if (oldest) stopVoice(oldest);
      }
      let voice: Voice | undefined;
      try {
        voice = { oscillator: context.createOscillator(), envelope: context.createGain() };
        const { oscillator, envelope } = voice;
        voices.add(voice);
        const start = now + (tone.offset ?? 0);
        const end = start + tone.duration;
        oscillator.type = tone.wave ?? 'sine';
        oscillator.frequency.setValueAtTime(tone.frequency, start);
        if (tone.endFrequency) {
          oscillator.frequency.exponentialRampToValueAtTime(tone.endFrequency, end);
        }
        envelope.gain.setValueAtTime(0, start);
        envelope.gain.linearRampToValueAtTime(tone.volume ?? 0.085, start + 0.008);
        envelope.gain.exponentialRampToValueAtTime(0.0001, end);
        envelope.gain.setValueAtTime(0, end + 0.008);
        oscillator.connect(envelope);
        envelope.connect(master);
        const scheduledVoice = voice;
        oscillator.onended = () => forgetVoice(scheduledVoice);
        oscillator.start(start);
        oscillator.stop(end + 0.012);
      } catch {
        if (voice) stopVoice(voice);
      }
    }
  };

  const onVisibility = () => {
    if (document.hidden) suspend();
  };
  if (typeof window !== 'undefined') {
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pagehide', suspend);
  }

  return {
    unlock,
    play,
    setEnabled(nextEnabled) {
      enabled = !disposed && nextEnabled;
      if (!enabled) suspend();
    },
    suspend,
    dispose() {
      if (disposed) return;
      disposed = true;
      enabled = false;
      suspend();
      if (typeof window !== 'undefined') {
        document.removeEventListener('visibilitychange', onVisibility);
        window.removeEventListener('pagehide', suspend);
      }
      try {
        master?.disconnect();
        if (context && context.state !== 'closed') void context.close().catch(() => {});
      } catch {
        // A previously closed device needs no further cleanup.
      }
      master = undefined;
      context = undefined;
    },
  };
}
