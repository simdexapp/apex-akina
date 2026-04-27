import * as THREE from "three";
import { TRACKS } from "./tracks-data.js";

const ROAD_HALF_WIDTH = 7;
const SHOULDER = 1.0;
const SAMPLES = 480;

export function getTrackList() {
  return Object.entries(TRACKS).map(([id, t]) => ({ id, name: t.name, description: t.description, palette: t.palette }));
}

export function buildTrack(trackId = "akina") {
  const track = TRACKS[trackId] || TRACKS.akina;
  const curve = new THREE.CatmullRomCurve3(track.points, true, "catmullrom", 0.4);
  const points = curve.getSpacedPoints(SAMPLES);
  const tangents = [];
  for (let i = 0; i < SAMPLES; i++) {
    tangents.push(curve.getTangent(i / SAMPLES).normalize());
  }

  // Build a ribbon mesh by extruding a width vector perpendicular to each tangent.
  const positions = [];
  const colors = [];
  const indices = [];
  const up = new THREE.Vector3(0, 1, 0);
  const right = new THREE.Vector3();
  const innerColor = new THREE.Color("#1d222f");
  const altColor = new THREE.Color("#141823");
  for (let i = 0; i < SAMPLES; i++) {
    const p = points[i];
    const t = tangents[i];
    right.crossVectors(t, up).normalize();
    const lx = p.x + right.x * (ROAD_HALF_WIDTH + SHOULDER);
    const lz = p.z + right.z * (ROAD_HALF_WIDTH + SHOULDER);
    const rx = p.x - right.x * (ROAD_HALF_WIDTH + SHOULDER);
    const rz = p.z - right.z * (ROAD_HALF_WIDTH + SHOULDER);
    positions.push(lx, p.y, lz);
    positions.push(rx, p.y, rz);
    const c = i % 6 < 3 ? innerColor : altColor;
    colors.push(c.r, c.g, c.b, c.r, c.g, c.b);
  }
  for (let i = 0; i < SAMPLES; i++) {
    const j = (i + 1) % SAMPLES;
    const a = i * 2, b = i * 2 + 1, c = j * 2, d = j * 2 + 1;
    indices.push(a, b, c);
    indices.push(b, d, c);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  const mat = new THREE.MeshLambertMaterial({ vertexColors: true });
  const roadMesh = new THREE.Mesh(geo, mat);

  // Lane lines — create thin offset strips for each lane edge (4 lines for 5 lanes).
  const laneGroup = new THREE.Group();
  const laneCount = 5;
  for (let lane = 1; lane < laneCount; lane++) {
    const offset = -ROAD_HALF_WIDTH + (ROAD_HALF_WIDTH * 2) * (lane / laneCount);
    const linePts = [];
    for (let i = 0; i <= SAMPLES; i++) {
      const idx = i % SAMPLES;
      const p = points[idx];
      const t = tangents[idx];
      right.crossVectors(t, up).normalize();
      linePts.push(new THREE.Vector3(p.x + right.x * offset, p.y + 0.02, p.z + right.z * offset));
    }
    const lineGeo = new THREE.BufferGeometry().setFromPoints(linePts);
    const lineMat = new THREE.LineDashedMaterial({
      color: lane === Math.floor(laneCount / 2) ? 0xffd166 : 0xfbfdff,
      dashSize: 4,
      gapSize: 4,
      linewidth: 1
    });
    const line = new THREE.Line(lineGeo, lineMat);
    line.computeLineDistances();
    laneGroup.add(line);
  }

  // Kerb stripes — alternating red/white at the road edge.
  const kerbGroup = new THREE.Group();
  for (let i = 0; i < SAMPLES; i++) {
    const p = points[i];
    const t = tangents[i];
    right.crossVectors(t, up).normalize();
    for (const side of [1, -1]) {
      const offset = side * (ROAD_HALF_WIDTH + SHOULDER * 0.5);
      const cubeGeo = new THREE.BoxGeometry(0.6, 0.10, 1.4);
      const color = i % 2 === 0 ? track.palette.kerbA : track.palette.kerbB;
      const cubeMat = new THREE.MeshLambertMaterial({ color });
      const cube = new THREE.Mesh(cubeGeo, cubeMat);
      cube.position.set(p.x + right.x * offset, p.y + 0.05, p.z + right.z * offset);
      cube.rotation.y = Math.atan2(t.x, t.z);
      kerbGroup.add(cube);
    }
  }

  // Ground plane way below the track.
  const groundGeo = new THREE.PlaneGeometry(2000, 2000);
  const groundMat = new THREE.MeshLambertMaterial({ color: track.palette.ground });
  const ground = new THREE.Mesh(groundGeo, groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -10;

  // Trackside posts (every 8 samples, both sides).
  const postGroup = new THREE.Group();
  for (let i = 0; i < SAMPLES; i += 8) {
    const p = points[i];
    const t = tangents[i];
    right.crossVectors(t, up).normalize();
    for (const side of [1, -1]) {
      const offset = side * (ROAD_HALF_WIDTH + SHOULDER + 1.6);
      const postGeo = new THREE.BoxGeometry(0.2, 1.6, 0.2);
      const postMat = new THREE.MeshLambertMaterial({ color: 0x0c1322 });
      const post = new THREE.Mesh(postGeo, postMat);
      post.position.set(p.x + right.x * offset, p.y + 0.8, p.z + right.z * offset);
      postGroup.add(post);
      // Reflective top cap.
      const capGeo = new THREE.BoxGeometry(0.22, 0.06, 0.22);
      const capMat = new THREE.MeshBasicMaterial({ color: side > 0 ? 0x2ee9ff : 0xffd166 });
      const cap = new THREE.Mesh(capGeo, capMat);
      cap.position.set(p.x + right.x * offset, p.y + 1.65, p.z + right.z * offset);
      postGroup.add(cap);
    }
  }

  const group = new THREE.Group();
  group.add(ground);
  group.add(roadMesh);
  group.add(laneGroup);
  group.add(kerbGroup);
  group.add(postGroup);

  // Track length in world units.
  let length = 0;
  for (let i = 0; i < SAMPLES; i++) {
    const a = points[i];
    const b = points[(i + 1) % SAMPLES];
    length += a.distanceTo(b);
  }

  // Sample(t) returns a position along the loop at param t ∈ [0,1).
  function sample(t) {
    const idx = Math.floor(((t % 1 + 1) % 1) * SAMPLES);
    const p = points[idx];
    const tang = tangents[idx];
    return {
      x: p.x,
      y: p.y,
      z: p.z,
      tangentAngle: Math.atan2(tang.x, tang.z)
    };
  }

  // Project a world position onto the track centerline. Returns { s, lateral } where
  // s is arclength position [0, length) and lateral is signed offset from centerline.
  function project(pos) {
    let bestI = 0;
    let bestDist = Infinity;
    for (let i = 0; i < SAMPLES; i++) {
      const dx = points[i].x - pos.x;
      const dz = points[i].z - pos.z;
      const d = dx * dx + dz * dz;
      if (d < bestDist) { bestDist = d; bestI = i; }
    }
    const s = (bestI / SAMPLES) * length;
    const t = tangents[bestI];
    const r = new THREE.Vector3().crossVectors(t, up).normalize();
    const dx = pos.x - points[bestI].x;
    const dz = pos.z - points[bestI].z;
    const lateral = dx * r.x + dz * r.z;
    return { s, lateral, segmentIndex: bestI };
  }

  return {
    id: trackId,
    name: track.name,
    palette: track.palette,
    group,
    sample,
    project,
    length,
    halfWidth: ROAD_HALF_WIDTH,
    points,
    tangents,
    controlPoints: track.points
  };
}
