import { palette } from "./materials";

export function Ground() {
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]} receiveShadow>
        <planeGeometry args={[240, 240]} />
        <meshStandardMaterial color={palette.nightDeep} roughness={1} />
      </mesh>
      <gridHelper
        args={[160, 80, palette.fog, palette.fog]}
        position={[0, 0.01, 0]}
      />
    </group>
  );
}
