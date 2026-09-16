import { useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'

function SpinningBox(props) {
  const meshRef = useRef(null)

  useFrame((_, delta) => {
    meshRef.current.rotation.x += delta * 0.4
    meshRef.current.rotation.y += delta * 0.6
  })

  return (
    <mesh ref={meshRef} {...props}>
      <boxGeometry args={[1.5, 1.5, 1.5]} />
      <meshStandardMaterial color="#c084fc" />
    </mesh>
  )
}

function HeroScene() {
  return (
    <Canvas camera={{ position: [0, 0, 5], fov: 50 }}>
      <ambientLight intensity={0.6} />
      <directionalLight position={[3, 3, 3]} intensity={1.2} />
      <SpinningBox />
      <OrbitControls enableZoom={false} />
    </Canvas>
  )
}

export default HeroScene
