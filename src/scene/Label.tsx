import { useFrame, useThree } from '@react-three/fiber';
import { useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';

const v = new THREE.Vector3();

/**
 * A text tag that sits on top of the 3D view and follows a point in the scene.
 * Plain DOM (no extra React root), so labels can appear and disappear safely every frame.
 */
export function Label({
  position,
  text,
  className,
  color,
  z = 1,
}: {
  position: [number, number, number];
  text: string;
  className: string;
  color?: string;
  z?: number;
}) {
  const gl = useThree((s) => s.gl);
  const camera = useThree((s) => s.camera);
  const size = useThree((s) => s.size);
  const anchor = useRef<THREE.Group>(null);
  const [outer, inner] = useMemo(() => {
    const o = document.createElement('div');
    o.style.cssText = 'position:absolute;left:0;top:0;pointer-events:none;will-change:transform;display:none';
    const i = document.createElement('span');
    o.appendChild(i);
    return [o, i];
  }, []);

  useLayoutEffect(() => {
    const host = gl.domElement.parentElement;
    host?.appendChild(outer);
    return () => outer.remove();
  }, [gl, outer]);

  useLayoutEffect(() => {
    inner.className = className;
    inner.textContent = text;
    inner.style.borderColor = color ?? '';
    outer.style.zIndex = String(z);
  }, [inner, outer, className, text, color, z]);

  useFrame(() => {
    if (!anchor.current) return;
    anchor.current.getWorldPosition(v);
    v.project(camera);
    if (v.z > 1 || v.z < -1) {
      outer.style.display = 'none';
      return;
    }
    const x = (v.x * 0.5 + 0.5) * size.width;
    const y = (-v.y * 0.5 + 0.5) * size.height;
    outer.style.display = 'block';
    outer.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) translate(-50%, -50%)`;
  });

  return <group ref={anchor} position={position} />;
}
