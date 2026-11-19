import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import { useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { VARS } from '../data/variables';
import { geometry, pose, startAngles } from '../physics/geometry';
import type { Design } from '../physics/types';
import { useStore } from '../state/store';
import { Label } from './Label';

type HandleKind = 'tip' | 'pivot' | 'tower' | 'hanger' | 'sling';

const HINTS: Record<HandleKind, string> = {
  tip: 'Drag to stretch the arm',
  pivot: 'Slide where the arm turns',
  tower: 'Drag up or down',
  hanger: 'Drag to change the hanger',
  sling: 'Drag to change the sling',
};

function clampVar(key: string, v: number, d: Design) {
  const spec = VARS[key];
  return Math.min(spec.max(d), Math.max(spec.min(d), v));
}

function pointOnPlane(e: ThreeEvent<PointerEvent>) {
  const { origin, direction } = e.ray;
  if (Math.abs(direction.z) < 1e-6) return null;
  const t = -origin.z / direction.z;
  return new THREE.Vector3().copy(origin).addScaledVector(direction, t);
}

function Handle({ kind, position, size, onDrag }: {
  kind: HandleKind;
  position: [number, number, number];
  size: number;
  onDrag: (p: THREE.Vector3, start: { design: Design }) => void;
}) {
  const controls = useThree((s) => s.controls) as any;
  const dragging = useRef<{ design: Design } | null>(null);
  const [hover, setHover] = useState(false);
  const [active, setActive] = useState(false);
  const ring = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    if (ring.current) {
      const s = 1 + 0.15 * Math.sin(clock.elapsedTime * 4);
      ring.current.scale.set(s, s, s);
    }
  });
  return (
    <group position={position}>
      <mesh
        onPointerDown={(e) => {
          e.stopPropagation();
          (e.target as any).setPointerCapture?.(e.pointerId);
          dragging.current = { design: useStore.getState().draft };
          setActive(true);
          if (controls) controls.enabled = false;
        }}
        onPointerMove={(e) => {
          if (!dragging.current) return;
          e.stopPropagation();
          const p = pointOnPlane(e);
          if (p) onDrag(p, dragging.current);
        }}
        onPointerUp={(e) => {
          (e.target as any).releasePointerCapture?.(e.pointerId);
          dragging.current = null;
          setActive(false);
          if (controls) controls.enabled = true;
        }}
        onPointerOver={() => {
          setHover(true);
          document.body.style.cursor = 'grab';
        }}
        onPointerOut={() => {
          setHover(false);
          document.body.style.cursor = '';
        }}
      >
        <sphereGeometry args={[size, 20, 16]} />
        <meshStandardMaterial color={active ? '#ffffff' : '#ffd23f'} emissive="#ffb000" emissiveIntensity={hover || active ? 0.9 : 0.5} />
      </mesh>
      <mesh ref={ring}>
        <torusGeometry args={[size * 1.5, size * 0.12, 8, 32]} />
        <meshBasicMaterial color="#ffd23f" transparent opacity={0.8} />
      </mesh>
      {(hover || active) && (
        <Label position={[0, size * 2.6, 0]} className="handle-hint" text={HINTS[kind]} z={20} />
      )}
    </group>
  );
}

/** Yellow grab-handles that let you reshape the machine right in 3D. */
export function Handles({ design }: { design: Design }) {
  const step = useStore((s) => s.step);
  const mode = useStore((s) => s.mode);
  const panel = useStore((s) => s.panel);
  const focus = useStore((s) => s.focus);
  const setDesign = useStore((s) => s.setDesign);
  const g = useMemo(() => geometry(design), [design]);
  const p = useMemo(() => {
    const a = startAngles(g);
    return pose(g, a.theta, a.phi, a.psi);
  }, [g]);
  if (mode !== 'build' || panel !== 'build' || focus === 'hook') return null;

  const L = g.La + g.Lb;
  const size = Math.max(L * 0.03, 0.006);
  const zf = Math.max(L * 0.045, 0.006); // just in front of the arm

  const handles: React.ReactNode[] = [];
  if (step === 'arm') {
    handles.push(
      <Handle
        key="tip"
        kind="tip"
        size={size}
        position={[p.tip[0], p.tip[1], zf]}
        onDrag={(pt, start) => {
          const sg = geometry(start.design);
          const sa = startAngles(sg);
          const dir = new THREE.Vector2(Math.cos(sa.theta), Math.sin(sa.theta));
          const La = Math.max(0.05, (pt.x - 0) * dir.x + (pt.y - sg.H) * dir.y);
          const r = start.design.pivotRatio;
          setDesign({ armLength: clampVar('armLength', (La * (r + 1)) / r, start.design) });
        }}
      />,
      <Handle
        key="pivot"
        kind="pivot"
        size={size}
        position={[0, g.H, zf * 1.8]}
        onDrag={(pt, start) => {
          const sg = geometry(start.design);
          const sa = startAngles(sg);
          const sp = pose(sg, sa.theta, sa.phi, sa.psi);
          const ax = sp.tip[0] - sp.shortEnd[0];
          const ay = sp.tip[1] - sp.shortEnd[1];
          const f = ((pt.x - sp.shortEnd[0]) * ax + (pt.y - sp.shortEnd[1]) * ay) / (ax * ax + ay * ay);
          const ratio = (1 - f) / Math.max(f, 1e-3);
          setDesign({ pivotRatio: Math.round(clampVar('pivotRatio', ratio, start.design) * 10) / 10 });
        }}
      />,
    );
  }
  if (step === 'tower') {
    handles.push(
      <Handle
        key="tower"
        kind="tower"
        size={size}
        position={[0, g.H + size * 3, zf * 1.8]}
        onDrag={(pt, start) => setDesign({ towerHeight: clampVar('towerHeight', pt.y - size * 3, start.design) })}
      />,
    );
  }
  if (step === 'weight' && g.hinged) {
    handles.push(
      <Handle
        key="hanger"
        kind="hanger"
        size={size}
        position={[p.cw[0], p.cw[1], g.cwSize / 2 + size]}
        onDrag={(pt, start) => {
          const sg = geometry(start.design);
          const sa = startAngles(sg);
          const sp = pose(sg, sa.theta, sa.phi, sa.psi);
          setDesign({ hangerLength: clampVar('hangerLength', sp.shortEnd[1] - pt.y, start.design) });
        }}
      />,
    );
  }
  if (step === 'sling') {
    handles.push(
      <Handle
        key="sling"
        kind="sling"
        size={size}
        position={[p.ball[0], p.ball[1] + g.r + size * 1.5, zf]}
        onDrag={(pt, start) => {
          const sg = geometry(start.design);
          const sa = startAngles(sg);
          const sp = pose(sg, sa.theta, sa.phi, sa.psi);
          const len = Math.hypot(pt.x - sp.tip[0], Math.max(pt.y - size * 1.5, sg.r) - sp.tip[1]);
          setDesign({ slingLength: clampVar('slingLength', len, start.design) });
        }}
      />,
    );
  }
  return <group>{handles}</group>;
}
