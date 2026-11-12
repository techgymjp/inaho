// 季節の花：桜・菜の花（春）、紫陽花（初夏）、ひまわり（夏）、コスモス・紅葉（秋）
import * as THREE from 'three';
import { makeNoise } from './noise.js';
import { toon, hex } from './toon.js';
import { smooth, doyOf } from './calendar.js';
import { terrainHeight, mergeGeos, RAIL_Z } from './landscape.js';

const N = makeNoise(2468);
const D = doyOf;
// 咲き始め〜満開〜散るまでの開花度 0..1
const bloom = (t, a, b, c, d) => smooth(a, b, t) * (1 - smooth(c, d, t));

function inst(geo, mat, list, setup) {
  const m = new THREE.InstancedMesh(geo, mat, list.length);
  const o = new THREE.Object3D();
  list.forEach((p, i) => { setup(o, p, i); o.updateMatrix(); m.setMatrixAt(i, o.matrix); });
  m.castShadow = false; m.receiveShadow = true;
  return m;
}

// 各インスタンスをその場で拡大縮小する（メッシュ全体の scale は原点基準でずれるため）
function scaler(mesh) {
  const n = mesh.count, base = [];
  const m4 = new THREE.Matrix4(), p = new THREE.Vector3(), q = new THREE.Quaternion(), sc = new THREE.Vector3();
  for (let i = 0; i < n; i++) { mesh.getMatrixAt(i, m4); m4.decompose(p, q, sc); base.push([p.clone(), q.clone(), sc.clone()]); }
  let last = '';
  return (sxz, sy = sxz) => {
    const key = sxz.toFixed(2) + '|' + sy.toFixed(2);
    if (key === last) return;
    last = key;
    for (let i = 0; i < n; i++) {
      const [bp, bq, bs] = base[i];
      m4.compose(bp, bq, sc.set(bs.x * sxz, bs.y * sy, bs.z * sxz));
      mesh.setMatrixAt(i, m4);
    }
    mesh.instanceMatrix.needsUpdate = true;
  };
}

export function createFlowers(scene) {
  const group = new THREE.Group();
  scene.add(group);
  const items = []; // { update(t) }

  // ---------- 桜並木（線路沿い） ----------
  {
    const trees = [];
    for (let x = -260; x <= 260; x += 26 + N.rnd() * 18) trees.push([x, RAIL_Z - 14 - N.rnd() * 4]);
    const trunkGeo = mergeGeos([
      new THREE.CylinderGeometry(0.25, 0.45, 3.2, 6).translate(0, 1.6, 0),
      new THREE.CylinderGeometry(0.12, 0.22, 3.5, 5).rotateZ(0.7).translate(1.0, 3.8, 0),
      new THREE.CylinderGeometry(0.12, 0.22, 3.5, 5).rotateZ(-0.7).translate(-1.0, 3.8, 0),
    ]);
    const trunks = inst(trunkGeo, toon({ color: '#3a2c26' }), trees, (o, [x, z]) => { o.position.set(x, terrainHeight(x, z), z); o.rotation.y = N.rnd() * 6; o.scale.setScalar(1.1 + N.rnd() * 0.3); });
    const puffs = [];
    trees.forEach(([x, z]) => { for (let k = 0; k < 9; k++) puffs.push([x + (N.rnd() - 0.5) * 7, z + (N.rnd() - 0.5) * 6, 4 + N.rnd() * 3]); });
    const crownMat = toon({ color: '#f5b8c8' });
    const crowns = inst(new THREE.IcosahedronGeometry(1.6, 1), crownMat, puffs, (o, [x, z, y]) => { o.position.set(x, terrainHeight(x, z) + y, z); o.scale.set(1 + N.rnd() * 0.4, 0.75, 1 + N.rnd() * 0.4); });
    group.add(trunks, crowns);
    const sCrown = scaler(crowns);
    const leaf = hex('#3f8a35'), pink = hex('#f6bccb'), red = hex('#c8582c');
    items.push({ update(t) {
      const b = bloom(t, D(4, 12), D(4, 17), D(4, 23), D(4, 29));
      const green = smooth(D(4, 25), D(5, 10), t) * (1 - smooth(D(10, 25), D(11, 15), t));
      const autumn = smooth(D(10, 10), D(10, 30), t);
      crownMat.color.copy(leaf).lerp(red, autumn * 0.8).lerp(pink, b);
      const vis = Math.max(b, green);
      crowns.visible = vis > 0.05;
      sCrown(0.6 + 0.4 * vis);
    } });
  }

  // ---------- 菜の花（線路の土手の両側） ----------
  {
    const pts = [];
    for (const side of [-1, 1]) for (let x = -420; x <= 420; x += 1.1) {
      for (let k = 0; k < 3; k++) pts.push([x + N.rnd() * 1.1, RAIL_Z + side * (4.2 + k * 1.3 + N.rnd() * 1.2)]);
    }
    const mat = toon({ color: '#f3d530' });
    const geo = new THREE.IcosahedronGeometry(0.45, 0).scale(1, 0.7, 1);
    const m = inst(geo, mat, pts, (o, [x, z]) => { o.position.set(x, terrainHeight(x, z) + 0.55, z); o.scale.setScalar(0.7 + N.rnd() * 0.6); });
    const v = 0.85; for (let i = 0; i < pts.length; i++) m.setColorAt(i, new THREE.Color(v + N.rnd() * 0.15, v + N.rnd() * 0.15, v));
    group.add(m);
    const sM = scaler(m);
    const y = hex('#f3d530'), g = hex('#7cae3e');
    items.push({ update(t) {
      const b = bloom(t, D(4, 12), D(4, 22), D(5, 10), D(5, 20));
      const leafy = bloom(t, D(3, 25), D(4, 10), D(5, 20), D(6, 5));
      mat.color.copy(g).lerp(y, b);
      m.visible = leafy > 0.05;
      sM(1, 0.3 + 0.7 * leafy);
    } });
  }

  // ---------- 紫陽花（用水路の北岸） ----------
  {
    const bushes = [];
    for (let x = -34; x <= 40; x += 1.6 + N.rnd() * 0.8) bushes.push([x, -29.4 - N.rnd() * 0.8]);
    const bushMat = toon({ color: '#3f7a34' });
    const bush = inst(new THREE.IcosahedronGeometry(0.75, 1).scale(1, 0.75, 1), bushMat, bushes, (o, [x, z]) => { o.position.set(x, terrainHeight(x, z) + 0.45, z); o.scale.setScalar(0.85 + N.rnd() * 0.4); });
    const balls = [];
    const palette = ['#5b7fd6', '#7a63c9', '#9a74d4', '#d77fae', '#6e9be0', '#b07cd8'];
    bushes.forEach(([x, z], i) => { const c = palette[(i * 5 + Math.floor(N.rnd() * 2)) % palette.length]; for (let k = 0; k < 7; k++) balls.push([x + (N.rnd() - 0.5) * 1.3, z + (N.rnd() - 0.5) * 0.9, 0.6 + N.rnd() * 0.45, c]); });
    const flowerMat = toon({ color: '#ffffff' });
    const flowers = inst(new THREE.IcosahedronGeometry(0.24, 1), flowerMat, balls, (o, [x, z, y]) => { o.position.set(x, terrainHeight(x, z) + y, z); o.scale.setScalar(0.8 + N.rnd() * 0.5); });
    balls.forEach((b, i) => flowers.setColorAt(i, hex(b[3])));
    group.add(bush, flowers);
    const sBush = scaler(bush);
    const winter = hex('#6b5a44'), green = hex('#3f7a34');
    items.push({ update(t) {
      const b = bloom(t, D(6, 8), D(6, 20), D(7, 15), D(7, 28));
      const leafy = smooth(D(4, 20), D(5, 15), t) * (1 - smooth(D(11, 1), D(11, 20), t));
      bushMat.color.copy(winter).lerp(green, leafy);
      sBush(0.55 + 0.45 * leafy);
      bush.visible = leafy > 0.25;
      flowers.visible = b > 0.03;
      flowerMat.color.setScalar(0.5 + 0.5 * b).lerp(hex('#9aa86a'), 1 - Math.min(1, b * 2)); // 咲き始めは緑がかる
    } });
  }

  // ---------- ひまわり畑（田んぼの北東） ----------
  {
    const plants = [];
    for (let x = 18; x <= 52; x += 1.0) for (let z = -62; z >= -98; z -= 0.9) plants.push([x + (N.rnd() - 0.5) * 0.4, z + (N.rnd() - 0.5) * 0.4, 1.6 + N.rnd() * 0.6]);
    const stemMat = toon({ color: '#4f8a2e' });
    const stemGeo = mergeGeos([
      new THREE.CylinderGeometry(0.025, 0.035, 1, 4).translate(0, 0.5, 0),
      new THREE.IcosahedronGeometry(0.16, 0).scale(1.3, 0.25, 0.8).translate(0.12, 0.45, 0),
      new THREE.IcosahedronGeometry(0.16, 0).scale(1.3, 0.25, 0.8).translate(-0.12, 0.65, 0),
    ]);
    const stems = inst(stemGeo, stemMat, plants, (o, [x, z, h]) => { o.position.set(x, terrainHeight(x, z), z); o.scale.set(1, h, 1); });
    // 花：花びらの輪と茶色の中心。東（日の出の方）を向く
    const petalMat = toon({ color: '#f6c51d' }), centerMat = toon({ color: '#4a2f17' });
    const petalGeo = new THREE.CylinderGeometry(0.24, 0.24, 0.02, 12).rotateZ(Math.PI / 2);
    const centerGeo = new THREE.CylinderGeometry(0.11, 0.11, 0.05, 10).rotateZ(Math.PI / 2).translate(0.015, 0, 0);
    const head = (o, [x, z, h]) => { o.position.set(x, terrainHeight(x, z) + h, z); o.rotation.set(0, (N.rnd() - 0.5) * 0.5, -0.25); o.scale.setScalar(0.9 + N.rnd() * 0.3); };
    const N2 = makeNoise(77); const R2 = N2.rnd;
    const petals = inst(petalGeo, petalMat, plants, head);
    // 同じ乱数列で中心も合わせる
    const centers = new THREE.InstancedMesh(centerGeo, centerMat, plants.length);
    for (let i = 0; i < plants.length; i++) { const mtx = new THREE.Matrix4(); petals.getMatrixAt(i, mtx); centers.setMatrixAt(i, mtx); }
    void R2;
    group.add(stems, petals, centers);
    const sStem = scaler(stems), sPet = scaler(petals), sCen = scaler(centers);
    items.push({ update(t) {
      const grow = smooth(D(6, 1), D(7, 20), t) * (1 - smooth(D(9, 5), D(9, 20), t));
      const b = bloom(t, D(7, 22), D(8, 1), D(8, 22), D(9, 2));
      stems.visible = grow > 0.03;
      sStem(1, Math.max(0.05, grow));
      petals.visible = centers.visible = b > 0.03;
      sPet(Math.max(0.05, b)); sCen(Math.max(0.05, b));
      stemMat.color.set('#4f8a2e').lerp(hex('#8a7a3a'), smooth(D(8, 25), D(9, 10), t));
    } });
  }

  // ---------- コスモス（用水路の北岸と線路沿い） ----------
  {
    const pts = [];
    for (let x = -60; x <= 60; x += 0.35) pts.push([x + N.rnd() * 0.3, -31.2 - N.rnd() * 2.5]);
    for (let x = -300; x <= 300; x += 0.9) pts.push([x + N.rnd() * 0.8, RAIL_Z + 9 + N.rnd() * 3]);
    const stemMat = toon({ color: '#5e9a3a' });
    const stems = inst(new THREE.CylinderGeometry(0.012, 0.02, 1, 3).translate(0, 0.5, 0), stemMat, pts, (o, [x, z]) => { o.position.set(x, terrainHeight(x, z), z); o.rotation.set((N.rnd() - 0.5) * 0.3, 0, (N.rnd() - 0.5) * 0.3); o.scale.set(1, 0.8 + N.rnd() * 0.7, 1); });
    const headMat = toon({ color: '#ffffff' });
    const heads = inst(new THREE.CylinderGeometry(0.09, 0.09, 0.015, 8), headMat, pts, (o, [x, z]) => { o.position.set(x, terrainHeight(x, z) + 0.85 + N.rnd() * 0.6, z); o.rotation.set((N.rnd() - 0.5) * 0.8, 0, (N.rnd() - 0.5) * 0.8); o.scale.setScalar(0.9 + N.rnd() * 0.5); });
    const cols = ['#f29cc0', '#e85d9e', '#ffffff', '#f7b6d0', '#c2387a'];
    pts.forEach((_, i) => heads.setColorAt(i, hex(cols[Math.floor(N.rnd() * cols.length)])));
    group.add(stems, heads);
    const sSt = scaler(stems), sHd = scaler(heads);
    items.push({ update(t) {
      const grow = smooth(D(7, 20), D(9, 1), t) * (1 - smooth(D(11, 1), D(11, 15), t));
      const b = bloom(t, D(9, 8), D(9, 20), D(10, 20), D(11, 1));
      stems.visible = grow > 0.03; sSt(1, Math.max(0.05, grow));
      heads.visible = b > 0.03; sHd(Math.max(0.05, b));
    } });
  }

  // ---------- 紅葉（モミジ：線路の向こうと集落のまわり） ----------
  {
    const trees = [[-120, RAIL_Z - 30], [-45, RAIL_Z - 24], [35, RAIL_Z - 28], [95, RAIL_Z - 22], [160, RAIL_Z - 32], [-70, -40], [-48, 30]];
    const trunks = inst(new THREE.CylinderGeometry(0.18, 0.3, 3, 5).translate(0, 1.5, 0), toon({ color: '#3b2d24' }), trees, (o, [x, z]) => { o.position.set(x, terrainHeight(x, z), z); o.scale.setScalar(1.2); });
    const puffs = [];
    trees.forEach(([x, z]) => { for (let k = 0; k < 6; k++) puffs.push([x + (N.rnd() - 0.5) * 5, z + (N.rnd() - 0.5) * 5, 3.6 + N.rnd() * 2.2]); });
    const mat = toon({ color: '#3f8a35' });
    const crowns = inst(new THREE.IcosahedronGeometry(1.5, 1), mat, puffs, (o, [x, z, y]) => { o.position.set(x, terrainHeight(x, z) + y, z); o.scale.set(1.1, 0.8, 1.1); });
    puffs.forEach((_, i) => { const v = 0.85 + N.rnd() * 0.3; crowns.setColorAt(i, new THREE.Color(v, v * (0.9 + N.rnd() * 0.2), v)); });
    group.add(trunks, crowns);
    const sCr = scaler(crowns);
    const green = hex('#3f8a35'), fresh = hex('#8cc85a'), orange = hex('#e0782a'), red = hex('#c8281e');
    items.push({ update(t) {
      const leafy = smooth(D(4, 20), D(5, 10), t) * (1 - smooth(D(11, 15), D(11, 28), t));
      const fr = bloom(t, D(4, 25), D(5, 5), D(5, 25), D(6, 15));
      const ko = smooth(D(10, 12), D(10, 28), t);
      const deep = smooth(D(10, 28), D(11, 10), t);
      mat.color.copy(green).lerp(fresh, fr).lerp(orange, ko).lerp(red, deep);
      crowns.visible = leafy > 0.05;
      sCr(0.5 + 0.5 * leafy);
    } });
  }

  // ---------- 柿の木（秋に橙色の実がなる。葉が落ちても実は残る） ----------
  {
    const trees = [[-56, 16], [-48, -2], [-60, -26], [-22, -37], [30, -38], [-8, RAIL_Z + 18], [62, RAIL_Z + 20], [6, -318], [46, -322]];
    const trunkGeo = mergeGeos([
      new THREE.CylinderGeometry(0.2, 0.32, 2.2, 6).translate(0, 1.1, 0),
      new THREE.CylinderGeometry(0.08, 0.16, 2.6, 5).rotateZ(0.65).translate(0.8, 2.8, 0),
      new THREE.CylinderGeometry(0.08, 0.16, 2.6, 5).rotateZ(-0.6).translate(-0.8, 2.9, 0.2),
      new THREE.CylinderGeometry(0.07, 0.14, 2.4, 5).rotateX(0.6).translate(0, 3.0, 0.7),
    ]);
    const trunks = inst(trunkGeo, toon({ color: '#3b2f28' }), trees, (o, [x, z]) => { o.position.set(x, terrainHeight(x, z), z); o.rotation.y = N.rnd() * 6; o.scale.setScalar(1.15); });
    const puffs = [], fruits = [];
    trees.forEach(([x, z]) => {
      const y0 = terrainHeight(x, z);
      for (let k = 0; k < 7; k++) puffs.push([x + (N.rnd() - 0.5) * 4.2, y0 + 3.6 + N.rnd() * 2.0, z + (N.rnd() - 0.5) * 4.2]);
      for (let k = 0; k < 45; k++) {
        const a = N.rnd() * Math.PI * 2, r = 1.2 + N.rnd() * 1.6;
        fruits.push([x + Math.cos(a) * r, y0 + 2.6 + N.rnd() * 3.0, z + Math.sin(a) * r]);
      }
    });
    const leafMat = toon({ color: '#2f6e2c' });
    const crowns = inst(new THREE.IcosahedronGeometry(1.35, 1), leafMat, puffs, (o, [x, y, z]) => { o.position.set(x, y, z); o.scale.set(1.1, 0.8, 1.1); });
    const fruitMat = toon({ color: '#e8761c' });
    const kaki = inst(new THREE.SphereGeometry(0.17, 8, 6).scale(1, 0.85, 1), fruitMat, fruits, (o, [x, y, z]) => { o.position.set(x, y, z); o.scale.setScalar(0.85 + N.rnd() * 0.35); });
    group.add(trunks, crowns, kaki);
    const sCrown = scaler(crowns);
    const green = hex('#2f6e2c'), fresh = hex('#8cc34e'), red = hex('#d0562a'), unripe = hex('#7f9a3a'), ripe = hex('#ee7a18');
    items.push({ update(t) {
      const leafy = smooth(D(4, 25), D(5, 15), t) * (1 - smooth(D(11, 8), D(11, 22), t));
      const ko = smooth(D(10, 18), D(11, 5), t);
      leafMat.color.copy(green).lerp(fresh, bloom(t, D(4, 28), D(5, 8), D(5, 25), D(6, 10))).lerp(red, ko);
      crowns.visible = leafy > 0.05; sCrown(0.5 + 0.5 * leafy);
      // 実：夏の終わりに青い実、10月に色づき、12月半ばまで枝に残る
      const has = smooth(D(8, 5), D(8, 25), t) * (1 - smooth(D(12, 10), D(12, 20), t));
      kaki.visible = has > 0.05;
      fruitMat.color.copy(unripe).lerp(ripe, smooth(D(9, 25), D(10, 20), t));
    } });
  }

  group.children.forEach(m => { m.frustumCulled = false; });
  return { group, update(t) { for (const it of items) it.update(t); } };
}
