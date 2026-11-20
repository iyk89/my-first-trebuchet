import { Line } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { fmtLength } from '../data/format';
import { geometry } from '../physics/geometry';
import type { Design } from '../physics/types';
import { useStore, type DemoArc, type Version } from '../state/store';
import { Label } from './Label';
import { frameIndexAt } from './playback';
import { grassTexture } from './textures';

export function niceStep(span: number) {
  const raw = span / 8;
  const p = Math.pow(10, Math.floor(Math.log10(raw)));
  const m = raw / p;
  return (m < 1.5 ? 1 : m < 3.5 ? 2 : m < 7.5 ? 5 : 10) * p;
}

export function Ground({ design, reach }: { design: Design; reach: number }) {
  const L = design.armLength;
  const tex = useMemo(() => {
    const t = grassTexture().clone();
    const tile = Math.min(Math.max(L * 1.2, 0.4), 15);
    t.repeat.set(4000 / tile, 4000 / tile);
    t.needsUpdate = true;
    return t;
  }, [L]);
  const step = niceStep(reach);
  const marks = useMemo(() => {
    const out: number[] = [];
    for (let x = step; x <= reach * 1.001; x += step) out.push(Math.round(x * 1e6) / 1e6);
    return out;
  }, [step, reach]);
  const lane = Math.max(L * 0.02, 0.003);
  const lift = Math.max(L * 0.0015, 0.0005);
  const postH = Math.max(step * 0.12, L * 0.08);
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[4000, 4000]} />
        <meshStandardMaterial map={tex} roughness={1} />
      </mesh>
      {/* Measuring line along the throw */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[reach / 2, lift, 0]}>
        <planeGeometry args={[reach, lane]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0.8} />
      </mesh>
      {marks.map((x) => (
        <group key={x} position={[x, 0, 0]}>
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, lift * 1.5, 0]}>
            <planeGeometry args={[lane * 1.5, step * 0.4]} />
            <meshBasicMaterial color="#ffffff" />
          </mesh>
          <mesh position={[0, postH / 2, -step * 0.2]}>
            <cylinderGeometry args={[postH * 0.04, postH * 0.04, postH, 6]} />
            <meshStandardMaterial color="#fafafa" />
          </mesh>
          <Label position={[0, postH * 1.15, -step * 0.2]} className="dist-label" text={fmtLength(x)} z={4} />
        </group>
      ))}
    </group>
  );
}

function LandingFlag({ x, color, label, size, big }: { x: number; color: string; label: string; size: number; big?: boolean }) {
  return (
    <group position={[x, 0, 0]}>
      <mesh position={[0, size / 2, 0]}>
        <cylinderGeometry args={[size * 0.02, size * 0.02, size, 6]} />
        <meshStandardMaterial color="#eeeeee" />
      </mesh>
      <mesh position={[size * 0.2, size * 0.85, 0]}>
        <boxGeometry args={[size * 0.4, size * 0.25, size * 0.01]} />
        <meshStandardMaterial color={color} side={THREE.DoubleSide} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, size * 0.003, 0]}>
        <ringGeometry args={[size * 0.12, size * 0.18, 32]} />
        <meshBasicMaterial color={color} />
      </mesh>
      <Label position={[0, size * 1.15, 0]} className={big ? 'land-label big' : 'land-label'} color={color} text={label} z={big ? 9 : 8} />
    </group>
  );
}

/** Saved throws drawn as colored arcs so you can compare them. */
export function GhostArcs({ versions, size, skipId }: { versions: Version[]; size: number; skipId: string | null }) {
  return (
    <group>
      {versions
        .filter((v) => v.results && v.id !== skipId && v.results.path.length > 1)
        .map((v) => (
          <group key={v.id}>
            <Line points={v.results!.path.map(([x, y]) => [x, y, 0] as [number, number, number])} color={v.color} lineWidth={2.5} transparent opacity={0.85} />
            <LandingFlag x={v.results!.distance} color={v.color} size={size} label={`${v.name}: ${fmtLength(v.results!.distance)}`} />
          </group>
        ))}
    </group>
  );
}

/** Lesson comparison throws: colored arcs with landing flags. Not saved anywhere. */
export function DemoArcs({ arcs, size }: { arcs: DemoArc[]; size: number }) {
  return (
    <group>
      {arcs.map((a) => (
        <group key={a.label}>
          <Line points={a.path.map(([x, y]) => [x, y, 0] as [number, number, number])} color={a.color} lineWidth={3} />
          <LandingFlag x={a.distance} color={a.color} size={size} label={a.label} />
        </group>
      ))}
    </group>
  );
}

/** The arc of the throw that's playing now, drawn as the ball flies. */
export function LiveArc({ color, size }: { color: string; size: number }) {
  const sim = useStore((s) => s.sim);
  const mode = useStore((s) => s.mode);
  const landed = useStore((s) => (s.sim && s.sim.landIndex >= 0 ? s.playTime >= s.sim.frames[s.sim.landIndex].t : false));
  const pastApex = useStore((s) => {
    const r = s.sim?.results;
    if (!r || !s.sim) return false;
    const idx = frameIndexAt(s.sim, s.playTime);
    const f = s.sim.frames[idx];
    return f.released && (f.bx >= r.apex.x || idx >= s.sim.landIndex);
  });
  const lineRef = useRef<any>(null);
  const points = useMemo(() => {
    if (!sim || sim.releaseIndex < 0) return null;
    const end = sim.landIndex >= 0 ? sim.landIndex : sim.frames.length - 1;
    const pts: [number, number, number][] = [];
    for (let i = Math.max(0, sim.releaseIndex - 1); i <= end; i++) pts.push([sim.frames[i].bx, sim.frames[i].by, 0]);
    return pts.length > 1 ? pts : null;
  }, [sim]);

  useFrame(() => {
    const s = useStore.getState();
    const line = lineRef.current;
    if (!line || !s.sim || s.sim.releaseIndex < 0) return;
    const idx = frameIndexAt(s.sim, s.playTime);
    const n = Math.max(0, idx - (s.sim.releaseIndex - 1));
    if (line.geometry) line.geometry.instanceCount = n;
  });

  if (mode !== 'throw' || !sim || !points) return null;
  const r = sim.results;
  return (
    <group>
      <Line ref={lineRef} points={points} color={color} lineWidth={4} />
      {r && pastApex && r.maxHeight > r.releaseHeight * 1.05 && (
        <group>
          <Line points={[[r.apex.x, 0, 0], [r.apex.x, r.apex.y, 0]]} color="#ffffff" lineWidth={1.5} dashed dashSize={size * 0.1} gapSize={size * 0.08} />
          <Label position={[r.apex.x, r.apex.y, 0]} className="apex-label" text={`${fmtLength(r.maxHeight)} high`} z={7} />
        </group>
      )}
      {r && landed && <LandingFlag x={r.distance} color={color} size={size} label={fmtLength(r.distance)} big />}
    </group>
  );
}

/** How far the ground markers should go for what's on screen. */
export function useReach(design: Design, versions: Version[], demo: DemoArc[] | null = null) {
  const sim = useStore((s) => s.sim);
  const mode = useStore((s) => s.mode);
  const g = geometry(design);
  let far = Math.max(design.armLength * 6, g.H * 6, 1);
  for (const v of versions) if (v.results) far = Math.max(far, v.results.distance * 1.1);
  for (const a of demo ?? []) far = Math.max(far, a.distance * 1.1);
  if (mode === 'throw' && sim?.results) far = Math.max(far, sim.results.distance * 1.1);
  const step = niceStep(far);
  return Math.ceil(far / step) * step;
}
