import { OrbitControls, Sky } from '@react-three/drei';
import { Canvas } from '@react-three/fiber';
import { useMemo } from 'react';
import { geometry } from '../physics/geometry';
import { useStore } from '../state/store';
import { Handles } from './Handles';
import { CameraRig, PlaybackClock } from './Rig';
import { KidForScale, Trebuchet } from './Trebuchet';
import { DemoArcs, GhostArcs, Ground, LiveArc, useReach } from './World';

function Lights({ size }: { size: number }) {
  const s = Math.max(size, 1.5);
  return (
    <>
      <hemisphereLight args={['#dff1ff', '#5b7d3a', 0.9]} />
      <directionalLight
        position={[s * 1.5, s * 3, s * 2]}
        intensity={1.8}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-s * 1.5}
        shadow-camera-right={s * 1.5}
        shadow-camera-top={s * 1.5}
        shadow-camera-bottom={-s * 1.5}
        shadow-camera-near={0.01}
        shadow-camera-far={s * 10}
        shadow-bias={-0.0004}
        shadow-normalBias={s * 0.002}
      />
    </>
  );
}

export function Scene() {
  const realDraft = useStore((s) => s.draft);
  const demoDesign = useStore((s) => s.demoDesign);
  const demoArcs = useStore((s) => s.demoArcs);
  const draft = demoDesign ?? realDraft; // during a lesson demo, show the what-if build
  const versions = useStore((s) => s.versions);
  const compareIds = useStore((s) => s.compareIds);
  const showAllArcs = useStore((s) => s.showAllArcs);
  const panel = useStore((s) => s.panel);
  const mode = useStore((s) => s.mode);
  const simVersionId = useStore((s) => s.simVersionId);
  const g = useMemo(() => geometry(draft), [draft]);
  const L = g.La + g.Lb;
  const shown = useMemo(() => {
    if (showAllArcs) return versions;
    if (panel === 'compare') return versions.filter((v) => compareIds.includes(v.id));
    return [];
  }, [versions, compareIds, showAllArcs, panel]);
  const reach = useReach(draft, shown, demoArcs);
  const currentColor = versions.find((v) => v.id === simVersionId)?.color ?? '#ff7a1a';
  const flagSize = Math.max(reach * 0.06, L * 0.4);

  return (
    <Canvas
      shadows="percentage"
      dpr={[1, 2]}
      camera={{ fov: 42, position: [1, 1, 3], near: 0.01, far: 5000 }}
      gl={{ antialias: true }}
    >
      <color attach="background" args={['#bfe3ff']} />
      <Sky distance={4500} sunPosition={[50, 30, 80]} turbidity={6} rayleigh={1.2} mieCoefficient={0.004} mieDirectionalG={0.8} />
      <Lights size={L + g.H} />
      <Ground design={draft} reach={reach} />
      <Trebuchet design={draft} />
      <KidForScale design={draft} />
      <Handles design={draft} />
      <GhostArcs versions={shown} size={flagSize} skipId={mode === 'throw' ? simVersionId : null} />
      {demoArcs && <DemoArcs arcs={demoArcs} size={flagSize} />}
      <LiveArc color={currentColor} size={flagSize} />
      <PlaybackClock design={draft} />
      <CameraRig design={draft} />
      <OrbitControls makeDefault enableDamping dampingFactor={0.12} maxPolarAngle={Math.PI / 2 - 0.02} />
    </Canvas>
  );
}
