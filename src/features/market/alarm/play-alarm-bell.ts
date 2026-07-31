/** Shared Web Audio bell — unlock on a user gesture so async polls can play. */

let sharedCtx: AudioContext | null = null;
let ringTimer: number | null = null;

function getAudioContextCtor(): typeof AudioContext | null {
  return (
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext ||
    null
  );
}

function getOrCreateContext(): AudioContext | null {
  const AudioCtx = getAudioContextCtor();
  if (!AudioCtx) return null;
  if (!sharedCtx || sharedCtx.state === "closed") {
    sharedCtx = new AudioCtx();
  }
  return sharedCtx;
}

/** Call from Start / Check / Enable notifications — unlocks autoplay for later polls. */
export function unlockAlarmAudio(): void {
  try {
    const ctx = getOrCreateContext();
    if (!ctx) return;
    if (ctx.state === "suspended") {
      void ctx.resume().catch(() => undefined);
    }
  } catch {
    /* ignore */
  }
}

function playToneBurst(ctx: AudioContext): void {
  const now = ctx.currentTime;

  const ding = (freq: number, start: number, dur: number, gain = 0.18) => {
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(freq, start);
    g.gain.setValueAtTime(0.0001, start);
    g.gain.exponentialRampToValueAtTime(gain, start + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    osc.connect(g);
    g.connect(ctx.destination);
    osc.start(start);
    osc.stop(start + dur + 0.05);
  };

  ding(880, now, 0.35, 0.2);
  ding(1174.7, now + 0.18, 0.45, 0.16);
  ding(1318.5, now + 0.38, 0.55, 0.12);
}

/** One bell chime (Entry / Exit signal). */
export function playAlarmBell(): void {
  try {
    const ctx = getOrCreateContext();
    if (!ctx) return;
    const run = () => {
      try {
        playToneBurst(ctx);
      } catch {
        /* ignore */
      }
    };
    if (ctx.state === "suspended") {
      void ctx.resume().then(run).catch(() => undefined);
    } else {
      run();
    }
  } catch {
    /* ignore audio errors */
  }
}

/** Keep chiming until stopAlarmRing (while Entry/Exit popup is open). */
export function startAlarmRing(intervalMs = 2800): void {
  stopAlarmRing();
  playAlarmBell();
  ringTimer = window.setInterval(() => {
    playAlarmBell();
  }, intervalMs);
}

export function stopAlarmRing(): void {
  if (ringTimer != null) {
    window.clearInterval(ringTimer);
    ringTimer = null;
  }
}
