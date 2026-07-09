type SoundType = 'rain' | 'forest' | 'fire' | 'ocean' | 'wind'

const SOUND_CONFIGS: Record<SoundType, { label: string; icon: string }> = {
  rain: { label: '雨声', icon: 'mdi-weather-pouring' },
  forest: { label: '森林', icon: 'mdi-tree' },
  fire: { label: '篝火', icon: 'mdi-fire' },
  ocean: { label: '海浪', icon: 'mdi-waves' },
  wind: { label: '风声', icon: 'mdi-weather-windy' },
}

export { SOUND_CONFIGS }
export type { SoundType }

export function useAmbientSound() {
  let audioCtx: AudioContext | null = null
  let gainNode: GainNode | null = null
  let sources: AudioNode[] = []
  let currentType: SoundType | null = null

  function ensureContext() {
    if (!audioCtx) {
      audioCtx = new AudioContext()
      gainNode = audioCtx.createGain()
      gainNode.gain.value = 0.3
      gainNode.connect(audioCtx.destination)
    }
    if (audioCtx.state === 'suspended') audioCtx.resume()
    return { audioCtx, gainNode }
  }

  function stopAll() {
    for (const s of sources) {
      try { s.disconnect() } catch {}
    }
    sources = []
    currentType = null
  }

  function createNoiseBuffer(ctx: AudioContext, duration: number, type: 'white' | 'brown' | 'pink'): AudioBuffer {
    const sampleRate = ctx.sampleRate
    const len = sampleRate * duration
    const buffer = ctx.createBuffer(1, len, sampleRate)
    const data = buffer.getChannelData(0)
    let lastOut = 0
    for (let i = 0; i < len; i++) {
      const white = Math.random() * 2 - 1
      if (type === 'white') {
        data[i] = white * 0.5
      } else if (type === 'brown') {
        lastOut = (lastOut + (0.02 * white)) / 1.02
        data[i] = lastOut * 3.5
      } else {
        lastOut = lastOut + (0.02 * white) - (0.02 * lastOut)
        data[i] = lastOut * 0.5
      }
    }
    return buffer
  }

  function startRain(ctx: AudioContext, gain: GainNode) {
    const noise = createNoiseBuffer(ctx, 4, 'pink')
    const source = ctx.createBufferSource()
    source.buffer = noise
    source.loop = true

    const bandpass = ctx.createBiquadFilter()
    bandpass.type = 'bandpass'
    bandpass.frequency.value = 1500
    bandpass.Q.value = 0.8

    const lfMod = ctx.createOscillator()
    lfMod.frequency.value = 0.3
    const gainMod = ctx.createGain()
    gainMod.gain.value = 300
    lfMod.connect(gainMod)
    gainMod.connect(bandpass.frequency)

    source.connect(bandpass)
    bandpass.connect(gain)
    lfMod.start()
    source.start()
    return [source, lfMod]
  }

  function startForest(ctx: AudioContext, gain: GainNode) {
    const noise = createNoiseBuffer(ctx, 4, 'pink')
    const source = ctx.createBufferSource()
    source.buffer = noise
    source.loop = true

    const highpass = ctx.createBiquadFilter()
    highpass.type = 'highpass'
    highpass.frequency.value = 800

    const reverb = ctx.createConvolver()
    const irLen = ctx.sampleRate * 0.3
    const ir = ctx.createBuffer(1, irLen, ctx.sampleRate)
    const irData = ir.getChannelData(0)
    for (let i = 0; i < irLen; i++) irData[i] = Math.exp(-i / irLen) * (Math.random() * 2 - 1) * 0.5
    reverb.buffer = ir

    source.connect(highpass)
    highpass.connect(reverb)
    reverb.connect(gain)
    source.start()
    return [source]
  }

  function startFire(ctx: AudioContext, gain: GainNode) {
    const noise1 = createNoiseBuffer(ctx, 2, 'white')
    const source1 = ctx.createBufferSource()
    source1.buffer = noise1
    source1.loop = true

    const bandpass1 = ctx.createBiquadFilter()
    bandpass1.type = 'bandpass'
    bandpass1.frequency.value = 400
    bandpass1.Q.value = 2

    const lfMod = ctx.createOscillator()
    lfMod.frequency.value = 3
    const gainMod = ctx.createGain()
    gainMod.gain.value = 200
    lfMod.connect(gainMod)
    gainMod.connect(bandpass1.frequency)

    source1.connect(bandpass1)
    bandpass1.connect(gain)
    lfMod.start()
    source1.start()
    return [source1, lfMod]
  }

  function startOcean(ctx: AudioContext, gain: GainNode) {
    const noise = createNoiseBuffer(ctx, 8, 'brown')
    const source = ctx.createBufferSource()
    source.buffer = noise
    source.loop = true

    const lowpass = ctx.createBiquadFilter()
    lowpass.type = 'lowpass'
    lowpass.frequency.value = 400
    lowpass.Q.value = 1

    const lfMod = ctx.createOscillator()
    lfMod.frequency.value = 0.08
    const gainMod = ctx.createGain()
    gainMod.gain.value = 200
    lfMod.connect(gainMod)
    gainMod.connect(lowpass.frequency)

    source.connect(lowpass)
    lowpass.connect(gain)
    lfMod.start()
    source.start()
    return [source, lfMod]
  }

  function startWind(ctx: AudioContext, gain: GainNode) {
    const noise = createNoiseBuffer(ctx, 4, 'white')
    const source = ctx.createBufferSource()
    source.buffer = noise
    source.loop = true

    const highpass = ctx.createBiquadFilter()
    highpass.type = 'highpass'
    highpass.frequency.value = 2000

    const lfMod = ctx.createOscillator()
    lfMod.frequency.value = 0.1
    const gainMod = ctx.createGain()
    gainMod.gain.value = 1500
    lfMod.connect(gainMod)
    gainMod.connect(highpass.frequency)

    source.connect(highpass)
    highpass.connect(gain)
    lfMod.start()
    source.start()
    return [source, lfMod]
  }

  function play(type: SoundType) {
    stopAll()
    const { audioCtx: ctx, gainNode: gn } = ensureContext()
    currentType = type
    switch (type) {
      case 'rain': sources = startRain(ctx, gn!); break
      case 'forest': sources = startForest(ctx, gn!); break
      case 'fire': sources = startFire(ctx, gn!); break
      case 'ocean': sources = startOcean(ctx, gn!); break
      case 'wind': sources = startWind(ctx, gn!); break
    }
  }

  function stop() {
    stopAll()
    if (audioCtx) {
      audioCtx.close()
      audioCtx = null
      gainNode = null
    }
  }

  function setVolume(v: number) {
    if (gainNode) gainNode.gain.value = Math.max(0, Math.min(1, v))
  }

  function isPlaying(type?: SoundType): boolean {
    if (type) return currentType === type
    return currentType !== null
  }

  return { play, stop, setVolume, isPlaying }
}
