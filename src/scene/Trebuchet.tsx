import { useFrame, type ThreeEvent } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { fmtMass } from '../data/format';
import { projectileById } from '../data/projectiles';
import type { StepId } from '../data/variables';
import { geometry, pose, startAngles, type Geometry } from '../physics/geometry';
import type { Design } from '../physics/types';
import { useStore } from '../state/store';
import { Label } from './Label';
import { currentFrame } from './playback';
import { darkWoodTexture, woodTexture } from './textures';

const UP = new THREE.Vector3(0, 1, 0);
const tmpA = new THREE.Vector3();
const tmpB = new THREE.Vector3();
const tmpD = new THREE.Vector3();

export function setRod(mesh: THREE.Object3D, a: THREE.Vector3, b: THREE.Vector3) {
  tmpD.subVectors(b, a);
  const len = tmpD.length();
  mesh.position.copy(a).addScaledVector(tmpD, 0.5);
  if (len > 1e-9) mesh.quaternion.setFromUnitVectors(UP, tmpD.divideScalar(len));
  mesh.scale.set(1, Math.max(len, 1e-6), 1);
}

export interface MachineDims {
  L: number;
  t: number; // arm thickness
  post: number; // frame post thickness
  w: number; // half the gap between the two side frames
  footX: number;
  baseHalf: number;
  box: [number, number, number]; // weight box size
}

export function machineDims(g: Geometry): MachineDims {
  const L = g.La + g.Lb;
  const t = Math.max(L * 0.045, 0.006);
  const post = t * 0.85;
  let box: [number, number, number] = [g.cwSize, g.cwSize, g.cwSize];
  if (g.hinged && g.cwSize / 2 > g.Lh * 0.85) {
    // a short hanger needs a flatter, wider box (same amount of sand)
    const h = g.Lh * 1.7;
    const side = Math.sqrt((g.cwSize * g.cwSize * g.cwSize) / h);
    box = [side, h, side];
  }
  const w = Math.max(box[2] / 2 + t * 1.2, t * 1.6);
  const footX = Math.max(g.H * 0.6, t * 3);
  return { L, t, post, w, footX, baseHalf: footX + post * 1.5, box };
}

function useMat(color: string, map?: THREE.Texture, extra: Partial<THREE.MeshStandardMaterialParameters> = {}) {
  return useMemo(
    () => new THREE.MeshStandardMaterial({ color, ...(map ? { map } : {}), roughness: 0.8, metalness: 0, ...extra }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [color, map],
  );
}

function useHighlight(mats: THREE.MeshStandardMaterial[], on: boolean) {
  useEffect(() => {
    for (const m of mats) {
      m.emissive.set(on ? '#ff9a3c' : '#000000');
      m.emissiveIntensity = on ? 0.35 : 0;
    }
  }, [mats, on]);
}

/** Tap a part of the machine to jump to its settings. */
function pick(step: StepId) {
  return (e: ThreeEvent<MouseEvent>) => {
    if (e.delta > 6) return; // it was a drag, not a tap
    e.stopPropagation();
    useStore.getState().setStep(step);
  };
}

export function Trebuchet({ design }: { design: Design }) {
  const g = useMemo(() => geometry(design), [design]);
  const dims = useMemo(() => machineDims(g), [g]);
  const step = useStore((s) => s.step);
  const mode = useStore((s) => s.mode);
  const building = mode === 'build';
  const projectile = projectileById(design.projectileId);

  const wood = useMat('#ffffff', woodTexture());
  const frameWood = useMat('#e8d2b0', woodTexture());
  const darkWood = useMat('#ffffff', darkWoodTexture());
  const metal = useMat('#55585e', undefined, { metalness: 0.7, roughness: 0.35 });
  const rope = useMat('#c9a66b', undefined, { roughness: 1 });
  const leather = useMat('#6b4226', undefined, { roughness: 0.9 });
  const ballMat = useMat(projectile.color, undefined, { roughness: 0.5 });
  const hookMat = useMat('#c0c4cc', undefined, { metalness: 0.8, roughness: 0.25 });

  useHighlight([wood], building && step === 'arm');
  useHighlight([frameWood], building && step === 'tower');
  useHighlight([darkWood], building && step === 'weight');
  useHighlight([rope, leather, hookMat], building && step === 'sling');
  useHighlight([ballMat], building && step === 'ball');

  const arm = useRef<THREE.Group>(null);
  const hanger = useRef<THREE.Group>(null);
  const ball = useRef<THREE.Mesh>(null);
  const pouch = useRef<THREE.Mesh>(null);
  const cordA = useRef<THREE.Mesh>(null);
  const cordB = useRef<THREE.Mesh>(null);

  useFrame(() => {
    const f = currentFrame(design);
    if (arm.current) arm.current.rotation.z = f.theta;
    const p = pose(g, f.theta, f.phi, f.psi);
    if (hanger.current) {
      hanger.current.position.set(p.shortEnd[0], p.shortEnd[1], 0);
      hanger.current.rotation.z = f.phi + Math.PI / 2;
    }
    if (ball.current) ball.current.position.set(f.bx, f.by, 0);
    const end: [number, number] = f.released ? p.ball : [f.bx, f.by];
    if (pouch.current) {
      pouch.current.position.set(end[0], end[1], 0);
      pouch.current.rotation.z = Math.atan2(end[1] - p.tip[1], end[0] - p.tip[0]);
    }
    const half = Math.max(g.r * 0.9, dims.t * 0.3);
    tmpA.set(p.tip[0], p.tip[1], 0);
    if (cordA.current) setRod(cordA.current, tmpA, tmpB.set(end[0], end[1], half));
    if (cordB.current) setRod(cordB.current, tmpA, tmpB.set(end[0], end[1], -half));
  });

  const { t, post, w, footX, baseHalf, box } = dims;
  const H = g.H;
  const ropeR = Math.max(t * 0.06, g.r * 0.08, 0.0008);
  const hookLen = t * 1.8;
  const alpha = (design.releaseAngle * Math.PI) / 180;

  // Static frame pieces (two A-frames, base, axle)
  const framePieces = useMemo(() => {
    const pieces: { a: THREE.Vector3; b: THREE.Vector3; r: number }[] = [];
    for (const z of [-(w + post / 2), w + post / 2]) {
      pieces.push({ a: new THREE.Vector3(-footX, post, z), b: new THREE.Vector3(-post * 0.4, H - t * 0.4, z), r: post / 2 });
      pieces.push({ a: new THREE.Vector3(footX, post, z), b: new THREE.Vector3(post * 0.4, H - t * 0.4, z), r: post / 2 });
      pieces.push({ a: new THREE.Vector3(-footX * 0.55, H * 0.45, z), b: new THREE.Vector3(footX * 0.55, H * 0.45, z), r: post * 0.4 });
    }
    return pieces;
  }, [w, post, footX, H, t]);

  const start = useMemo(() => {
    const a = startAngles(g);
    return pose(g, a.theta, a.phi, a.psi);
  }, [g]);
  const troughStart = Math.min(start.tip[0], start.ball[0]) - g.r * 2;
  const troughEnd = Math.max(start.ball[0], post) + g.r * 3;

  return (
    <group>
      {/* Base */}
      <group onClick={pick('tower')}>
        {[-(w + post / 2), w + post / 2].map((z) => (
          <mesh key={z} position={[0, post / 2, z]} material={frameWood} castShadow receiveShadow>
            <boxGeometry args={[baseHalf * 2, post, post]} />
          </mesh>
        ))}
        {[-baseHalf + post / 2, baseHalf - post / 2].map((x) => (
          <mesh key={x} position={[x, post / 2, 0]} material={frameWood} castShadow receiveShadow>
            <boxGeometry args={[post, post * 0.9, (w + post) * 2]} />
          </mesh>
        ))}
        {framePieces.map((p, i) => (
          <mesh key={i} ref={(m) => m && setRod(m, p.a, p.b)} material={frameWood} castShadow receiveShadow>
            <boxGeometry args={[p.r * 2, 1, p.r * 2]} />
          </mesh>
        ))}
        {[-(w + post / 2), w + post / 2].map((z) => (
          <mesh key={`blk${z}`} position={[0, H, z]} material={frameWood} castShadow>
            <boxGeometry args={[t * 1.8, t * 1.4, post * 1.1]} />
          </mesh>
        ))}
        {/* Axle */}
        <mesh position={[0, H, 0]} rotation={[Math.PI / 2, 0, 0]} material={metal} castShadow>
          <cylinderGeometry args={[t * 0.22, t * 0.22, (w + post * 1.3) * 2, 16]} />
        </mesh>
      </group>

      {/* Trough the ball slides along */}
      {[-1, 1].map((s) => (
        <mesh key={s} position={[(troughStart + troughEnd) / 2, g.r * 0.25, s * g.r * 1.2]} material={darkWood} receiveShadow>
          <boxGeometry args={[troughEnd - troughStart, g.r * 0.5, Math.max(g.r * 0.3, 0.002)]} />
        </mesh>
      ))}

      {/* Arm (rotates around the axle) */}
      <group ref={arm} position={[0, H, 0]}>
        <mesh position={[(g.La - g.Lb) / 2, 0, 0]} material={wood} castShadow onClick={pick('arm')}>
          <boxGeometry args={[g.La + g.Lb, t, t * 0.8]} />
        </mesh>
        {/* Release hook at the tip */}
        <mesh
          position={[g.La + (Math.cos(alpha) * hookLen) / 2, (Math.sin(alpha) * hookLen) / 2, 0]}
          rotation={[0, 0, alpha - Math.PI / 2]}
          material={hookMat}
          onClick={pick('sling')}
        >
          <cylinderGeometry args={[t * 0.09, t * 0.09, hookLen, 8]} />
        </mesh>
        {!g.hinged && (
          <mesh position={[-g.Lb, 0, 0]} material={darkWood} castShadow onClick={pick('weight')}>
            <boxGeometry args={box} />
          </mesh>
        )}
      </group>

      {/* Hinged counterweight */}
      {g.hinged && (
        <group ref={hanger} onClick={pick('weight')}>
          {[-1, 1].map((s) => (
            <mesh key={s} position={[0, -(g.Lh - box[1] / 2) / 2, s * t * 0.6]} material={metal} castShadow>
              <cylinderGeometry args={[t * 0.08, t * 0.08, Math.max(g.Lh - box[1] / 2, 1e-4), 6]} />
            </mesh>
          ))}
          <mesh position={[0, -g.Lh, 0]} material={darkWood} castShadow>
            <boxGeometry args={box} />
          </mesh>
          {building && step === 'weight' && (
            <Label position={[0, -g.Lh, box[2] / 2]} className="part-label" text={fmtMass(design.cwMass)} z={10} />
          )}
        </group>
      )}

      {/* Sling */}
      <mesh ref={cordA} material={rope}>
        <cylinderGeometry args={[ropeR, ropeR, 1, 5]} />
      </mesh>
      <mesh ref={cordB} material={rope}>
        <cylinderGeometry args={[ropeR, ropeR, 1, 5]} />
      </mesh>
      <mesh ref={pouch} material={leather} scale={[0.6, 1, 1.25]} onClick={pick('sling')}>
        <sphereGeometry args={[g.r * 1.08, 12, 8, 0, Math.PI * 2, Math.PI * 0.45, Math.PI * 0.55]} />
      </mesh>

      {/* Ball */}
      <mesh ref={ball} material={ballMat} castShadow onClick={pick('ball')}>
        <sphereGeometry args={[g.r, 24, 16]} />
      </mesh>
    </group>
  );
}

/** A 1.2 m kid, so you can see how big the machine really is. */
export function KidForScale({ design }: { design: Design }) {
  const g = useMemo(() => geometry(design), [design]);
  const dims = machineDims(g);
  const x = -dims.baseHalf - 0.4 - 0.3 * dims.L;
  const z = -(dims.w + 0.5 + 0.2 * dims.L);
  const shirt = useMat('#3d7be0');
  const pants = useMat('#2b2f45');
  const skin = useMat('#f1c6a0');
  const hair = useMat('#3b2a1e');
  if (dims.L < 0.6) return null; // on tiny builds the kid would just fill the screen with legs
  return (
    <group position={[x, 0, z]}>
      {[-0.07, 0.07].map((dz) => (
        <mesh key={dz} position={[0, 0.27, dz]} material={pants} castShadow>
          <capsuleGeometry args={[0.055, 0.42, 4, 8]} />
        </mesh>
      ))}
      <mesh position={[0, 0.72, 0]} material={shirt} castShadow>
        <capsuleGeometry args={[0.13, 0.28, 4, 12]} />
      </mesh>
      {[-0.17, 0.17].map((dz) => (
        <mesh key={dz} position={[0, 0.72, dz]} rotation={[dz > 0 ? -0.25 : 0.25, 0, 0]} material={shirt} castShadow>
          <capsuleGeometry args={[0.04, 0.3, 4, 8]} />
        </mesh>
      ))}
      <mesh position={[0, 1.04, 0]} material={skin} castShadow>
        <sphereGeometry args={[0.11, 20, 16]} />
      </mesh>
      <mesh position={[0.0, 1.08, 0]} material={hair} castShadow>
        <sphereGeometry args={[0.112, 20, 16, 0, Math.PI * 2, 0, Math.PI * 0.45]} />
      </mesh>
      <Label position={[0, 1.3, 0]} className="scale-label" text="Kid · 1.2 m" z={5} />
    </group>
  );
}
