import { useFrame, useThree } from '@react-three/fiber';
import { useEffect } from 'react';
import * as THREE from 'three';
import { geometry, pose, startAngles } from '../physics/geometry';
import type { Design } from '../physics/types';
import { useStore } from '../state/store';
import { frameAt, simEndTime } from './playback';
import { releasePreview } from './preview';

/** Moves the playback clock forward, with automatic slow motion during the swing. */
export function PlaybackClock({ design }: { design: Design }) {
  useFrame((_, delta) => {
    const s = useStore.getState();
    if (s.mode !== 'throw' || !s.playing || !s.sim || s.sim.frames.length === 0) return;
    const dt = Math.min(delta, 0.05);
    const g = geometry(design);
    const end = simEndTime(s.sim);
    const rel = s.sim.releaseIndex >= 0 ? s.sim.frames[s.sim.releaseIndex].t : end;
    // Make the swing last about 2.5 seconds on screen, then ease into real speed for the flight.
    const slow = Math.min(1, Math.max(0.04, rel / 2.5));
    let rate = 1;
    if (s.slowSwing) {
      const blend = Math.min(1, Math.max(0, (s.playTime - rel) / (0.6 * g.tScale)));
      rate = slow + (1 - slow) * blend;
    }
    const t = s.playTime + dt * rate * s.speed;
    if (t >= end) {
      s.setPlayTime(end);
      s.setPlaying(false);
    } else s.setPlayTime(t);
  });
  return null;
}

const DIR_BUILD = new THREE.Vector3(0.45, 0.32, 1).normalize();
const DIR_THROW = new THREE.Vector3(0.12, 0.18, 1).normalize();
const DIR_HOOK = new THREE.Vector3(0.05, 0.12, 1).normalize(); // nearly side-on so the hook's angle reads true
const tmpTarget = new THREE.Vector3();
const tmpPos = new THREE.Vector3();

/** Keeps the machine (and the flying ball) in view until you grab the camera yourself. */
export function CameraRig({ design }: { design: Design }) {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  const controls = useThree((s) => s.controls) as any;
  const size = useThree((s) => s.size);

  useEffect(() => {
    if (!controls) return;
    const onStart = () => useStore.getState().setAutoCam(false);
    controls.addEventListener('start', onStart);
    return () => controls.removeEventListener('start', onStart);
  }, [controls]);

  useFrame((_, delta) => {
    const s = useStore.getState();
    const g = geometry(design);
    const L = g.La + g.Lb;

    // Box (in the x-y plane) that must fit on screen
    const a = startAngles(g);
    const p = pose(g, a.theta, a.phi, a.psi);
    let x0 = Math.min(-g.Lb - g.cwSize, -g.H * 0.7, p.tip[0]);
    let x1 = Math.max(g.La * 0.6, p.ball[0] + g.r, g.H * 0.7);
    let y0 = 0;
    let y1 = g.H + Math.max(g.Lb, g.La * 0.4);
    let dir = DIR_BUILD;

    if (s.mode === 'throw' && s.sim && s.sim.frames.length) {
      dir = DIR_THROW;
      const f = frameAt(s.sim, s.playTime);
      x0 = Math.min(x0, -L * 0.7);
      x1 = Math.max(x1, L * 0.9);
      y1 = Math.max(y1, g.H + g.La + g.Ls * 0.5);
      if (f.released) {
        const r = s.sim.results;
        const landed = s.sim.landIndex >= 0 && s.playTime >= s.sim.frames[s.sim.landIndex].t;
        if (r && landed) {
          // Whole flight path in view
          x0 = Math.min(x0, r.distance - L * 0.2);
          x1 = Math.max(x1, r.distance + L * 0.3, r.apex.x + L * 0.3);
          y1 = Math.max(y1, r.maxHeight * 1.1);
        } else {
          // Follow the ball, looking a little ahead so it never flies off screen
          const ahead = frameAt(s.sim, s.playTime + Math.max(0.2 * g.tScale, (r?.flightTime ?? 1) * 0.15));
          x0 = Math.min(x0, f.bx - L * 0.3, ahead.bx - L * 0.3);
          x1 = Math.max(x1, f.bx + L * 0.4, ahead.bx + L * 0.4);
          y1 = Math.max(y1, f.by + L * 0.3, ahead.by + L * 0.3);
          if (r && f.bx >= r.apex.x) y1 = Math.max(y1, r.maxHeight * 1.1);
        }
      }
    } else if (s.mode === 'build' && s.focus === 'hook') {
      // Zoom in on the arm tip at the moment the ball lets go: hook, sling, ball and launch arrow.
      dir = DIR_HOOK;
      const pv = releasePreview(design);
      const pts: [number, number][] = [];
      if (pv.ok) {
        const pr = pose(g, pv.theta, pv.phi, pv.psi);
        const sp = Math.hypot(pv.vx, pv.vy) || 1;
        pts.push(pr.tip, pr.ball, [pv.bx + (pv.vx / sp) * L * 0.42, pv.by + (pv.vy / sp) * L * 0.42]);
      } else {
        pts.push(p.tip, [p.tip[0], p.tip[1] + L * 0.2]);
      }
      const pad = Math.max(L * 0.12, 0.04);
      x0 = Math.min(...pts.map((q) => q[0])) - pad;
      x1 = Math.max(...pts.map((q) => q[0])) + pad;
      y0 = Math.max(0, Math.min(...pts.map((q) => q[1])) - pad);
      y1 = Math.max(...pts.map((q) => q[1])) + pad;
    } else if (s.mode === 'build' && s.demoArcs) {
      for (const a of s.demoArcs) {
        x0 = Math.min(x0, a.distance - L * 0.2);
        x1 = Math.max(x1, a.distance * 1.05);
        y1 = Math.max(y1, a.maxHeight * 1.08);
      }
    } else if (s.mode === 'build' && s.panel === 'compare') {
      for (const v of s.versions) {
        if (!s.compareIds.includes(v.id) || !v.results) continue;
        x1 = Math.max(x1, v.results.distance * 1.05);
        y1 = Math.max(y1, v.results.maxHeight * 1.05);
      }
    }

    const fov = THREE.MathUtils.degToRad(camera.fov);
    const aspect = size.width / Math.max(1, size.height);
    const halfW = (x1 - x0) / 2;
    const halfH = (y1 - y0) / 2;
    const fitH = halfH / Math.tan(fov / 2);
    const fitW = halfW / (Math.tan(fov / 2) * aspect);
    const zoomed = s.mode === 'build' && s.focus === 'hook';
    const margin = zoomed ? 1.1 : s.mode === 'build' ? 1.45 : 1.2;
    const dist = Math.max(fitH, fitW) * margin + (zoomed ? 0 : L * 0.3);

    tmpTarget.set((x0 + x1) / 2, (y0 + y1) / 2, 0);
    tmpPos.copy(tmpTarget).addScaledVector(dir, dist);

    // Keep depth precision good at every scale (tiny LEGO build or a giant castle).
    const camDist = camera.position.distanceTo(controls?.target ?? tmpTarget);
    const near = Math.max(0.002, Math.min(camDist, dist) / 400);
    const far = Math.max(camDist, dist) * 60 + 100;
    if (Math.abs(camera.near - near) / near > 0.2 || Math.abs(camera.far - far) / far > 0.2) {
      camera.near = near;
      camera.far = far;
      camera.updateProjectionMatrix();
    }

    if (!s.autoCam || !controls) return;
    const k = 1 - Math.exp(-delta * 3.5);
    controls.target.lerp(tmpTarget, k);
    camera.position.lerp(tmpPos, k);
  });
  return null;
}
