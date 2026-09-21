// Zero-asset sound blips (WebAudio oscillators). Lifted from Antfarm's AmbientAudio.
window.SFX = (() => {
  let ctx = null, enabled = false;
  const blip = (freq, dur, type, gain) => {
    if (!ctx) return;
    const now = ctx.currentTime, o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, now);
    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(gain, now + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, now + dur);
    o.connect(g).connect(ctx.destination); o.start(now); o.stop(now + dur + 0.02);
  };
  const ready = async () => {
    if (!enabled) return false;
    ctx ??= new AudioContext();
    if (ctx.state === "suspended") await ctx.resume().catch(() => {});
    return ctx.state === "running";
  };
  const seq = (...steps) => async () => { if (!(await ready())) return; steps.forEach(([f, d, t, g, at]) => setTimeout(() => blip(f, d, t, g), at)); };
  return {
    setEnabled: (v) => { enabled = !!v; },
    water:   seq([340, 0.055, "triangle", 0.045, 0]),
    plant:   seq([220, 0.12, "sine", 0.025, 0], [170, 0.16, "sine", 0.018, 90]),
    harvest: seq([260, 0.12, "sine", 0.03, 0], [390, 0.15, "sine", 0.025, 130], [520, 0.18, "sine", 0.025, 260]),
    unlock:  seq([520, 0.07, "triangle", 0.03, 0], [780, 0.11, "triangle", 0.025, 90]),
    alert:   seq([150, 0.09, "sawtooth", 0.035, 0], [115, 0.12, "sawtooth", 0.03, 120]),
    tap:     seq([95, 0.035, "square", 0.05, 0], [130, 0.035, "square", 0.035, 65]),
  };
})();
