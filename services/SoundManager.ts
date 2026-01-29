
class SoundManager {
  private ctx: AudioContext | null = null;
  private engineOsc: OscillatorNode | null = null;
  private engineGain: GainNode | null = null;
  private masterGain: GainNode | null = null;
  private bgOscs: OscillatorNode[] = [];
  private isMuted: boolean = false;
  private musicInterval: number | null = null;

  init() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      this.masterGain = this.ctx.createGain();
      this.masterGain.connect(this.ctx.destination);
      this.masterGain.gain.setValueAtTime(this.isMuted ? 0 : 1, this.ctx.currentTime);
    } else if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  setMute(mute: boolean) {
    this.isMuted = mute;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(mute ? 0 : 1, this.ctx.currentTime, 0.05);
    }
  }

  private createNoiseBuffer() {
    if (!this.ctx) return null;
    const bufferSize = this.ctx.sampleRate * 2;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const output = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      output[i] = Math.random() * 2 - 1;
    }
    return buffer;
  }

  playFire() {
    if (!this.ctx || !this.masterGain) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(400, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(100, this.ctx.currentTime + 0.1);
    gain.gain.setValueAtTime(0.1, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.1);
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.1);
  }

  playExplosion(big = false) {
    if (!this.ctx || !this.masterGain) return;
    const buffer = this.createNoiseBuffer();
    if (!buffer) return;
    const source = this.ctx.createBufferSource();
    source.buffer = buffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(big ? 200 : 500, this.ctx.currentTime);
    filter.frequency.exponentialRampToValueAtTime(40, this.ctx.currentTime + (big ? 0.5 : 0.2));
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(big ? 0.4 : 0.15, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + (big ? 0.5 : 0.2));
    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);
    source.start();
    source.stop(this.ctx.currentTime + (big ? 0.5 : 0.2));
  }

  playPowerup() {
    if (!this.ctx || !this.masterGain) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    const now = this.ctx.currentTime;
    osc.frequency.setValueAtTime(440, now);
    osc.frequency.linearRampToValueAtTime(880, now + 0.1);
    osc.frequency.linearRampToValueAtTime(1320, now + 0.2);
    gain.gain.setValueAtTime(0.1, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start();
    osc.stop(now + 0.3);
  }

  playSteelHit() {
    if (!this.ctx || !this.masterGain) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(1200, this.ctx.currentTime);
    gain.gain.setValueAtTime(0.05, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.05);
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.05);
  }

  playVictory() {
    if (!this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;
    const pattern = [
      { f: 523.25, d: 0.15 }, { f: 659.25, d: 0.15 }, { f: 783.99, d: 0.15 },
      { f: 523.25, d: 0.15 }, { f: 783.99, d: 0.15 }, { f: 1046.50, d: 0.5 }
    ];
    pattern.forEach((note, i) => {
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(note.f, now + i * 0.15);
      gain.gain.setValueAtTime(0.1, now + i * 0.15);
      gain.gain.exponentialRampToValueAtTime(0.01, now + i * 0.15 + note.d);
      osc.connect(gain);
      gain.connect(this.masterGain!);
      osc.start(now + i * 0.15);
      osc.stop(now + i * 0.15 + note.d);
    });
  }

  playGameOver() {
    if (!this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;
    const pattern = [392.00, 349.23, 329.63, 261.63];
    pattern.forEach((freq, i) => {
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(freq, now + i * 0.2);
      gain.gain.setValueAtTime(0.1, now + i * 0.2);
      gain.gain.exponentialRampToValueAtTime(0.01, now + i * 0.2 + 0.3);
      osc.connect(gain);
      gain.connect(this.masterGain!);
      osc.start(now + i * 0.2);
      osc.stop(now + i * 0.2 + 0.3);
    });
  }

  setEngine(active: boolean) {
    if (!this.ctx || !this.masterGain) return;
    if (active) {
      if (this.engineOsc) return;
      this.engineOsc = this.ctx.createOscillator();
      this.engineGain = this.ctx.createGain();
      this.engineOsc.type = 'sawtooth';
      this.engineOsc.frequency.setValueAtTime(40, this.ctx.currentTime);
      this.engineGain.gain.setValueAtTime(0.02, this.ctx.currentTime);
      this.engineOsc.connect(this.engineGain);
      this.engineGain.connect(this.masterGain);
      this.engineOsc.start();
    } else {
      if (this.engineOsc) {
        this.engineOsc.stop();
        this.engineOsc = null;
        this.engineGain = null;
      }
    }
  }

  startMenuMusic() {
    if (!this.ctx || !this.masterGain || this.musicInterval) return;
    this.init();
    
    const bassline = [130.81, 98.00, 110.00, 87.31]; // C3, G2, A2, F2
    const melody = [261.63, 329.63, 392.00, 523.25, 392.00, 329.63]; // C4, E4, G4, C5, G4, E4
    
    const beat = 0.4;
    let step = 0;

    const playLoop = () => {
      if (!this.musicInterval) return;
      
      const now = this.ctx!.currentTime;
      
      // Bass
      const bFreq = bassline[step % bassline.length];
      const bOsc = this.ctx!.createOscillator();
      const bGain = this.ctx!.createGain();
      bOsc.type = 'triangle';
      bOsc.frequency.setValueAtTime(bFreq, now);
      bGain.gain.setValueAtTime(0.05, now);
      bGain.gain.exponentialRampToValueAtTime(0.001, now + beat * 0.9);
      bOsc.connect(bGain);
      bGain.connect(this.masterGain!);
      bOsc.start(now);
      bOsc.stop(now + beat);

      // Simple Melody every 2 beats
      if (step % 2 === 0) {
        const mFreq = melody[(step / 2) % melody.length];
        const mOsc = this.ctx!.createOscillator();
        const mGain = this.ctx!.createGain();
        mOsc.type = 'square';
        mOsc.frequency.setValueAtTime(mFreq, now);
        mGain.gain.setValueAtTime(0.02, now);
        mGain.gain.exponentialRampToValueAtTime(0.001, now + beat * 0.5);
        mOsc.connect(mGain);
        mGain.connect(this.masterGain!);
        mOsc.start(now);
        mOsc.stop(now + beat * 0.5);
      }

      step++;
    };

    this.musicInterval = window.setInterval(playLoop, beat * 1000);
    playLoop();
  }

  stopMenuMusic() {
    if (this.musicInterval) {
      clearInterval(this.musicInterval);
      this.musicInterval = null;
    }
  }

  playStartMelody() {
    if (!this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;
    const notes = [261.63, 329.63, 392.00, 523.25];
    notes.forEach((freq, i) => {
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(freq, now + i * 0.15);
      gain.gain.setValueAtTime(0.08, now + i * 0.15);
      gain.gain.exponentialRampToValueAtTime(0.01, now + i * 0.15 + 0.1);
      osc.connect(gain);
      gain.connect(this.masterGain!);
      osc.start(now + i * 0.15);
      osc.stop(now + i * 0.15 + 0.1);
    });
  }
}

export const sounds = new SoundManager();
