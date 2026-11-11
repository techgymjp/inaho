// イラスト調（セルシェーディング）の共通設定
import * as THREE from 'three';

// 4段階の陰影（影・中間・明・ハイライト）
const data = new Uint8Array([90, 150, 215, 255]);
export const gradientMap = new THREE.DataTexture(data, data.length, 1, THREE.RedFormat);
gradientMap.minFilter = gradientMap.magFilter = THREE.NearestFilter;
gradientMap.needsUpdate = true;

export function toon(params = {}) {
  const p = { ...params };
  delete p.roughness; delete p.metalness; delete p.flatShading;
  if (typeof p.color === 'string') p.color = new THREE.Color(p.color);
  return new THREE.MeshToonMaterial({ gradientMap, ...p });
}
export const hex = (h) => new THREE.Color(h);
