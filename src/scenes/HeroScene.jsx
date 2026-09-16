import { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { Center, Environment, PerspectiveCamera, useGLTF, useTexture } from '@react-three/drei'
import { Box3, RepeatWrapping, SRGBColorSpace, Vector3 } from 'three'

const TONEARM_DEFAULT_POSITION = [0.16, -0.08, 1.56];
const TONEARM_DEFAULT_ROTATION = [0, 0.18, 0];
const TONEARM_FINAL_POSITION = [0.21, -0.22, 0.82]
const TONEARM_FINAL_ROTATION = [-0.28, -0.56, 0]
const TONEARM_ANIMATION_DURATION_MS = 2200
const VINYL_SPIN_SPEED = 3.49 // rad/s, ~33 1/3 RPM
const VINYL_SPIN_RAMP_MS = 1500
const AUDIO_LOOP_TAIL_SECONDS = 10

function easeInOutCubic(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
}

function lerpVec3(from, to, t) {
  return [from[0] + (to[0] - from[0]) * t, from[1] + (to[1] - from[1]) * t, from[2] + (to[2] - from[2]) * t]
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
  const vinylTexture = useTexture('/textures/Texturelabs_Paper_334S.jpg', (texture) => {
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
      child.material.color.set('#ffffff')
      child.material.metalness = 0.7
      child.material.roughness = 0.8
      child.material.needsUpdate = true
    })
  }, [vinyl.scene, vinylTexture])

  return (
    <Center {...props}>
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
      <primitive object={tonearm.scene} position={tonearmPosition} rotation={tonearmRotation} />
    </Center>
  )
}

useGLTF.preload('/turntable3.glb')
useGLTF.preload('/Vinyl.glb')
useGLTF.preload('/tonearm.glb')

// TEMPORARY: dev-only sliders for finding base/vinyl/tonearm/camera placement. Remove once positions are final.
function PlacementControls({
  basePosition,
  setBasePosition,
  baseRotation,
  setBaseRotation,
  vinylPosition,
  setVinylPosition,
  vinylRotation,
  setVinylRotation,
  vinylTextureOffset,
  setVinylTextureOffset,
  vinylTextureRepeat,
  setVinylTextureRepeat,
  vinylTextureRotation,
  setVinylTextureRotation,
  tonearmPosition,
  setTonearmPosition,
  tonearmRotation,
  setTonearmRotation,
  cameraPosition,
  setCameraPosition,
  cameraZoom,
  setCameraZoom,
}) {
  const axisRow = (label, values, setValues, min = -1, max = 2, axisLabels = ['x', 'y', 'z']) => (
    <div style={{ marginBottom: 6 }}>
      <div style={{ fontSize: 11, opacity: 0.7 }}>{label}</div>
      {axisLabels.map((axis, i) => (
        <div key={axis} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 10 }}>{axis}</span>
          <input
            type="range"
            min={min}
            max={max}
            step={0.01}
            value={values[i]}
            onChange={(e) => {
              const next = [...values]
              next[i] = parseFloat(e.target.value)
              setValues(next)
            }}
            style={{ flex: 1 }}
          />
          <span style={{ width: 44, fontVariantNumeric: 'tabular-nums' }}>{values[i].toFixed(2)}</span>
        </div>
      ))}
    </div>
  )

  const scalarRow = (label, value, setValue, min, max) => (
    <div style={{ marginBottom: 6 }}>
      <div style={{ fontSize: 11, opacity: 0.7 }}>{label}</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <input
          type="range"
          min={min}
          max={max}
          step={0.01}
          value={value}
          onChange={(e) => setValue(parseFloat(e.target.value))}
          style={{ flex: 1 }}
        />
        <span style={{ width: 44, fontVariantNumeric: 'tabular-nums' }}>{value.toFixed(2)}</span>
      </div>
    </div>
  )

  return (
    <div
      style={{
        position: 'fixed',
        top: 12,
        right: 12,
        width: 220,
        padding: 12,
        background: 'rgba(0,0,0,0.75)',
        color: '#fff',
        fontFamily: 'monospace',
        fontSize: 12,
        borderRadius: 8,
        zIndex: 10,
      }}
    >
      <div style={{ fontWeight: 'bold', marginBottom: 8 }}>Placement (temp)</div>
      {axisRow('camera position', cameraPosition, setCameraPosition, -10, 10)}
      {scalarRow('camera zoom', cameraZoom, setCameraZoom, 0.2, 3)}
      {axisRow('base position', basePosition, setBasePosition)}
      {axisRow('base rotation', baseRotation, setBaseRotation)}
      {axisRow('vinyl position', vinylPosition, setVinylPosition)}
      {axisRow('vinyl rotation', vinylRotation, setVinylRotation)}
      {axisRow('vinyl texture offset', vinylTextureOffset, setVinylTextureOffset, -1, 1, ['u', 'v'])}
      {axisRow('vinyl texture repeat', vinylTextureRepeat, setVinylTextureRepeat, 0.1, 7, ['u', 'v'])}
      {scalarRow('vinyl texture rotation', vinylTextureRotation, setVinylTextureRotation, -Math.PI, Math.PI)}
      {axisRow('tonearm position', tonearmPosition, setTonearmPosition)}
      {axisRow('tonearm rotation', tonearmRotation, setTonearmRotation)}
      <pre style={{ whiteSpace: 'pre-wrap', marginTop: 8, opacity: 0.7 }}>
        {`camera:   pos [${cameraPosition.map((v) => v.toFixed(2)).join(', ')}]  zoom ${cameraZoom.toFixed(2)}\nbase:     pos [${basePosition.map((v) => v.toFixed(2)).join(', ')}]  rot [${baseRotation.map((v) => v.toFixed(2)).join(', ')}]\nvinyl:    pos [${vinylPosition.map((v) => v.toFixed(2)).join(', ')}]  rot [${vinylRotation.map((v) => v.toFixed(2)).join(', ')}]\nvinyl tex: off [${vinylTextureOffset.map((v) => v.toFixed(2)).join(', ')}]  rep [${vinylTextureRepeat.map((v) => v.toFixed(2)).join(', ')}]  rot ${vinylTextureRotation.toFixed(2)}\ntonearm:  pos [${tonearmPosition.map((v) => v.toFixed(2)).join(', ')}]  rot [${tonearmRotation.map((v) => v.toFixed(2)).join(', ')}]`}
      </pre>
    </div>
  )
}

// Applies the fixed camera position/zoom to the actual three.js camera each
// time they change, and keeps it aimed at the turntable (origin) since there
// are no OrbitControls to handle that anymore.
function CameraRig({ position, zoom }) {
  const cameraRef = useRef(null)

  useEffect(() => {
    const camera = cameraRef.current
    if (!camera) return
    camera.position.set(...position)
    camera.zoom = zoom
    camera.lookAt(0, 0, 0)
    camera.updateProjectionMatrix()
  }, [position, zoom])

  return <PerspectiveCamera ref={cameraRef} makeDefault fov={50} />
}

const DEFAULT_CAMERA_POSITION = [-4.77, 3.73, 9]
const DEFAULT_CAMERA_ZOOM = 1

function HeroScene() {
  const [basePosition, setBasePosition] = useState([0.37, 1.7, -0.19])
  const [baseRotation, setBaseRotation] = useState([-0.83, -0.93, -0.85])
  const [vinylPosition, setVinylPosition] = useState([-0.03, 0, 0.13])
  const [vinylRotation, setVinylRotation] = useState([0, 0, 0])
  const [vinylTextureOffset, setVinylTextureOffset] = useState([0, 0])
  const [vinylTextureRepeat, setVinylTextureRepeat] = useState([1, 1])
  const [vinylTextureRotation, setVinylTextureRotation] = useState(0)
  const [tonearmPosition, setTonearmPosition] = useState(TONEARM_DEFAULT_POSITION)
  const [tonearmRotation, setTonearmRotation] = useState(TONEARM_DEFAULT_ROTATION)
  const [cameraPosition, setCameraPosition] = useState(DEFAULT_CAMERA_POSITION)
  const [cameraZoom, setCameraZoom] = useState(DEFAULT_CAMERA_ZOOM)
  const [tonearmEngaged, setTonearmEngaged] = useState(false)
  const [tonearmAtFinal, setTonearmAtFinal] = useState(false)
  const tonearmAnimationRef = useRef(null)
  const audioRef = useRef(null)

  // Cancel any in-flight tonearm animation on unmount so it doesn't keep
  // calling setState after the component is gone.
  useEffect(() => {
    return () => {
      if (tonearmAnimationRef.current) cancelAnimationFrame(tonearmAnimationRef.current)
    }
  }, [])

  const playTonearmAnimation = () => {
    if (tonearmAnimationRef.current) cancelAnimationFrame(tonearmAnimationRef.current)
    // Start from wherever the tonearm currently is (not a fixed constant) so
    // clicking mid-animation reverses smoothly instead of jumping.
    const startPosition = tonearmPosition
    const startRotation = tonearmRotation
    const engaging = !tonearmEngaged
    const targetPosition = engaging ? TONEARM_FINAL_POSITION : TONEARM_DEFAULT_POSITION
    const targetRotation = engaging ? TONEARM_FINAL_ROTATION : TONEARM_DEFAULT_ROTATION
    setTonearmEngaged(engaging)
    // Leaving the final position stops the audio right away; arriving there
    // only counts once the animation actually finishes (below).
    if (!engaging) setTonearmAtFinal(false)
    const startTime = performance.now()

    const step = (now) => {
      const t = Math.min((now - startTime) / TONEARM_ANIMATION_DURATION_MS, 1)
      const eased = easeInOutCubic(t)
      setTonearmPosition(lerpVec3(startPosition, targetPosition, eased))
      setTonearmRotation(lerpVec3(startRotation, targetRotation, eased))
      if (t < 1) {
        tonearmAnimationRef.current = requestAnimationFrame(step)
      } else {
        tonearmAnimationRef.current = null
        if (engaging) setTonearmAtFinal(true)
      }
    }
    tonearmAnimationRef.current = requestAnimationFrame(step)
  }

  // Play while the tonearm sits at the final position, stop the moment it
  // leaves. Resets to the start each stop so the next play starts fresh.
  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return
    if (tonearmAtFinal) {
      audio.currentTime = 0
      audio.play()
    } else {
      audio.pause()
      audio.currentTime = 0
    }
  }, [tonearmAtFinal])

  // If the audio finishes on its own, loop just its last few seconds instead
  // of stopping — but only once we actually know the duration, otherwise
  // just let it stop.
  const handleAudioEnded = () => {
    const audio = audioRef.current
    if (!audio || !Number.isFinite(audio.duration) || audio.duration <= 0) return
    audio.currentTime = Math.max(0, audio.duration - AUDIO_LOOP_TAIL_SECONDS)
    audio.play()
  }

  return (
    <>
      <Canvas>
        <ambientLight intensity={0.6} />
        <directionalLight position={[3, 3, 3]} intensity={1.2} />
        <CameraRig position={cameraPosition} zoom={cameraZoom} />
        <Suspense fallback={null}>
          <Turntable
            basePosition={basePosition}
            baseRotation={baseRotation}
            vinylPosition={vinylPosition}
            vinylRotation={vinylRotation}
            vinylTextureOffset={vinylTextureOffset}
            vinylTextureRepeat={vinylTextureRepeat}
            vinylTextureRotation={vinylTextureRotation}
            tonearmPosition={tonearmPosition}
            tonearmRotation={tonearmRotation}
            vinylSpinning={tonearmEngaged}
          />
          <Environment preset="sunset" />
        </Suspense>
      </Canvas>
      <button
        onClick={playTonearmAnimation}
        style={{
          position: 'fixed',
          top: 12,
          left: 12,
          padding: '8px 14px',
          background: 'rgba(0,0,0,0.75)',
          color: '#fff',
          border: '1px solid rgba(255,255,255,0.3)',
          borderRadius: 6,
          fontFamily: 'monospace',
          fontSize: 12,
          cursor: 'pointer',
          zIndex: 10,
        }}
      >
        {tonearmEngaged ? 'Reset tonearm' : 'Play tonearm'}
      </button>
      <audio ref={audioRef} src="/bubbles.mp3" onEnded={handleAudioEnded} />
      <PlacementControls
        basePosition={basePosition}
        setBasePosition={setBasePosition}
        baseRotation={baseRotation}
        setBaseRotation={setBaseRotation}
        vinylPosition={vinylPosition}
        setVinylPosition={setVinylPosition}
        vinylRotation={vinylRotation}
        setVinylRotation={setVinylRotation}
        vinylTextureOffset={vinylTextureOffset}
        setVinylTextureOffset={setVinylTextureOffset}
        vinylTextureRepeat={vinylTextureRepeat}
        setVinylTextureRepeat={setVinylTextureRepeat}
        vinylTextureRotation={vinylTextureRotation}
        setVinylTextureRotation={setVinylTextureRotation}
        tonearmPosition={tonearmPosition}
        setTonearmPosition={setTonearmPosition}
        tonearmRotation={tonearmRotation}
        setTonearmRotation={setTonearmRotation}
        cameraPosition={cameraPosition}
        setCameraPosition={setCameraPosition}
        cameraZoom={cameraZoom}
        setCameraZoom={setCameraZoom}
      />
    </>
  )
}

export default HeroScene
