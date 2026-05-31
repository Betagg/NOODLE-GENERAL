type AudioContextClass = typeof AudioContext;
const EATING_SOUND_URL = "/audio/eating.mp3";
const BOILING_SOUND_URL = "/audio/boiling.mp3";

export class SoundBoard {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private eatingBuffer: AudioBuffer | null = null;
  private eatingBufferPromise: Promise<AudioBuffer | null> | null = null;
  private boilingBuffer: AudioBuffer | null = null;
  private boilingBufferPromise: Promise<AudioBuffer | null> | null = null;
  private boilingSource: AudioBufferSourceNode | null = null;
  private boilingGain: GainNode | null = null;
  private homeAmbienceWanted = false;
  private slurpWanted = false;
  private slurpSource: AudioBufferSourceNode | null = null;
  private slurpGain: GainNode | null = null;

  async unlock() {
    const ctx = this.ensure();
    if (ctx.state === "suspended") await ctx.resume();
    this.loadEatingSound();
    this.loadBoilingSound();
  }

  preloadHomeAmbience() {
    this.loadBoilingSound();
  }

  async startHomeAmbience() {
    this.homeAmbienceWanted = true;
    await this.unlock();
    if (!this.homeAmbienceWanted) return;
    if (this.boilingSource) return;
    if (this.boilingBuffer) {
      this.startBoilingLoop();
      return;
    }
    this.loadBoilingSound().then((buffer) => {
      if (buffer && this.homeAmbienceWanted && !this.boilingSource) this.startBoilingLoop();
    });
  }

  stopHomeAmbience() {
    this.homeAmbienceWanted = false;
    if (!this.ctx || !this.boilingSource || !this.boilingGain) return;

    const source = this.boilingSource;
    const gain = this.boilingGain;
    const now = this.ctx.currentTime;
    gain.gain.cancelScheduledValues(now);
    gain.gain.setValueAtTime(Math.max(0.0001, gain.gain.value), now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.16);
    source.stop(now + 0.18);
    this.boilingSource = null;
    this.boilingGain = null;
  }

  blow(crit = false) {
    const ctx = this.ensure();
    const now = ctx.currentTime;
    const duration = crit ? 0.34 : 0.24;

    const noise = createNoise(ctx, duration);
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();
    filter.type = "bandpass";
    filter.frequency.setValueAtTime(crit ? 1320 : 920, now);
    filter.frequency.exponentialRampToValueAtTime(crit ? 360 : 250, now + duration);
    filter.Q.setValueAtTime(0.9, now);

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(crit ? 0.25 : 0.15, now + 0.025);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.master!);
    noise.start(now);
    noise.stop(now + duration);

    if (crit) this.sparkle(now + 0.04, [740, 1110], 0.16, 0.06);
  }

  setSlurping(active: boolean) {
    this.slurpWanted = active;
    if (active) {
      if (this.slurpSource) return;
      if (this.eatingBuffer) {
        this.startEatingLoop();
        return;
      }
      this.loadEatingSound().then((buffer) => {
        if (buffer && this.slurpWanted && !this.slurpSource) this.startEatingLoop();
      });
    } else {
      this.stopEatingLoop();
    }
  }

  private startEatingLoop() {
    const ctx = this.ensure();
    if (!this.eatingBuffer) return;

    const source = ctx.createBufferSource();
    const gain = ctx.createGain();
    const now = ctx.currentTime;

    source.buffer = this.eatingBuffer;
    source.loop = true;
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.62, now + 0.035);
    source.connect(gain);
    gain.connect(this.master!);
    source.onended = () => {
      if (this.slurpSource === source) {
        this.slurpSource = null;
        this.slurpGain = null;
      }
    };
    this.slurpSource = source;
    this.slurpGain = gain;
    source.start(now);
  }

  private stopEatingLoop() {
    if (!this.ctx || !this.slurpSource || !this.slurpGain) return;

    const source = this.slurpSource;
    const gain = this.slurpGain;
    const now = this.ctx.currentTime;
    gain.gain.cancelScheduledValues(now);
    gain.gain.setValueAtTime(Math.max(0.0001, gain.gain.value), now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.08);
    source.stop(now + 0.1);
    this.slurpSource = null;
    this.slurpGain = null;
  }

  private loadEatingSound() {
    const ctx = this.ensure();
    if (this.eatingBuffer) return Promise.resolve(this.eatingBuffer);
    if (this.eatingBufferPromise) return this.eatingBufferPromise;

    this.eatingBufferPromise = fetch(EATING_SOUND_URL)
      .then((res) => {
        if (!res.ok) throw new Error(`Failed to load eating sound: ${res.status}`);
        return res.arrayBuffer();
      })
      .then((data) => ctx.decodeAudioData(data))
      .then((buffer) => {
        this.eatingBuffer = buffer;
        return buffer;
      })
      .catch((err) => {
        console.warn(err);
        this.eatingBufferPromise = null;
        return null;
      });
    return this.eatingBufferPromise;
  }

  private loadBoilingSound() {
    const ctx = this.ensure();
    if (this.boilingBuffer) return Promise.resolve(this.boilingBuffer);
    if (this.boilingBufferPromise) return this.boilingBufferPromise;

    this.boilingBufferPromise = fetch(BOILING_SOUND_URL)
      .then((res) => {
        if (!res.ok) throw new Error(`Failed to load boiling sound: ${res.status}`);
        return res.arrayBuffer();
      })
      .then((data) => ctx.decodeAudioData(data))
      .then((buffer) => {
        this.boilingBuffer = buffer;
        return buffer;
      })
      .catch((err) => {
        console.warn(err);
        this.boilingBufferPromise = null;
        return null;
      });
    return this.boilingBufferPromise;
  }

  private startBoilingLoop() {
    const ctx = this.ensure();
    if (!this.boilingBuffer) return;

    const source = ctx.createBufferSource();
    const gain = ctx.createGain();
    const now = ctx.currentTime;
    source.buffer = this.boilingBuffer;
    source.loop = true;
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.72, now + 0.25);
    source.connect(gain);
    gain.connect(this.master!);
    source.onended = () => {
      if (this.boilingSource === source) {
        this.boilingSource = null;
        this.boilingGain = null;
      }
    };
    this.boilingSource = source;
    this.boilingGain = gain;
    source.start(now);
  }

  victory() {
    const ctx = this.ensure();
    const now = ctx.currentTime;
    this.setSlurping(false);
    const notes = [523.25, 659.25, 783.99, 1046.5, 1318.51];
    notes.forEach((freq, index) => {
      this.tone(now + index * 0.11, freq, 0.18, "square", 0.09);
    });
    this.tone(now + 0.62, 1567.98, 0.42, "triangle", 0.08);
    this.sparkle(now + 0.58, [1046.5, 1318.51, 1567.98, 2093], 0.5, 0.035);
  }

  private ensure() {
    if (this.ctx) return this.ctx;
    const AudioCtor = (window.AudioContext ||
      (window as Window & { webkitAudioContext?: AudioContextClass }).webkitAudioContext)!;
    this.ctx = new AudioCtor();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.34;
    this.master.connect(this.ctx.destination);
    return this.ctx;
  }

  private tone(
    start: number,
    freq: number,
    duration: number,
    type: OscillatorType,
    volume: number,
  ) {
    const ctx = this.ensure();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, start);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(volume, start + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    osc.connect(gain);
    gain.connect(this.master!);
    osc.start(start);
    osc.stop(start + duration + 0.02);
  }

  private sparkle(start: number, freqs: number[], duration: number, volume: number) {
    freqs.forEach((freq, index) => {
      this.tone(start + index * 0.055, freq, duration * 0.35, "triangle", volume);
    });
  }
}

function createNoise(ctx: AudioContext, duration: number) {
  const rate = ctx.sampleRate;
  const buffer = ctx.createBuffer(1, Math.ceil(rate * duration), rate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) {
    data[i] = Math.random() * 2 - 1;
  }
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  return source;
}
