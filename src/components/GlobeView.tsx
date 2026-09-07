import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Globe, { type GlobeMethods } from "react-globe.gl";
import * as THREE from "three";
import { categoryColor } from "../colors";
import { formatDate } from "../filters";
import { resolveGlobeStyle } from "../globeStyles";
import { useElementSize } from "../hooks/useElementSize";
import type { Checkin } from "../types";

interface Props {
  checkins: Checkin[];
  selected: Checkin | null;
  /** Current check-in during play mode; gets a stronger pulsing ring. */
  playTarget: Checkin | null;
  playing: boolean;
  /** User marker-size multiplier (1 = default). */
  pointScale: number;
  /** Globe surface style id (see globeStyles.ts). */
  styleId: string;
  onSelect: (c: Checkin | null) => void;
}

const DEFAULT_ALTITUDE = 2.2;

// Markers are baked onto the surface (r = globe radius) and then lifted a hair
// via a uniform scale so they clear the map tiles without z-fighting. The lift
// is tied to how far the camera sits above the surface: zoomed out it's the full
// MARKER_ALTITUDE (markers visibly rest on the globe); zoomed in it shrinks
// toward MIN_MARKER_ALTITUDE so a marker never floats noticeably off the spot it
// marks. This keeps the apparent parallax ~1 degree at every zoom level.
const MARKER_ALTITUDE = 0.006;
const MIN_MARKER_ALTITUDE = 0.0002;
const LIFT_PER_HEIGHT = 0.0002; // lift fraction per globe-radius of camera height

function surfaceLift(camDistFromCenter: number): number {
  const h = Math.max(camDistFromCenter - 100, 0); // camera height above surface
  return Math.min(
    MARKER_ALTITUDE,
    Math.max(MIN_MARKER_ALTITUDE, LIFT_PER_HEIGHT * h),
  );
}

// All check-in markers are drawn as one GPU point cloud (THREE.Points): a single
// draw call for the whole history, and — with sizeAttenuation off — a constant
// on-screen size regardless of zoom. So markers never balloon when you zoom into
// a dense area; the cluster just spreads out into individual dots.
const BASE_MARKER_PX = 7; // on-screen diameter (CSS px) at marker-size 1
const SELECTED_MARKER_PX = 16;
const MARKER_OPACITY = 0.85;
const HIT_SLOP_PX = 4; // pick tolerance beyond the drawn marker radius

const AUTO_ROTATE = false;
const AUTO_ROTATE_SPEED = 0.35;

const NIGHT_SKY = `${import.meta.env.BASE_URL}textures/night-sky.png`;

/** Soft white disc so overlapping markers blend rather than hard-edge. */
const DISC_TEXTURE = (() => {
  const size = 64;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, "rgba(255,255,255,1)");
  g.addColorStop(0.5, "rgba(255,255,255,1)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
})();

const _c = new THREE.Color();

/** (Re)fill a point cloud's geometry from a check-in list. */
function fillCloud(pts: THREE.Points, checkins: Checkin[]): void {
  const n = checkins.length;
  const positions = new Float32Array(n * 3);
  const colors = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const c = checkins[i];
    const { x, y, z } = polarToCartesian(c.lat, c.lng, 0);
    positions[i * 3] = x;
    positions[i * 3 + 1] = y;
    positions[i * 3 + 2] = z;
    _c.set(categoryColor(c.category));
    colors[i * 3] = _c.r;
    colors[i * 3 + 1] = _c.g;
    colors[i * 3 + 2] = _c.b;
  }
  pts.geometry.dispose();
  const geom = new THREE.BufferGeometry();
  geom.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geom.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  geom.computeBoundingSphere();
  pts.geometry = geom;
  pts.userData.checkins = checkins;
}

function buildCloud(checkins: Checkin[], scale: number): THREE.Points {
  const mat = new THREE.PointsMaterial({
    size: BASE_MARKER_PX * scale * dpr(),
    sizeAttenuation: false,
    map: DISC_TEXTURE,
    vertexColors: true,
    transparent: true,
    opacity: MARKER_OPACITY,
    depthWrite: false,
    toneMapped: false,
  });
  const pts = new THREE.Points(new THREE.BufferGeometry(), mat);
  pts.renderOrder = 10;
  pts.frustumCulled = false;
  fillCloud(pts, checkins);
  return pts;
}

export default function GlobeView({
  checkins,
  selected,
  playTarget,
  playing,
  pointScale,
  styleId,
  onSelect,
}: Props) {
  const { ref: wrapRef, width, height } = useElementSize<HTMLDivElement>();
  const globeRef = useRef<GlobeMethods | undefined>(undefined);
  const tipRef = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);
  const liftRef = useRef(MARKER_ALTITUDE);
  const cloudRef = useRef<THREE.Points | null>(null);

  const style = useMemo(() => resolveGlobeStyle(styleId), [styleId]);

  const ringData = useMemo(() => {
    const c = playTarget ?? selected;
    return c ? [c] : [];
  }, [playTarget, selected]);

  // Stable single custom-layer datum: globe.gl creates one THREE.Points via
  // customThreeObject, then calls customThreeObjectUpdate whenever the check-in
  // set changes (filters, playback reveal) — we refill the geometry in place.
  const pointScaleRef = useRef(pointScale);
  pointScaleRef.current = pointScale;
  const datumRef = useRef<{ checkins: Checkin[] }>({ checkins });
  datumRef.current.checkins = checkins;
  const cloudData = useMemo(() => [datumRef.current], [checkins]);

  const makeCloud = useCallback(() => {
    const pts = buildCloud(datumRef.current.checkins, pointScaleRef.current);
    pts.scale.setScalar(1 + liftRef.current);
    cloudRef.current = pts;
    return pts;
  }, []);
  const updateCloud = useCallback((obj: object) => {
    const pts = obj as THREE.Points;
    fillCloud(pts, datumRef.current.checkins);
    pts.scale.setScalar(1 + liftRef.current);
    cloudRef.current = pts;
  }, []);

  // Live-resize the existing cloud when only the slider moves (no rebuild).
  useEffect(() => {
    const pts = cloudRef.current ?? findCloud(globeRef.current);
    if (pts) {
      (pts.material as THREE.PointsMaterial).size =
        BASE_MARKER_PX * pointScale * dpr();
    }
  }, [pointScale]);

  // Keep the marker cloud just clear of the surface: lift scales with camera
  // height so markers rest on the globe when zoomed out but don't visibly float
  // off their location when zoomed in. OrbitControls fires "change" on every
  // camera move (and damping frame), which is when the lift needs recomputing.
  useEffect(() => {
    if (!ready) return;
    const g = globeRef.current;
    if (!g) return;
    const controls = g.controls();
    const camera = g.camera();
    const apply = () => {
      const lift = surfaceLift(camera.position.length());
      liftRef.current = lift;
      const pts = cloudRef.current ?? findCloud(g);
      if (pts) pts.scale.setScalar(1 + lift);
    };
    apply();
    controls.addEventListener("change", apply);
    return () => controls.removeEventListener("change", apply);
  }, [ready]);

  // A one-point cloud marks the selected check-in (bigger, white).
  const highlightData = useMemo(
    () => (selected ? [selected] : []),
    [selected],
  );

  useEffect(() => {
    const g = globeRef.current;
    if (!g) return;
    const controls = g.controls();
    controls.autoRotate = AUTO_ROTATE && !playing && !selected;
    controls.autoRotateSpeed = AUTO_ROTATE_SPEED;
  }, [playing, selected]);

  // The tile engine caches tiles by x/y/z, not by URL, so switching between two
  // tiled styles needs an explicit cache flush — and a POV nudge to refetch,
  // since clearing alone leaves the surface blank until the camera next moves.
  useEffect(() => {
    const g = globeRef.current;
    if (!g) return;
    g.globeTileEngineClearCache?.();
    g.pointOfView(g.pointOfView());
  }, [style]);

  const handleReady = () => {
    const g = globeRef.current;
    if (!g) return;
    g.pointOfView({ lat: 20, lng: -30, altitude: DEFAULT_ALTITUDE }, 0);
    const controls = g.controls();
    controls.autoRotate = AUTO_ROTATE;
    controls.autoRotateSpeed = AUTO_ROTATE_SPEED;
    controls.minDistance = 101;
    setReady(true);
  };

  // --- pointer picking --------------------------------------------------
  //
  // Screen-space nearest: project every visible (near-hemisphere) marker to the
  // screen and take the one closest to the cursor, within the drawn marker
  // radius + a few px of slop. Raycasting a point cloud instead returns the
  // point nearest the *camera* within a world tube, which mis-fires when zoomed
  // in.

  const pick = useCallback((clientX: number, clientY: number): Checkin | null => {
    const g = globeRef.current;
    const el = wrapRef.current;
    const pts = findCloud(g);
    if (!g || !el || !pts) return null;

    const rect = el.getBoundingClientRect();
    const localX = clientX - rect.left;
    const localY = clientY - rect.top;
    const camera = g.camera() as THREE.PerspectiveCamera;
    const camPos = camera.position;
    const rr = 100 * 100; // |vertex|² at the surface, for the facing test
    const tol = (BASE_MARKER_PX * pointScaleRef.current) / 2 + HIT_SLOP_PX;

    const pos = pts.geometry.getAttribute("position");
    pts.updateWorldMatrix(true, false);
    const v = new THREE.Vector3();
    let bestI = -1;
    let bestPx = tol;
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i).applyMatrix4(pts.matrixWorld);
      if (v.dot(camPos) <= rr) continue; // marker is on the far side of the globe
      v.project(camera);
      if (v.z > 1) continue; // behind the camera
      const sx = (v.x * 0.5 + 0.5) * rect.width;
      const sy = (-v.y * 0.5 + 0.5) * rect.height;
      const d = Math.hypot(sx - localX, sy - localY);
      if (d < bestPx) {
        bestPx = d;
        bestI = i;
      }
    }
    return bestI < 0 ? null : (pts.userData.checkins as Checkin[])[bestI] ?? null;
  }, [wrapRef]);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    let raf = 0;

    const onMove = (e: MouseEvent) => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        const tip = tipRef.current;
        if (!tip) return;
        const c = pick(e.clientX, e.clientY);
        if (!c) {
          tip.hidden = true;
          el.style.cursor = "";
          return;
        }
        const place = [c.city, c.country].filter(Boolean).join(", ");
        tip.innerHTML = `<strong>${escapeHtml(c.venueName)}</strong><br/>${escapeHtml(
          formatDate(c.timestamp),
        )}${place ? ` &middot; ${escapeHtml(place)}` : ""}${
          c.category ? `<br/><span>${escapeHtml(c.category)}</span>` : ""
        }`;
        const rect = el.getBoundingClientRect();
        tip.style.left = `${e.clientX - rect.left + 14}px`;
        tip.style.top = `${e.clientY - rect.top + 14}px`;
        tip.hidden = false;
        el.style.cursor = "pointer";
      });
    };
    const onLeave = () => {
      if (tipRef.current) tipRef.current.hidden = true;
      el.style.cursor = "";
    };
    const onClick = (e: MouseEvent) => onSelect(pick(e.clientX, e.clientY));

    el.addEventListener("mousemove", onMove);
    el.addEventListener("mouseleave", onLeave);
    el.addEventListener("click", onClick);
    return () => {
      cancelAnimationFrame(raf);
      el.removeEventListener("mousemove", onMove);
      el.removeEventListener("mouseleave", onLeave);
      el.removeEventListener("click", onClick);
    };
  }, [pick, onSelect, wrapRef]);

  return (
    <div ref={wrapRef} className="globe-wrap">
      <Globe
        ref={globeRef}
        width={width || undefined}
        height={height || undefined}
        globeImageUrl={style.tileUrl ? null : style.imageUrl ?? null}
        bumpImageUrl={style.tileUrl ? null : style.bumpImageUrl ?? null}
        globeTileEngineUrl={style.tileUrl ?? null}
        backgroundImageUrl={NIGHT_SKY}
        onGlobeReady={handleReady}
        atmosphereColor="#7aa2ff"
        atmosphereAltitude={0.18}
        customLayerData={cloudData}
        customThreeObject={makeCloud}
        customThreeObjectUpdate={updateCloud}
        objectsData={highlightData}
        objectLat="lat"
        objectLng="lng"
        objectAltitude={0}
        objectThreeObject={makeHighlight}
        ringsData={ringData}
        ringLat="lat"
        ringLng="lng"
        ringAltitude={0}
        ringColor={() => (t: number) => `rgba(255,255,255,${Math.sqrt(1 - t)})`}
        ringMaxRadius={playTarget ? 5 : 3}
        ringPropagationSpeed={playTarget ? 4 : 2}
        ringRepeatPeriod={playTarget ? 500 : 900}
      />
      <div ref={tipRef} className="globe-tip globe-tip-float" hidden />
      {style.attribution && (
        <div className="globe-attribution">{style.attribution}</div>
      )}
    </div>
  );
}

// --- helpers --------------------------------------------------------------

function dpr(): number {
  return typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
}

function findCloud(g: GlobeMethods | undefined): THREE.Points | null {
  if (!g) return null;
  let found: THREE.Points | null = null;
  g.scene().traverse((o) => {
    if (!found && (o as THREE.Points).isPoints && o.userData.checkins)
      found = o as THREE.Points;
  });
  return found;
}

function makeHighlight(): THREE.Points {
  const geom = new THREE.BufferGeometry();
  geom.setAttribute(
    "position",
    new THREE.BufferAttribute(new Float32Array([0, 0, 0]), 3),
  );
  const mat = new THREE.PointsMaterial({
    size: SELECTED_MARKER_PX * dpr(),
    sizeAttenuation: false,
    map: DISC_TEXTURE,
    color: "#ffffff",
    transparent: true,
    depthTest: false, // sits on the surface (altitude 0); skip depth to avoid z-fighting
    depthWrite: false,
    toneMapped: false,
  });
  const pts = new THREE.Points(geom, mat);
  pts.renderOrder = 11;
  pts.frustumCulled = false;
  return pts;
}

const DEG2RAD = Math.PI / 180;
function polarToCartesian(lat: number, lng: number, alt: number) {
  const r = 100 * (1 + alt);
  const phi = (90 - lat) * DEG2RAD;
  const theta = (90 - lng) * DEG2RAD;
  return {
    x: r * Math.sin(phi) * Math.cos(theta),
    y: r * Math.cos(phi),
    z: r * Math.sin(phi) * Math.sin(theta),
  };
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
