import React, { useRef, useMemo, useEffect } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { useGLTF, OrbitControls, Decal, Environment } from '@react-three/drei';
import * as THREE from 'three';
import { TEAMS } from '../../lib/constants/team-data';

const BASKETBALL_MODEL_PATH = '/models/basketball_ball.glb';

function Basketball({ color, logo, position, index }: any) {
  const group = useRef<THREE.Group>(null);
  const { scene, nodes, materials } = useGLTF(BASKETBALL_MODEL_PATH) as any;
  const [fade, setFade] = React.useState(0);
  const [y, setY] = React.useState(-3);

  // Fade in and move up animation
  useEffect(() => {
    setFade(0);
    setY(-3);
  }, []);
  useFrame((_, delta) => {
    if (fade < 1) {
      setFade(f => Math.min(1, f + delta / 1.2)); // 1.2s fade-in
    }
    if (y < 0) {
      setY(v => Math.min(0, v + delta * 2.5)); // 1.2s move up
    }
  });

  // Find all meshes in the model
  const meshes = React.useMemo(() => {
    const found: THREE.Mesh[] = [];
    scene.traverse((child: any) => {
      if ((child as THREE.Mesh).isMesh) {
        found.push(child as THREE.Mesh);
      }
    });
    return found;
  }, [scene]);

  // Memoize all textures above meshData
  const logoTexture = useMemo(() => new THREE.TextureLoader().load(logo), [logo]);
  const seamTexture = useMemo(() => new THREE.TextureLoader().load('/logos/basketball-seams-illustration-png.png'), []);
  const bumpTexture = useMemo(() => {
    const tex = new THREE.TextureLoader().load('/textures/basketball_bump.jpg');
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(1, 1);
    return tex;
  }, []);

  // Prepare mesh data with per-mesh material logic
  const meshData = React.useMemo(() => {
    return meshes.map((m) => {
      let material;
      // Force MeshStandardMaterial for testing
      material = new THREE.MeshStandardMaterial({ color });
      material.bumpMap = bumpTexture;
      material.bumpScale = 5;
      material.roughness = 0.5;
      material.metalness = 0.1;
      material.needsUpdate = true;
      // Log material type for debugging
      console.log('Basketball mesh material type:', material.type);
      return { geometry: m.geometry, material };
    });
  }, [meshes, color, bumpTexture]);

  // Compute the radius and center of the first mesh for Decal placement
  const meshDebug = React.useMemo(() => {
    if (meshes.length === 0) return { radius: 1, center: [0, 0, 0] };
    const bbox = new THREE.Box3().setFromObject(meshes[0]);
    const size = new THREE.Vector3();
    const center = new THREE.Vector3();
    bbox.getSize(size);
    bbox.getCenter(center);
    // Log actual values
    console.log('Basketball mesh bbox size:', size.x, size.y, size.z, 'center:', center.x, center.y, center.z);
    return { radius: Math.max(size.x, size.y, size.z) / 2, center: [center.x, center.y, center.z] };
  }, [meshes]);

  return (
    <group
      ref={group}
      position={[position[0], y, position[2]]}
      scale={[0.7, 0.7, 0.7]}
      rotation={[0, Math.PI / 2, 0]}
      // @ts-ignore
      style={{ opacity: fade }}
    >
      {meshData.map((m, idx) => (
        <mesh
          key={idx}
          geometry={m.geometry}
          material={m.material}
          castShadow
          receiveShadow
        >
          {/* Soft shadow under each ball (now circular) */}
          {idx === 0 && (
            <mesh
              position={[-(meshDebug.radius + 0.05), meshDebug.center[1] - meshDebug.radius - 0.15, 0]}
              rotation={[-Math.PI / 2, 0, 0]}
              scale={[0.7, 0.7, 0.7]}
            >
              <circleGeometry args={[0.6, 32]} />
              <meshBasicMaterial color="#000" opacity={0.18} transparent />
            </mesh>
          )}
          {/* Logo plane */}
          {idx === 0 && (
            <mesh
              position={[-(meshDebug.radius + 0.05), meshDebug.center[1] + 0.35, 0]}
              rotation={[0, -Math.PI / 2, 0]}
              scale={[0.55, 0.55, 0.55]}
            >
              <planeGeometry args={[1, 1]} />
              <meshBasicMaterial map={logoTexture} transparent />
            </mesh>
          )}
        </mesh>
      ))}
    </group>
  );
}

function getRandomTeams(arr: typeof TEAMS, n: number) {
  const result = [];
  const used = new Set<number>();
  while (result.length < n && used.size < arr.length) {
    const idx = Math.floor(Math.random() * arr.length);
    if (!used.has(idx)) {
      used.add(idx);
      result.push(arr[idx]);
    }
  }
  return result;
}

export default function BasketballDrop3D() {
  // Pick 5 random teams on initial render
  const [randomTeams] = React.useState(() => getRandomTeams(TEAMS, 5));
  return (
    <Canvas camera={{ position: [0, 2.5, 10], fov: 50 }} style={{ width: '100vw', height: '100vh', position: 'absolute', top: 0, left: 0, pointerEvents: 'none', zIndex: 2, background: '#232323' }}>
      <ambientLight intensity={0.7} />
      <directionalLight position={[5, 10, 5]} intensity={1.2} castShadow />
      <Environment preset="sunset" />
      {/* Ground plane */}
      <mesh receiveShadow position={[0, -1.2, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[20, 20]} />
        <meshStandardMaterial color="transparent" transparent opacity={0} />
      </mesh>
      {/* Basketballs */}
      {randomTeams.map((team, i) => (
        <Basketball
          key={team.name}
          color={team.color}
          logo={team.logo}
          position={[i * 2 - 4, 0, 0]}
          index={i}
        />
      ))}
      <OrbitControls />
      {/* Optional: <OrbitControls /> for debugging */}
    </Canvas>
  );
}

// Preload the model
useGLTF.preload(BASKETBALL_MODEL_PATH); 