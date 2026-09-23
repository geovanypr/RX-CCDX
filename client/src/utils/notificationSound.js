let audioCtx = null;

function getAudioContext() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  return audioCtx;
}

function playTone(frequencies, ctx, now) {
  frequencies.forEach(({ freq, start, duration, volume = 0.3 }) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'sine';
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0, now + start);
    gain.gain.linearRampToValueAtTime(volume, now + start + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.001, now + start + duration);
    osc.start(now + start);
    osc.stop(now + start + duration);
  });
}

export function playNotificationSound(type = 'default') {
  try {
    const ctx = getAudioContext();
    if (ctx.state === 'suspended') ctx.resume();
    const now = ctx.currentTime;

    if (type === 'enviado') {
      // Ascending arpeggio — new plate for radiologist
      playTone([
        { freq: 523.25, start: 0,    duration: 0.4 },
        { freq: 659.25, start: 0.15, duration: 0.4 },
        { freq: 783.99, start: 0.30, duration: 0.5 },
      ], ctx, now);
    } else if (type === 'diagnostico') {
      // Two-tone chime — diagnosis received
      playTone([
        { freq: 440,    start: 0,    duration: 0.5, volume: 0.35 },
        { freq: 554.37, start: 0.25, duration: 0.5, volume: 0.35 },
      ], ctx, now);
    } else if (type === 'devuelto') {
      // Descending two notes — returned for revision
      playTone([
        { freq: 600, start: 0,    duration: 0.35 },
        { freq: 450, start: 0.2,  duration: 0.4 },
      ], ctx, now);
    } else if (type === 'mensaje') {
      // Pop suave estilo WhatsApp — nuevo mensaje de chat
      playTone([
        { freq: 1046.5, start: 0,    duration: 0.08, volume: 0.18 },
        { freq: 1318.5, start: 0.07, duration: 0.12, volume: 0.22 },
      ], ctx, now);
    } else if (type === 'archivo') {
      // Single soft ping
      playTone([{ freq: 700, start: 0, duration: 0.3, volume: 0.2 }], ctx, now);
    } else {
      playTone([{ freq: 600, start: 0, duration: 0.3, volume: 0.25 }], ctx, now);
    }
  } catch {
    // Silence autoplay errors
  }
}

export function enableSound() {
  const ctx = getAudioContext();
  if (ctx.state === 'suspended') ctx.resume();
}
