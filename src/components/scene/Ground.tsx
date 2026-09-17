"use client";

/** The void floor: a setting-out grid that fades into the fog and nothing else. */
export function Ground() {
  return (
    <gridHelper args={[160, 64, "#131c2b", "#0c1320"]} position={[0, 0, 0]}>
      <lineBasicMaterial attach="material" color="#152036" transparent opacity={0.28} depthWrite={false} />
    </gridHelper>
  );
}
