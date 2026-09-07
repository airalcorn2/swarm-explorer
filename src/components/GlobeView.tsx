import { useEffect, useMemo, useRef } from "react";
import Globe, { type GlobeMethods } from "react-globe.gl";
import { categoryColor } from "../colors";
import { formatDate } from "../filters";
import { useElementSize } from "../hooks/useElementSize";
import type { Checkin } from "../types";

interface Props {
  checkins: Checkin[];
  selected: Checkin | null;
  /** Current check-in during play mode; gets a stronger pulsing ring. */
  playTarget: Checkin | null;
  playing: boolean;
  onSelect: (c: Checkin | null) => void;
}

const DEFAULT_ALTITUDE = 2.2;

// Idle spin. Set to true to have the globe slowly rotate when nothing is
// selected and playback isn't running.
const AUTO_ROTATE = false;
const AUTO_ROTATE_SPEED = 0.35;

// Served from public/textures/ (populated by scripts/copy-textures.mjs).
// BASE_URL keeps these correct when the app is hosted under a sub-path
// (e.g. GitHub Pages project sites at /<repo>/).
const TEX = `${import.meta.env.BASE_URL}textures/`;
const EARTH_NIGHT = `${TEX}earth-night.jpg`;
const EARTH_TOPOLOGY = `${TEX}earth-topology.png`;
const NIGHT_SKY = `${TEX}night-sky.png`;

export default function GlobeView({
  checkins,
  selected,
  playTarget,
  playing,
  onSelect,
}: Props) {
  const { ref: wrapRef, width, height } = useElementSize<HTMLDivElement>();
  const globeRef = useRef<GlobeMethods | undefined>(undefined);

  // Rings: pulse on the play target, or on a manually selected marker.
  const ringData = useMemo(() => {
    const c = playTarget ?? selected;
    return c ? [c] : [];
  }, [playTarget, selected]);

  // The camera is never moved programmatically — not on playback, not on
  // clicking a marker. The user is always in full control of rotation and zoom;
  // the pulsing ring is the only cue for the current / selected check-in.

  // Auto-rotate only when idle (nothing selected, not playing) — and only if
  // AUTO_ROTATE is enabled at all.
  useEffect(() => {
    const g = globeRef.current;
    if (!g) return;
    const controls = g.controls();
    controls.autoRotate = AUTO_ROTATE && !playing && !selected;
    controls.autoRotateSpeed = AUTO_ROTATE_SPEED;
  }, [playing, selected]);

  // Initial camera position once the globe is ready.
  const handleReady = () => {
    const g = globeRef.current;
    if (!g) return;
    g.pointOfView({ lat: 20, lng: -30, altitude: DEFAULT_ALTITUDE }, 0);
    const controls = g.controls();
    controls.autoRotate = AUTO_ROTATE;
    controls.autoRotateSpeed = AUTO_ROTATE_SPEED;
    controls.minDistance = 101;
  };

  return (
    <div ref={wrapRef} className="globe-wrap">
      <Globe
        ref={globeRef}
        width={width || undefined}
        height={height || undefined}
        globeImageUrl={EARTH_NIGHT}
        bumpImageUrl={EARTH_TOPOLOGY}
        backgroundImageUrl={NIGHT_SKY}
        onGlobeReady={handleReady}
        atmosphereColor="#7aa2ff"
        atmosphereAltitude={0.18}
        pointsData={checkins}
        pointLat="lat"
        pointLng="lng"
        pointColor={(d) => {
          const c = d as Checkin;
          if (selected && c.id === selected.id) return "#ffffff";
          return categoryColor(c.category);
        }}
        pointAltitude={(d) =>
          selected && (d as Checkin).id === selected.id ? 0.08 : 0.012
        }
        pointRadius={(d) =>
          selected && (d as Checkin).id === selected.id ? 0.42 : 0.28
        }
        pointResolution={6}
        pointsMerge={false}
        pointLabel={(d) => {
          const c = d as Checkin;
          const place = [c.city, c.country].filter(Boolean).join(", ");
          return `
            <div class="globe-tip">
              <strong>${escapeHtml(c.venueName)}</strong><br/>
              ${escapeHtml(formatDate(c.timestamp))}${
                place ? ` &middot; ${escapeHtml(place)}` : ""
              }${c.category ? `<br/><span>${escapeHtml(c.category)}</span>` : ""}
            </div>`;
        }}
        onPointClick={(d) => onSelect(d as Checkin)}
        onGlobeClick={() => onSelect(null)}
        ringsData={ringData}
        ringLat="lat"
        ringLng="lng"
        ringColor={() => (t: number) => `rgba(255,255,255,${Math.sqrt(1 - t)})`}
        ringMaxRadius={playTarget ? 5 : 3}
        ringPropagationSpeed={playTarget ? 4 : 2}
        ringRepeatPeriod={playTarget ? 500 : 900}
      />
    </div>
  );
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
