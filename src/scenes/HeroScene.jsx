import { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { Center, Environment, PerspectiveCamera, useGLTF, useTexture } from '@react-three/drei'
import { RepeatWrapping, SRGBColorSpace } from 'three'

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
  ...props
}) {
  const base = useGLTF('/turntable3.glb')
  const vinyl = useGLTF('/Vinyl.glb')
  const tonearm = useGLTF('/tonearm.glb')
  const vinylTextureRef = useRef(null)
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
      <primitive object={vinyl.scene} position={vinylPosition} rotation={vinylRotation} />
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
  const [tonearmPosition, setTonearmPosition] = useState([0.21, -0.22, 0.82])
  const [tonearmRotation, setTonearmRotation] = useState([-0.28, -0.56, 0])
  const [cameraPosition, setCameraPosition] = useState(DEFAULT_CAMERA_POSITION)
  const [cameraZoom, setCameraZoom] = useState(DEFAULT_CAMERA_ZOOM)

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
          />
          <Environment preset="sunset" />
        </Suspense>
      </Canvas>
      <button
        onClick={() => {
          setCameraPosition(DEFAULT_CAMERA_POSITION)
          setCameraZoom(DEFAULT_CAMERA_ZOOM)
        }}
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
        Reset camera
      </button>
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
