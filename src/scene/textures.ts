import * as THREE from 'three';

let wood: THREE.CanvasTexture | null = null;
let woodDark: THREE.CanvasTexture | null = null;
let grass: THREE.CanvasTexture | null = null;

function rand(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function makeWood(base: [number, number, number], seed: number) {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 64;
  const ctx = c.getContext('2d')!;
  const r = rand(seed);
  ctx.fillStyle = `rgb(${base.join(',')})`;
  ctx.fillRect(0, 0, c.width, c.height);
  for (let i = 0; i < 60; i++) {
    const y = r() * c.height;
    const shade = (r() - 0.5) * 40;
    ctx.strokeStyle = `rgba(${base.map((v) => Math.max(0, Math.min(255, v + shade))).join(',')},0.55)`;
    ctx.lineWidth = 0.5 + r() * 2;
    ctx.beginPath();
    ctx.moveTo(0, y);
    for (let x = 0; x <= c.width; x += 16) ctx.lineTo(x, y + Math.sin(x * 0.03 + i) * 2 * r());
    ctx.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 4;
  return t;
}

export function woodTexture() {
  if (!wood) wood = makeWood([196, 146, 92], 7);
  return wood;
}

export function darkWoodTexture() {
  if (!woodDark) woodDark = makeWood([110, 76, 48], 13);
  return woodDark;
}

export function grassTexture() {
  if (!grass) {
    const c = document.createElement('canvas');
    c.width = c.height = 256;
    const ctx = c.getContext('2d')!;
    const r = rand(3);
    ctx.fillStyle = '#6fae4f';
    ctx.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 5000; i++) {
      const g = 140 + r() * 60;
      ctx.fillStyle = `rgba(${70 + r() * 40},${g},${50 + r() * 30},0.5)`;
      ctx.fillRect(r() * 256, r() * 256, 1 + r() * 2, 2 + r() * 4);
    }
    grass = new THREE.CanvasTexture(c);
    grass.colorSpace = THREE.SRGBColorSpace;
    grass.wrapS = grass.wrapT = THREE.RepeatWrapping;
    grass.anisotropy = 8;
  }
  return grass;
}
