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
  // 0.8 (was 0.85): offsets the limiter's automatic make-up gain (~+0.57 dB), keeping V1 levels.
  master.gain.value = 0.8
  // Final safety limiter (MUSIC_DIRECTION §5): catches peaks from user-edited/mutated content.
  const limiter = ctx.createDynamicsCompressor()
  limiter.threshold.value = -1
  limiter.knee.value = 0
  limiter.ratio.value = 20
  limiter.attack.value = 0.001
  limiter.release.value = 0.05
  compressor.connect(master).connect(limiter).connect(ctx.destination)
  return { input: compressor }
}
