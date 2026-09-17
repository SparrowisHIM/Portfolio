"use client";

/** The void floor: a setting-out grid fading into the fog, and a ring round the site. */
export function Ground() {
  return (
    <group>
      <gridHelper args={[160, 64, "#1a2538", "#101827"]} position={[0, 0, 0]}>
        <lineBasicMaterial attach="material" color="#1c2a42" transparent opacity={0.4} depthWrite={false} />
      </gridHelper>
      {[12.5, 12.9].map((r, i) => (
        <mesh key={r} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
          <ringGeometry args={[r, r + (i === 0 ? 0.06 : 0.02), 128]} />
          <meshBasicMaterial color="#6f7f9f" transparent opacity={i === 0 ? 0.22 : 0.1} depthWrite={false} />
        </mesh>
      ))}
    </group>
  );
}
