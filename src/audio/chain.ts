// Master output chain, shared by the live engine and (future) offline export.
// Written against BaseAudioContext so it works with AudioContext and OfflineAudioContext.

export interface MasterChain {
  /** Connect voices (or a per-transport bus) here. */
  input: AudioNode
}

export function createMasterChain(ctx: BaseAudioContext): MasterChain {
  const compressor = ctx.createDynamicsCompressor()
  compressor.threshold.value = -16
  compressor.knee.value = 8
  compressor.ratio.value = 4
  compressor.attack.value = 0.003
  compressor.release.value = 0.15
  const master = ctx.createGain()
  master.gain.value = 0.85
  compressor.connect(master).connect(ctx.destination)
  return { input: compressor }
}
