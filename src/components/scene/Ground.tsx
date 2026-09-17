"use client";

/** The void floor: a setting-out grid fading into the fog, and a ring round the site. */
export function Ground() {
  return (
    <group>
      <gridHelper args={[96, 32, "#131c2b", "#0c131f"]} position={[0, 0, 0]}>
        <lineBasicMaterial attach="material" color="#142032" transparent opacity={0.16} depthWrite={false} />
      </gridHelper>
      {[12.5, 12.9].map((r, i) => (
        <mesh key={r} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
          <ringGeometry args={[r, r + (i === 0 ? 0.06 : 0.02), 128]} />
          <meshBasicMaterial color="#5d6c88" transparent opacity={i === 0 ? 0.14 : 0.06} depthWrite={false} />
        </mesh>
      ))}
    </group>
  );
}
