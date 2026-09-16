import { palette } from "./materials";

export function Ground() {
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]}>
        <planeGeometry args={[240, 240]} />
        <meshStandardMaterial color={palette.nightDeep} roughness={1} />
      </mesh>
      {/* Setting-out grid, faint enough to read as chalk lines on the ground. */}
      <gridHelper args={[160, 40, "#1b2c42", "#132238"]} position={[0, 0.01, 0]}>
        <lineBasicMaterial
          attach="material"
          color="#1a2b41"
          transparent
          opacity={0.45}
          depthWrite={false}
        />
      </gridHelper>
    </group>
  );
}
