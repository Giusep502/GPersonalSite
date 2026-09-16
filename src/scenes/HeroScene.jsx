import { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Center, Environment, PerspectiveCamera, useGLTF, useTexture } from '@react-three/drei'
import { Box3, RepeatWrapping, SRGBColorSpace, Vector3 } from 'three'
import TonearmDevPanel from '../components/TonearmDevPanel'

const TONEARM_DEFAULT_POSITION = [0.125, -0.09, 1.475];
const TONEARM_DEFAULT_ROTATION = [0, 0.18, 0];
const TONEARM_FINAL_POSITION = [0.125, -0.09, 0.48]
const TONEARM_FINAL_ROTATION = [-0.028, -0.56, 0]
// While the record is playing, the tonearm keeps creeping inward across the
// groove for the length of the song, like a real stylus tracking toward the
// label. Z position and Y rotation drift from their TONEARM_FINAL_* values
// down to these over the whole track.
const TONEARM_TRACKING_FINAL_Z = 0.36
const TONEARM_TRACKING_FINAL_ROTATION_Y = -0.76
// Fallback song length for the drift above, used only until the audio
// element reports its real duration (it should land very close to this).
const TONEARM_TRACKING_DURATION_SECONDS = 6 * 60
const VINYL_SPIN_SPEED = 3.49 // rad/s, ~33 1/3 RPM
const VINYL_SPIN_RAMP_MS = 1500
const AUDIO_LOOP_TAIL_SECONDS = 10
// How many pixels of wheel deltaY it takes to move the tonearm's target all
// the way through its trajectory while scroll is driving it.
const SCROLL_DRIVE_DISTANCE = 640
// How fast the displayed progress chases its target each second (higher =
// snappier catch-up). Scrolling further ahead widens the gap, so scrolling
// harder makes the tonearm visibly move faster, not just jump.
const PROGRESS_SMOOTHING_RATE = 3
const PROGRESS_SNAP_EPSILON = 0.0008
// The easing has a long asymptotic tail, so waiting for `progress` to reach
// exactly 0/1 before treating the tonearm as "arrived" adds a couple of
// seconds of perceived lag. Treat it as arrived once it's this close instead
// (the pose itself keeps easing the rest of the way in, imperceptibly).
const TONEARM_SETTLED_THRESHOLD = 0.05
// Pixels of pointer movement to drag the tonearm across its full trajectory.
const DRAG_DRIVE_DISTANCE = 260
// A press+release with less movement than this still counts as a plain
// click (toggle fully engaged/disengaged) rather than a drag.
const DRAG_CLICK_THRESHOLD_PX = 6
// Once dragged within this fraction of the final position, let go of 1:1
// tracking and ease the rest of the way in on its own, like a magnet catch.
const DRAG_MAGNET_ZONE = 0.12
// Extra world-space margin added to the tonearm's invisible hit box on every
// axis, so it's forgiving to grab without expanding it so much it starts
// overlapping the vinyl/base's own click target. Touch fingers are much less
// precise than a mouse cursor, so coarse pointers get a noticeably bigger one.
const TONEARM_HIT_PADDING = 0.12
const TONEARM_HIT_PADDING_COARSE = 0.4

const BASE_POSITION = [0.37, 1.7, -0.19]
const BASE_ROTATION = [-0.83, -0.93, -0.85]
const VINYL_POSITION = [-0.03, 0, 0.13]
const VINYL_ROTATION = [0, 0, 0]
const VINYL_TEXTURE_OFFSET = [0, 0]
const VINYL_TEXTURE_REPEAT = [0, 15]
const VINYL_TEXTURE_ROTATION = 0
const CAMERA_POSITION = [-4.77, 3.73, 9]
const CAMERA_ZOOM = 1
// Very small camera drift applied as the tonearm travels, just to add a
// touch of life to the shot — not meant to read as a deliberate camera move.
const CAMERA_TONEARM_OFFSET = [-0.12, 0.05, 0.1]
// Below this width/height ratio (portrait-ish viewports, e.g. phones) the
// fixed framing starts cropping the turntable, so zoom out proportionally to
// how much narrower the viewport is than it is tall.
const RESPONSIVE_ZOOM_MIN = 0.75

function responsiveZoom(baseZoom, width, height) {
  if (!width || !height) return baseZoom
  const aspect = width / height
  if (aspect >= 1) return baseZoom
  return Math.max(RESPONSIVE_ZOOM_MIN, baseZoom * aspect)
}

function easeInOutCubic(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
}

function lerpVec3(from, to, t) {
  return [from[0] + (to[0] - from[0]) * t, from[1] + (to[1] - from[1]) * t, from[2] + (to[2] - from[2]) * t]
}

function clamp01(value) {
  return Math.min(1, Math.max(0, value))
}

// Browsers only allow audio to autoplay following a "real" activating
// gesture (click/key/touch) — a wheel/scroll event doesn't count, so a
// play() triggered purely by scrolling can be silently blocked. If that
// happens, retry on the next qualifying gesture instead of staying silent.
function playWithGestureFallback(audio) {
  if (!audio) return
  const result = audio.play()
  if (!result?.catch) return
  result.catch(() => {
    const retry = () => {
      audio.play().catch(() => { })
    }
    window.addEventListener('pointerdown', retry, { once: true })
    window.addEventListener('keydown', retry, { once: true })
  })
}

// True on touch-first devices (finger, not mouse/trackpad) — used to widen
// the tonearm's hit target where precision is worse.
function useCoarsePointer() {
  const [coarse, setCoarse] = useState(() => window.matchMedia?.('(pointer: coarse)').matches ?? false)

  useEffect(() => {
    const query = window.matchMedia?.('(pointer: coarse)')
    if (!query) return undefined
    const handleChange = (event) => setCoarse(event.matches)
    query.addEventListener('change', handleChange)
    return () => query.removeEventListener('change', handleChange)
  }, [])

  return coarse
}

function Turntable({
  basePosition,
  baseRotation,
  vinylPosition,
  vinylRotation,
  vinylTextureOffset,
  vinylTextureRepeat,
  vinylTextureRotation,
  tonearmPosition,
  tonearmRotation,
  vinylSpinning,
  onTonearmPointerDown,
  onTurntablePointerDown,
  ...props
}) {
  const base = useGLTF('/turntable3.glb')
  const vinyl = useGLTF('/Vinyl.glb')
  const tonearm = useGLTF('/tonearm.glb')
  const vinylTextureRef = useRef(null)
  const vinylSpinRef = useRef(null)
  const vinylSpeedRef = useRef(0)
  const vinylRampRef = useRef({ from: 0, to: 0, startTime: 0 })

  // The disc's own origin (from the .glb) isn't at its visual center, so
  // spinning it directly would make it orbit instead of spin in place.
  // Recenter around this pivot, then cancel the offset on both sides of the
  // rotation so `vinylPosition`/`vinylRotation` keep placing it exactly
  // where they did before.
  const vinylCenter = useMemo(() => {
    const box = new Box3().setFromObject(vinyl.scene)
    return box.getCenter(new Vector3())
  }, [vinyl.scene])

  // The tonearm's own geometry is thin, which makes it an easy target to miss
  // on touch. Raycast against a padded invisible box around it instead, so
  // the actually-draggable area is a bit larger than what's visible.
  const isCoarsePointer = useCoarsePointer()
  const tonearmHitArea = useMemo(() => {
    const box = new Box3().setFromObject(tonearm.scene)
    const size = box.getSize(new Vector3())
    const center = box.getCenter(new Vector3())
    const padding = isCoarsePointer ? TONEARM_HIT_PADDING_COARSE : TONEARM_HIT_PADDING
    return { center: [center.x, center.y, center.z], size: [size.x + padding, size.y + padding, size.z + padding] }
  }, [tonearm.scene, isCoarsePointer])

  // Ramp the spin speed toward its target (rather than snapping) so starting
  // and stopping ease in/out instead of jumping straight to/from full speed.
  useEffect(() => {
    vinylRampRef.current = {
      from: vinylSpeedRef.current,
      to: vinylSpinning ? VINYL_SPIN_SPEED : 0,
      startTime: performance.now(),
    }
  }, [vinylSpinning])

  useFrame((_, delta) => {
    const { from, to, startTime } = vinylRampRef.current
    const t = Math.min((performance.now() - startTime) / VINYL_SPIN_RAMP_MS, 1)
    const speed = from + (to - from) * easeInOutCubic(t)
    vinylSpeedRef.current = speed
    if (vinylSpinRef.current) vinylSpinRef.current.rotation.y += speed * delta
  })
  const vinylTexture = useTexture('/textures/vinyl2.png', (texture) => {
    texture.colorSpace = SRGBColorSpace
    texture.flipY = false
    texture.wrapS = RepeatWrapping
    texture.wrapT = RepeatWrapping
    texture.center.set(0.5, 0.5)
    vinylTextureRef.current = texture
  })

  // Which part of the image shows up, and how it's scaled/rotated on the
  // disc's UVs. Mutated through a ref (not `vinylTexture` directly) since
  // this project's lint forbids mutating values returned straight from a
  // hook call.
  useEffect(() => {
    const texture = vinylTextureRef.current
    if (!texture) return
    texture.offset.set(vinylTextureOffset[0], vinylTextureOffset[1])
    texture.repeat.set(vinylTextureRepeat[0], vinylTextureRepeat[1])
    texture.rotation = vinylTextureRotation
    texture.needsUpdate = true
  }, [vinylTextureOffset, vinylTextureRepeat, vinylTextureRotation])

  // The "velvet" material has no base color/texture in the source file, so it
  // renders flat white. Reuse the plastic material's base color texture
  // (already loaded as part of this same .glb) instead of adding a new image.
  useMemo(() => {
    const plasticMap = base.materials['plastic 3']?.map
    if (!plasticMap) return
    base.scene.traverse((child) => {
      if (child.isMesh && child.material.name === 'velvet') {
        child.material = child.material.clone()
        child.material.map = plasticMap
        child.material.needsUpdate = true
        child.material.metalness = 1
      }
    })
  }, [base.scene, base.materials])

  // "vinyl"/"track mat"/"line in"/"line out" have no color data in the source
  // file either, so glTF's default (white, fully metallic, fully rough)
  // kicks in. Apply the paper texture as their base color map instead.
  // "label" already has a real texture, so it's left untouched.
  useMemo(() => {
    vinyl.scene.traverse((child) => {
      if (!child.isMesh) return
      if (child.material.name === 'label') return
      child.material = child.material.clone()
      child.material.map = vinylTexture
      child.material.metalness = 0
      child.material.roughness = 1
      child.material.needsUpdate = true
    })
  }, [vinyl.scene, vinylTexture])

  return (
    <Center {...props}>
      <group
        onPointerDown={onTurntablePointerDown}
        onPointerOver={() => (document.body.style.cursor = 'pointer')}
        onPointerOut={() => (document.body.style.cursor = 'auto')}
      >
        <group position={basePosition} rotation={baseRotation}>
          {/* Center re-centers the base's own bounding box to its local origin
              first, so rotating this group spins it around its visual center
              instead of the .glb's off-center pivot. */}
          <Center>
            <primitive object={base.scene} />
          </Center>
        </group>
        <group position={vinylPosition} rotation={vinylRotation}>
          <group position={vinylCenter}>
            <group ref={vinylSpinRef}>
              <primitive
                object={vinyl.scene}
                position={[-vinylCenter.x, -vinylCenter.y, -vinylCenter.z]}
              />
            </group>
          </group>
        </group>
      </group>
      <group position={tonearmPosition} rotation={tonearmRotation}>
        <primitive object={tonearm.scene} />
        <mesh
          position={tonearmHitArea.center}
          visible={false}
          onPointerDown={onTonearmPointerDown}
          onPointerOver={() => (document.body.style.cursor = 'grab')}
          onPointerOut={() => (document.body.style.cursor = 'auto')}
        >
          <boxGeometry args={tonearmHitArea.size} />
        </mesh>
      </group>
    </Center>
  )
}

useGLTF.preload('/turntable3.glb')
useGLTF.preload('/Vinyl.glb')
useGLTF.preload('/tonearm.glb')

// Applies the fixed camera position/zoom to the actual three.js camera, plus
// a very small drift tied to the tonearm's progress so the shot doesn't feel
// perfectly static while it plays.
function CameraRig({ position, zoom, progress }) {
  const cameraRef = useRef(null)
  const { width, height } = useThree((state) => state.size)
  const effectiveZoom = useMemo(() => responsiveZoom(zoom, width, height), [zoom, width, height])

  useEffect(() => {
    const camera = cameraRef.current
    if (!camera) return
    camera.zoom = effectiveZoom
    camera.updateProjectionMatrix()
  }, [effectiveZoom])

  useFrame(() => {
    const camera = cameraRef.current
    if (!camera) return
    const eased = easeInOutCubic(progress)
    const drifted = [
      position[0] + CAMERA_TONEARM_OFFSET[0] * eased,
      position[1] + CAMERA_TONEARM_OFFSET[1] * eased,
      position[2] + CAMERA_TONEARM_OFFSET[2] * eased,
    ]
    camera.position.set(...drifted)
    camera.lookAt(0, 0, 0)
  })

  return <PerspectiveCamera ref={cameraRef} makeDefault fov={50} />
}

function HeroScene({ onPlayingChange }) {
  // 0 = tonearm resting, 1 = tonearm down on the record. `progress` is what's
  // actually displayed each frame; it continuously eases toward `progressTarget`
  // (set instantly by clicks or wheel input) instead of snapping to it, so
  // motion stays smooth regardless of how choppy the input is.
  const [progress, setProgress] = useState(0)
  // Scroll drives the tonearm until it reaches the final position or the
  // user clicks the turntable; after that, scrolling behaves normally and
  // clicking toggles play/stop instead.
  const [scrollControlEnabled, setScrollControlEnabled] = useState(true)
  const progressRef = useRef(0)
  const progressTargetRef = useRef(0)
  const audioRef = useRef(null)
  const armupAudioRef = useRef(null)
  const wasTonearmAtFinalRef = useRef(false)
  const timeoutRef = useRef(null)

  const tonearmEngaged = progress > 0
  const tonearmAtFinal = progress >= 1 - TONEARM_SETTLED_THRESHOLD
  // 0 at the start of the track, 1 once it's played all the way through;
  // drives the slow tracking drift below. Updated from the audio element's
  // own `timeupdate` events rather than a timer, so it stays in sync even if
  // playback stalls/buffers.
  const [trackingProgress, setTrackingProgress] = useState(0)
  // Ignore any stale/in-flight tracking progress once the tonearm has lifted
  // back off — avoids needing a separate effect just to reset it to 0.
  const effectiveTrackingProgress = tonearmAtFinal ? trackingProgress : 0

  const trackedTonearmFinalPosition = useMemo(
    () => [
      TONEARM_FINAL_POSITION[0],
      TONEARM_FINAL_POSITION[1],
      TONEARM_FINAL_POSITION[2] + (TONEARM_TRACKING_FINAL_Z - TONEARM_FINAL_POSITION[2]) * effectiveTrackingProgress,
    ],
    [effectiveTrackingProgress]
  )
  const trackedTonearmFinalRotation = useMemo(
    () => [
      TONEARM_FINAL_ROTATION[0],
      TONEARM_FINAL_ROTATION[1] + (TONEARM_TRACKING_FINAL_ROTATION_Y - TONEARM_FINAL_ROTATION[1]) * effectiveTrackingProgress,
      TONEARM_FINAL_ROTATION[2],
    ],
    [effectiveTrackingProgress]
  )

  const animatedTonearmPosition = useMemo(
    () => lerpVec3(TONEARM_DEFAULT_POSITION, trackedTonearmFinalPosition, easeInOutCubic(progress)),
    [progress, trackedTonearmFinalPosition]
  )
  const animatedTonearmRotation = useMemo(
    () => lerpVec3(TONEARM_DEFAULT_ROTATION, trackedTonearmFinalRotation, easeInOutCubic(progress)),
    [progress, trackedTonearmFinalRotation]
  )

  // Dev-only: lets the tonearm's pose be dragged around live in the browser
  // instead of guessing TONEARM_DEFAULT_*/TONEARM_FINAL_* values via
  // edit/save/reload. Stripped out of production builds by import.meta.env.DEV.
  const [devOverrideEnabled, setDevOverrideEnabled] = useState(false)
  const [devTonearmPosition, setDevTonearmPosition] = useState(TONEARM_DEFAULT_POSITION)
  const [devTonearmRotation, setDevTonearmRotation] = useState(TONEARM_DEFAULT_ROTATION)

  const tonearmPosition = devOverrideEnabled ? devTonearmPosition : animatedTonearmPosition
  const tonearmRotation = devOverrideEnabled ? devTonearmRotation : animatedTonearmRotation

  // Continuously eases the displayed progress toward whatever clicks/wheel
  // input last set as the target, instead of jumping straight to it.
  useEffect(() => {
    let rafId
    let lastTimestamp = null

    const tick = (now) => {
      if (lastTimestamp === null) lastTimestamp = now
      const dt = Math.min((now - lastTimestamp) / 1000, 0.1)
      lastTimestamp = now
      const target = progressTargetRef.current
      const current = progressRef.current
      if (Math.abs(target - current) > PROGRESS_SNAP_EPSILON) {
        const next = current + (target - current) * Math.min(1, dt * PROGRESS_SMOOTHING_RATE)
        progressRef.current = next
        setProgress(next)
      } else if (current !== target) {
        progressRef.current = target
        setProgress(target)
      }
      rafId = requestAnimationFrame(tick)
    }

    rafId = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafId)
  }, [])

  // Clicking anywhere else on the turntable (base/vinyl, not the tonearm
  // itself) just toggles fully engaged/disengaged — no drag tracking, since
  // there's nothing there for the pointer to visually drag.
  const handleTurntablePointerDown = (event) => {
    event.stopPropagation()
    if (scrollControlEnabled) setScrollControlEnabled(false)
    progressTargetRef.current = progressTargetRef.current < 1 ? 1 : 0
  }

  // Pressing the tonearm hands control back to normal page scrolling, same
  // as the old click did. A press+release with barely any movement still
  // toggles fully engaged/disengaged; an actual drag (leftward = toward the
  // record) moves the tonearm 1:1 with the pointer along its trajectory (it
  // can't leave it — there's only ever a `progress` value to drag), until it
  // gets close to the final position, at which point it lets go and eases in
  // the rest of the way on its own, like a magnet catching it.
  const handleTonearmPointerDown = (event) => {
    event.stopPropagation()
    // Without this, touch input on the tonearm gets interpreted as a page
    // scroll gesture before pointermove ever fires, since the canvas has no
    // touch-action restricting that. Calling preventDefault on the pointerdown
    // itself is what suppresses the browser's default touch scrolling here.
    event.nativeEvent.preventDefault()
    if (scrollControlEnabled) setScrollControlEnabled(false)
    document.body.style.cursor = 'grabbing'

    const startX = event.clientX
    const startProgress = progressRef.current
    let dragged = false

    const handlePointerMove = (moveEvent) => {
      const deltaX = startX - moveEvent.clientX
      if (Math.abs(deltaX) > DRAG_CLICK_THRESHOLD_PX) dragged = true
      const raw = clamp01(startProgress + deltaX / DRAG_DRIVE_DISTANCE)
      if (raw >= 1 - DRAG_MAGNET_ZONE) {
        progressTargetRef.current = 1
      } else {
        progressRef.current = raw
        progressTargetRef.current = raw
        setProgress(raw)
      }
    }

    const handlePointerUp = () => {
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', handlePointerUp)
      document.body.style.cursor = 'pointer'
      if (!dragged) {
        progressTargetRef.current = progressTargetRef.current < 1 ? 1 : 0
      }
    }

    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', handlePointerUp)
  }

  // While scroll is driving the tonearm, wheel input moves its target along
  // the trajectory instead of scrolling the page; the smoothing loop above
  // handles actually animating toward it. Once the target reaches the final
  // position, scroll control is handed back to the page.
  useEffect(() => {
    if (!scrollControlEnabled) return undefined

    const handleWheel = (event) => {
      const target = progressTargetRef.current
      if(scrollControlEnabled) event.preventDefault()
      if (target >= 1 && event.deltaY > 0) return
      if (target <= 0 && event.deltaY < 0) return
      const next = clamp01(target + event.deltaY / SCROLL_DRIVE_DISTANCE)
      progressTargetRef.current = next
      if (next >= 1 && !timeoutRef.current) timeoutRef.current = setTimeout(() => setScrollControlEnabled(false), 1000)
    }

    window.addEventListener('wheel', handleWheel, { passive: false })
    return () => {
      window.removeEventListener('wheel', handleWheel)
      clearTimeout(timeoutRef.current)
    }
  }, [scrollControlEnabled])

  // Play while the tonearm sits at the final position, stop the moment it
  // leaves. Resets to the start each stop so the next play starts fresh.
  // Also fires the arm-lift sound right as it leaves — but only when it was
  // actually at the final position before (not on initial mount).
  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return
    if (tonearmAtFinal) {
      audio.currentTime = 0
      playWithGestureFallback(audio)
    } else {
      audio.pause()
      audio.currentTime = 0
      if (wasTonearmAtFinalRef.current) {
        playWithGestureFallback(armupAudioRef.current)
      }
    }
    wasTonearmAtFinalRef.current = tonearmAtFinal
    onPlayingChange?.(tonearmAtFinal)
  }, [tonearmAtFinal, onPlayingChange])

  // Drives the tracking drift (see TONEARM_TRACKING_FINAL_*) off the audio
  // element's actual playback position instead of a separate timer.
  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return undefined
    const handleTimeUpdate = () => {
      const duration = Number.isFinite(audio.duration) && audio.duration > 0 ? audio.duration : TONEARM_TRACKING_DURATION_SECONDS
      setTrackingProgress(clamp01(audio.currentTime / duration))
    }
    audio.addEventListener('timeupdate', handleTimeUpdate)
    return () => audio.removeEventListener('timeupdate', handleTimeUpdate)
  }, [])

  // If the audio finishes on its own, loop just its last few seconds instead
  // of stopping — but only once we actually know the duration, otherwise
  // just let it stop.
  const handleAudioEnded = () => {
    const audio = audioRef.current
    if (!audio || !Number.isFinite(audio.duration) || audio.duration <= 0) return
    audio.currentTime = Math.max(0, audio.duration - AUDIO_LOOP_TAIL_SECONDS)
    playWithGestureFallback(audio)
  }

  return (
    <>
      <Canvas>
        <ambientLight intensity={0.6} />
        <directionalLight position={[3, 3, 3]} intensity={1.2} />
        <CameraRig position={CAMERA_POSITION} zoom={CAMERA_ZOOM} progress={progress} />
        <Suspense fallback={null}>
          <Turntable
            basePosition={BASE_POSITION}
            baseRotation={BASE_ROTATION}
            vinylPosition={VINYL_POSITION}
            vinylRotation={VINYL_ROTATION}
            vinylTextureOffset={VINYL_TEXTURE_OFFSET}
            vinylTextureRepeat={VINYL_TEXTURE_REPEAT}
            vinylTextureRotation={VINYL_TEXTURE_ROTATION}
            tonearmPosition={tonearmPosition}
            tonearmRotation={tonearmRotation}
            vinylSpinning={tonearmEngaged}
            onTonearmPointerDown={handleTonearmPointerDown}
            onTurntablePointerDown={handleTurntablePointerDown}
          />
          <Environment preset="sunset" />
        </Suspense>
      </Canvas>
      <audio type="audio/mpeg" preload="auto" ref={audioRef} src="/bubbles.mp3" onEnded={handleAudioEnded} />
      <audio type="audio/mpeg" preload="auto" ref={armupAudioRef} src="/armup.mp3" />
      {import.meta.env.DEV && (
        <TonearmDevPanel
          enabled={devOverrideEnabled}
          onToggleEnabled={setDevOverrideEnabled}
          position={devTonearmPosition}
          rotation={devTonearmRotation}
          onPositionChange={setDevTonearmPosition}
          onRotationChange={setDevTonearmRotation}
        />
      )}
    </>
  )
}

export default HeroScene
