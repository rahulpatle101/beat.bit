// React shell for the Signal City canvas: sizing and subscriptions. Drawing happens in the
// sequencer's single render loop via onFrame.
// The canvas is decorative (aria-hidden); the live region and grid carry the information.

import { useEffect, useRef, useState } from 'react'
import { CityScene as Scene, H, W, readPalette } from '@/scene/city'
import type { FrameListener, StepListener, TransportListener } from '@/hooks/useSequencer'

interface Props {
  playing: boolean
  onStep: (fn: StepListener) => () => void
  onTransport: (fn: TransportListener) => () => void
  onFrame: (fn: FrameListener) => () => void
}

export function CityScene({ playing, onStep, onTransport, onFrame }: Props) {
  const boxRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const sceneRef = useRef<Scene | null>(null)
  const [cssWidth, setCssWidth] = useState<number | null>(null)

  // Integer scaling in *device* pixels: crisp on 1× and 2× screens alike (DESIGN.md §4.4).
  useEffect(() => {
    const box = boxRef.current
    if (!box) return
    const fit = () => {
      const dpr = window.devicePixelRatio || 1
      const available = box.clientWidth
      const scale = Math.max(1, Math.floor((available * dpr) / W))
      setCssWidth((W * scale) / dpr)
    }
    fit()
    const ro = new ResizeObserver(fit)
    ro.observe(box)
    return () => ro.disconnect()
  }, [])

  // Scene, subscriptions, and the draw loop.
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const scene = new Scene(canvas, readPalette())
    sceneRef.current = scene

    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const syncMotion = () => (scene.reducedMotion = mq.matches)
    syncMotion()
    mq.addEventListener('change', syncMotion)

    const offStep = onStep((ev, frameTime) => {
      scene.step(ev.step, ev.tracks, ev.duration * 1000, frameTime)
    })
    // Transport → scene moments (switch-on / power-down), applied in the frame timebase.
    const offTransport = onTransport((on) => scene.cue(on ? 'start' : 'stop'))

    // Draw from the sequencer's single render loop (no second rAF).
    const offFrame = onFrame((now) => scene.draw(now))

    return () => {
      offFrame()
      offStep()
      offTransport()
      mq.removeEventListener('change', syncMotion)
      sceneRef.current = null
    }
  }, [onStep, onTransport, onFrame])

  return (
    <div ref={boxRef} className="flex w-full justify-center bg-void" aria-hidden="true">
      <div className="relative">
        <canvas
          ref={canvasRef}
          width={W}
          height={H}
          className="pixelated block"
          style={
            cssWidth
              ? { width: cssWidth, height: (cssWidth * H) / W }
              : { width: '100%', aspectRatio: `${W} / ${H}` }
          }
        />
        {/* Hidden on narrow canvases, where it would collide with the tower sign;
            the Play button sits directly below on those layouts. */}
        {!playing && (cssWidth ?? 0) >= 400 && (
          <span className="retro pointer-events-none absolute top-[9%] left-[3%] text-[10px] whitespace-nowrap text-ink-dim">
            PRESS PLAY
          </span>
        )}
      </div>
    </div>
  )
}
