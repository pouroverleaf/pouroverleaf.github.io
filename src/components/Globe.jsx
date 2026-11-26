import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { feature } from 'topojson-client';
import land110 from 'world-atlas/land-110m.json';
import { NARROW } from '../lib/layout';

const TEX_W = 2048;
const TEX_H = 1024;
const DOT_STEP = 5; // texels between land dots
const DOT_SIZE = 0.027; // world units; attenuates with distance so dots grow as you zoom
const MIN_DIST = 2.2;
const MAX_DIST = 7.2;
const DEG = Math.PI / 180;

// Texture: lon -180 at left edge, north at top. With SphereGeometry's default UVs this gives
// x = cos(lat)cos(lon), y = sin(lat), z = -cos(lat)sin(lon)  (lon 0 on +x, lon 90E on -z).
export function latLonToVec3(lat, lon, r = 1) {
  const c = Math.cos(lat * DEG);
  return new THREE.Vector3(r * c * Math.cos(lon * DEG), r * Math.sin(lat * DEG), -r * c * Math.sin(lon * DEG));
}

const project = ([lon, lat]) => [((lon + 180) / 360) * TEX_W, ((90 - lat) / 180) * TEX_H];

// world-atlas rings cross the antimeridian: unwrap longitudes; close pole-enclosing rings (Antarctica) via the pole.
export function unwrapRing(ring) {
  let off = 0;
  const out = ring.map((p, i) => {
    if (i) {
      const d = p[0] - ring[i - 1][0];
      if (d > 180) off -= 360;
      else if (d < -180) off += 360;
    }
    return [p[0] + off, p[1]];
  });
  if (off) {
    const pole = out.reduce((s, p) => s + p[1], 0) < 0 ? -90 : 90;
    out.push([out[out.length - 1][0], pole], [out[0][0], pole]);
  }
  return out;
}

let textureCanvas = null;
function getTextureCanvas() {
  if (textureCanvas) return textureCanvas;
  const mask = document.createElement('canvas');
  mask.width = TEX_W;
  mask.height = TEX_H;
  const m = mask.getContext('2d', { willReadFrequently: true });
  m.fillStyle = '#000';
  const geo = feature(land110, land110.objects.land);
  const geoms = geo.type === 'FeatureCollection' ? geo.features.map((f) => f.geometry) : [geo.geometry];
  for (const g of geoms) {
    const polys = g.type === 'Polygon' ? [g.coordinates] : g.coordinates;
    for (const rings of polys) {
      m.beginPath();
      for (const ring of rings.map(unwrapRing)) {
        for (const shift of [-360, 0, 360]) {
          ring.forEach(([lon, lat], i) => {
            const [x, y] = project([lon + shift, lat]);
            i ? m.lineTo(x, y) : m.moveTo(x, y);
          });
          m.closePath();
        }
      }
      m.fill('evenodd');
    }
  }
  const alpha = m.getImageData(0, 0, TEX_W, TEX_H).data;

  const c = document.createElement('canvas');
  c.width = TEX_W;
  c.height = TEX_H;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#FBF7F0';
  ctx.fillRect(0, 0, TEX_W, TEX_H);

  ctx.strokeStyle = 'rgba(29, 40, 71, 0.08)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let lon = -180; lon <= 180; lon += 30) {
    const x = Math.min(TEX_W - 0.5, Math.round(project([lon, 0])[0]) + 0.5);
    ctx.moveTo(x, 0);
    ctx.lineTo(x, TEX_H);
  }
  for (let lat = -60; lat <= 60; lat += 30) {
    const y = Math.round(project([0, lat])[1]) + 0.5;
    ctx.moveTo(0, y);
    ctx.lineTo(TEX_W, y);
  }
  ctx.stroke();

  // Land dots live in a point cloud (crisp at any zoom), sampled on the same equirectangular grid.
  const pts = [];
  for (let y = DOT_STEP / 2; y < TEX_H; y += DOT_STEP) {
    for (let x = DOT_STEP / 2; x < TEX_W; x += DOT_STEP) {
      if (alpha[((y | 0) * TEX_W + (x | 0)) * 4 + 3] > 127) {
        const v = latLonToVec3(90 - (y / TEX_H) * 180, (x / TEX_W) * 360 - 180, 1.002);
        pts.push(v.x, v.y, v.z);
      }
    }
  }
  landDots = new Float32Array(pts);
  textureCanvas = c;
  return c;
}

let landDots = null;
function getLandDots() {
  if (!landDots) getTextureCanvas();
  return landDots;
}

let dotSprite = null;
function getDotSprite() {
  if (dotSprite) return dotSprite;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(32, 32, 28, 0, Math.PI * 2);
  ctx.fill();
  dotSprite = new THREE.CanvasTexture(c);
  return dotSprite;
}

// Pins: a stem standing off the surface with a round head, plus a flat ring at the base used for the selection pulse.
const PIN_H = 0.05;
// Unit stem along +Z from 0 to 1; each pin scales z to its length and rotates toward its head.
const stemGeo = new THREE.CylinderGeometry(0.0035, 0.006, 1, 8);
stemGeo.rotateX(Math.PI / 2);
stemGeo.translate(0, 0, 0.5);
const headGeo = new THREE.SphereGeometry(0.015, 16, 12);
// Pins whose heads would overlap are clustered. Heads in a cluster fan out around the cluster
// centre, six to a ring; when a ring is full the next six sit one layer higher on taller stems.
const CLUSTER_ANGLE = 0.04; // rad between points that count as one cluster
const RING_R = 0.036; // tangential radius of a head ring
const RING_N = 6;
const LAYER_H = 0.038; // extra stem height per layer

function clusterPoints(items) {
  const clusters = [];
  for (const it of items) {
    let best = null, bestD = CLUSTER_ANGLE;
    for (const c of clusters) {
      const d = c.centre.angleTo(it.n);
      if (d < bestD) { best = c; bestD = d; }
    }
    if (best) {
      best.items.push(it);
      best.centre.add(it.n).normalize();
    } else clusters.push({ centre: it.n.clone(), items: [it] });
  }
  return clusters;
}

// World position of each head. Singletons sit straight above their point.
function headPositions(items) {
  const out = new Map();
  for (const c of clusterPoints(items)) {
    if (c.items.length === 1) {
      out.set(c.items[0], c.items[0].n.clone().multiplyScalar(1 + PIN_H));
      continue;
    }
    const up = c.centre;
    const e1 = new THREE.Vector3(0, 1, 0).cross(up).normalize();
    if (e1.lengthSq() < 1e-6) e1.set(1, 0, 0);
    const e2 = up.clone().cross(e1).normalize();
    c.items.forEach((it, j) => {
      const layer = Math.floor(j / RING_N), slot = j % RING_N;
      const a = (slot / RING_N) * Math.PI * 2 + layer * (Math.PI / RING_N);
      const h = PIN_H + layer * LAYER_H;
      out.set(it, up.clone().multiplyScalar(1 + h).addScaledVector(e1, RING_R * Math.cos(a)).addScaledVector(e2, RING_R * Math.sin(a)));
    });
  }
  return out;
}
const ringGeo = new THREE.RingGeometry(0.014, 0.019, 32);
const Z_AXIS = new THREE.Vector3(0, 0, 1);
const PICK_PX = 14; // pointer must be within this many CSS px of a head's centre on screen

// Is the segment from the camera to world point p blocked by the unit sphere at the origin?
function behindGlobe(p, cam) {
  const d = p.clone().sub(cam);
  const len = d.length();
  d.divideScalar(len);
  const b = cam.dot(d);
  const disc = b * b - (cam.lengthSq() - 1);
  if (disc < 0) return false;
  const t = -b - Math.sqrt(disc);
  return t > 0 && t < len;
}

export default function Globe({ active, points, color, selectedId, onSelect }) {
  const containerRef = useRef(null);
  const apiRef = useRef(null);
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;

  useEffect(() => {
    const container = containerRef.current;
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setClearColor(0x000000, 0);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    const canvas = renderer.domElement;
    canvas.style.display = 'block';
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    container.appendChild(canvas);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
    // Wide layout (canvas is the whole pane, 112vh tall): 5.7 puts the sphere at ~58% of the viewport height.
    // Narrow layout (a short box under the top bar): fit the sphere to ~82% of the box's shorter side.
    const cw = container.clientWidth || 1, ch = container.clientHeight || 1;
    const fitDist = innerWidth > NARROW ? 5.7 : 3.54 * Math.max(1, ch / cw);
    // Debug: ?look=lat,lon,distance starts the camera over a point. Bad values fall back.
    const look = (new URLSearchParams(location.search).get('look') || '').split(',').map(Number);
    const lat = Number.isFinite(look[0]) ? look[0] : 20;
    const lon = Number.isFinite(look[1]) ? look[1] : 10;
    const dist0 = THREE.MathUtils.clamp(Number.isFinite(look[2]) && look[2] > 0 ? look[2] : fitDist, MIN_DIST, MAX_DIST);
    camera.position.copy(latLonToVec3(lat, lon, dist0));
    scene.add(camera);

    scene.add(new THREE.HemisphereLight('#ffffff', '#EFE6D8', 3.0)); // near-flat sphere; the sun mostly shades the pins
    const sun = new THREE.DirectionalLight('#ffffff', 0.7);
    sun.position.set(-2, 2, 1.5);
    camera.add(sun);

    const globe = new THREE.Group();
    scene.add(globe);

    const texture = new THREE.CanvasTexture(getTextureCanvas());
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
    const sphereGeo = new THREE.SphereGeometry(1, 96, 64);
    const sphereMat = new THREE.MeshStandardMaterial({ map: texture, roughness: 1, metalness: 0 });
    const sphere = new THREE.Mesh(sphereGeo, sphereMat);
    globe.add(sphere);

    const dotsGeo = new THREE.BufferGeometry();
    dotsGeo.setAttribute('position', new THREE.BufferAttribute(getLandDots(), 3));
    const dotsMat = new THREE.PointsMaterial({
      map: getDotSprite(), color: '#69381D', size: DOT_SIZE, sizeAttenuation: true, alphaTest: 0.5, transparent: true,
    });
    globe.add(new THREE.Points(dotsGeo, dotsMat));


    const markerRoot = new THREE.Group();
    globe.add(markerRoot);
    let markers = [];
    let hovered = null;
    let selected = null;
    let selectedKey = null;

    const controls = new OrbitControls(camera, canvas);
    Object.assign(controls, {
      enablePan: false,
      enableZoom: false,
      enableDamping: true,
      dampingFactor: 0.08,
      minDistance: MIN_DIST,
      maxDistance: MAX_DIST,
      rotateSpeed: 0.6,
      autoRotate: true,
      autoRotateSpeed: 0.35,
    });

    let zoomTarget = camera.position.length();
    let tween = null;
    let resumeTimer = 0;
    const resumeLater = () => {
      clearTimeout(resumeTimer);
      const zoomedIn = zoomTarget < 4.2; // keep a zoomed-in view still for longer
      resumeTimer = setTimeout(() => {
        controls.autoRotate = selectedKey == null;
      }, zoomedIn ? 3000 : 900);
    };
    const pause = () => {
      controls.autoRotate = false;
      clearTimeout(resumeTimer);
    };

    const raycaster = new THREE.Raycaster();
    const ndc = new THREE.Vector2();
    const pick = (e, targets) => {
      const r = canvas.getBoundingClientRect();
      ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      raycaster.setFromCamera(ndc, camera);
      return raycaster.intersectObjects(targets, false)[0] || null;
    };
    // Nearest visible head within PICK_PX of the pointer, measured on screen. Heads in a cluster
    // sit closer together than any usable hit sphere, so picking is done in 2D instead.
    const headPos = new THREE.Vector3();
    const pickMarker = (e) => {
      const r = canvas.getBoundingClientRect();
      const px = e.clientX - r.left, py = e.clientY - r.top;
      let best = null, bestD = PICK_PX * PICK_PX;
      for (const m of markers) {
        m.head.getWorldPosition(headPos);
        if (behindGlobe(headPos, camera.position)) continue;
        headPos.project(camera);
        if (headPos.z > 1) continue;
        const sx = ((headPos.x + 1) / 2) * r.width, sy = ((1 - headPos.y) / 2) * r.height;
        const d = (sx - px) ** 2 + (sy - py) ** 2;
        if (d < bestD) { best = m; bestD = d; }
      }
      return best;
    };

    let down = null;
    // Touch: only a finger that lands on the sphere rotates the globe. Elsewhere on the canvas the
    // gesture is left to the window handlers in App.jsx, which drag the pane. Runs in the capture
    // phase so it precedes OrbitControls' own pointerdown listener.
    const onPointerDownCapture = (e) => {
      if (e.pointerType === 'touch') controls.enabled = !!pick(e, [sphere]);
      else controls.enabled = true;
    };
    const onTouchStart = (e) => {
      const t = e.touches[0];
      if (e.touches.length === 1 && t && pick(t, [sphere])) e.stopPropagation();
    };
    const onPointerDown = (e) => {
      if (!controls.enabled) return;
      down = { x: e.clientX, y: e.clientY };
      tween = null;
      pause();
    };
    const onPointerUp = (e) => {
      resumeLater();
      if (!down) return;
      const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y);
      down = null;
      if (moved > 4) return;
      const m = pickMarker(e);
      onSelectRef.current?.(m ? m.point : null);
    };
    const onPointerMove = (e) => {
      hovered = e.buttons ? null : pickMarker(e);
      canvas.style.cursor = hovered ? 'pointer' : '';
    };
    const onPointerLeave = () => {
      hovered = null;
      canvas.style.cursor = '';
    };
    const onPointerCancel = () => {
      down = null;
      resumeLater();
    };
    // Plain wheel scrolls the page (App.jsx) wherever the mouse is; zoom is trackpad pinch or
    // ctrl+wheel (browsers report a pinch as a wheel event with ctrlKey).
    const onWheel = (e) => {
      if (!e.ctrlKey || !pick(e, [sphere])) return;
      e.preventDefault();
      e.stopPropagation();
      const dy = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaMode === 2 ? e.deltaY * 400 : e.deltaY;
      zoomTarget = THREE.MathUtils.clamp(zoomTarget * Math.exp(THREE.MathUtils.clamp(dy, -40, 40) * 0.006), MIN_DIST, MAX_DIST);
      pause();
      resumeLater();
    };
    canvas.addEventListener('pointerdown', onPointerDownCapture, true);
    canvas.addEventListener('touchstart', onTouchStart, { passive: true });
    canvas.addEventListener('pointerdown', onPointerDown);
    canvas.addEventListener('pointerup', onPointerUp);
    canvas.addEventListener('pointermove', onPointerMove);
    canvas.addEventListener('pointerleave', onPointerLeave);
    canvas.addEventListener('pointercancel', onPointerCancel);
    canvas.addEventListener('wheel', onWheel, { passive: false });

    const ro = new ResizeObserver(() => {
      const w = container.clientWidth;
      const h = container.clientHeight;
      if (!w || !h) return;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      if (!raf) renderer.render(scene, camera);
    });
    ro.observe(container);

    const sph = new THREE.Spherical();
    let raf = 0;
    let lastFrame = 0;
    const frame = () => {
      raf = requestAnimationFrame(frame);
      const nowMs = performance.now();
      const t = nowMs / 1000;
      // Time step so auto-rotate and the easings below run at the same speed on 60 and 120 Hz displays.
      const dt = lastFrame ? Math.min(0.05, (nowMs - lastFrame) / 1000) : 1 / 60;
      lastFrame = nowMs;
      const ease = (k) => 1 - Math.exp(-dt * k); // per-frame fraction equivalent to 0.2–0.25 at 60 Hz
      controls.update(dt);

      const dist = camera.position.length();
      if (Math.abs(dist - zoomTarget) > 1e-4) camera.position.setLength(dist + (zoomTarget - dist) * ease(13));

      if (tween) {
        const k = Math.min(1, (performance.now() - tween.start) / 800);
        const e = k < 0.5 ? 4 * k * k * k : 1 - (-2 * k + 2) ** 3 / 2;
        sph.set(
          camera.position.length(),
          tween.from.phi + (tween.to.phi - tween.from.phi) * e,
          tween.from.theta + tween.dTheta * e,
        );
        camera.position.setFromSpherical(sph);
        camera.lookAt(controls.target);
        if (k >= 1) tween = null;
      }

      const pulse = 0.35 + 0.35 * (0.5 + 0.5 * Math.sin(t * 4));
      for (const m of markers) {
        const s = m === hovered ? 1.5 : 1;
        m.group.scale.setScalar(m.group.scale.x + (s - m.group.scale.x) * ease(17));
        const rs = m === selected ? 2.5 : 1;
        m.ring.scale.setScalar(m.ring.scale.x + (rs - m.ring.scale.x) * ease(13));
        m.ring.material.opacity = m === selected ? pulse : 0.6;
      }
      renderer.render(scene, camera);
    };

    const clearMarkers = () => {
      for (const m of markers) {
        m.stem.material.dispose();
        m.head.material.dispose();
        m.ring.material.dispose();
      }
      markerRoot.clear();
      markers = [];
      hovered = null;
      selected = null;
    };

    const select = (id) => {
      selectedKey = id ?? null;
      selected = markers.find((m) => m.point.id === selectedKey) || null;
      if (!selected) {
        if (!controls.autoRotate) resumeLater();
        return;
      }
      pause();
      const dir = selected.group.getWorldPosition(new THREE.Vector3());
      const from = new THREE.Spherical().setFromVector3(camera.position);
      const to = new THREE.Spherical().setFromVector3(dir);
      to.phi = THREE.MathUtils.clamp(to.phi, 0.15, Math.PI - 0.15);
      let dTheta = to.theta - from.theta;
      dTheta = Math.atan2(Math.sin(dTheta), Math.cos(dTheta));
      tween = { start: performance.now(), from, to, dTheta };
    };

    apiRef.current = {
      setActive(on) {
        if (on && !raf) {
          frame();
        } else if (!on && raf) {
          cancelAnimationFrame(raf);
          raf = 0;
        }
      },
      setPoints(pts, col) {
        clearMarkers();
        const items = (pts || []).map((point) => ({ point, n: latLonToVec3(point.lat, point.lon) }));
        const heads = headPositions(items);
        for (const it of items) {
          const { point, n } = it;
          const group = new THREE.Group();
          group.position.copy(n).multiplyScalar(1.003);
          group.quaternion.setFromUnitVectors(Z_AXIS, n);
          // head position in the pin's local frame (+Z = outward)
          const local = heads.get(it).clone().sub(group.position).applyQuaternion(group.quaternion.clone().invert());
          const len = local.length();
          const dir = local.clone().normalize();
          const pc = point.color || col;
          const stem = new THREE.Mesh(stemGeo, new THREE.MeshStandardMaterial({ color: '#1D2847', roughness: 0.6 }));
          stem.quaternion.setFromUnitVectors(Z_AXIS, dir);
          stem.scale.z = len;
          const head = new THREE.Mesh(headGeo, new THREE.MeshStandardMaterial({ color: pc, roughness: 0.45 }));
          head.position.copy(local);
          const ring = new THREE.Mesh(
            ringGeo,
            new THREE.MeshBasicMaterial({ color: pc, side: THREE.DoubleSide, transparent: true, opacity: 0.6, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }),
          );
          ring.position.z = 0.0005;
          group.add(stem, head, ring);
          markerRoot.add(group);
          markers.push({ point, group, stem, head, ring });
        }
        selected = markers.find((m) => m.point.id === selectedKey) || null;
        if (!raf) renderer.render(scene, camera);
      },
      select,
    };

    return () => {
      cancelAnimationFrame(raf);
      raf = 0;
      clearTimeout(resumeTimer);
      ro.disconnect();
      canvas.removeEventListener('pointerdown', onPointerDownCapture, true);
      canvas.removeEventListener('touchstart', onTouchStart);
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('pointerup', onPointerUp);
      canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('pointerleave', onPointerLeave);
      canvas.removeEventListener('pointercancel', onPointerCancel);
      canvas.removeEventListener('wheel', onWheel);
      controls.dispose();
      clearMarkers();
      sphereGeo.dispose();
      sphereMat.dispose();
      dotsGeo.dispose();
      dotsMat.dispose();
      texture.dispose();
      renderer.dispose();
      renderer.forceContextLoss(); // free the WebGL context now rather than at GC (StrictMode remounts, HMR)
      canvas.remove();
      apiRef.current = null;
    };
  }, []);

  useEffect(() => {
    apiRef.current?.setPoints(points, color);
  }, [points, color]);

  useEffect(() => {
    apiRef.current?.select(selectedId);
  }, [selectedId]);

  useEffect(() => {
    apiRef.current?.setActive(active);
  }, [active]);

  return <div className="globe" ref={containerRef} style={{ position: 'relative', width: '100%', height: '100%' }} />;
}
