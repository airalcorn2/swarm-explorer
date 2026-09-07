// Globe surface styles. Two kinds:
//   - "tiled": globe.gl's slippy-map tile engine (`globeTileEngineUrl`) streams
//     web-mercator XYZ tiles, so the surface stays sharp at every zoom level.
//     Needs a network connection.
//   - "image": a single bundled equirectangular texture (from public/textures/,
//     copied out of `three-globe` on install). Works fully offline, but goes
//     soft when you zoom right in.
//
// Tile sources are keyless and CORS-open. This light use is fine for a personal
// tool; a heavily-trafficked public deploy should move to a provider account.

const TEX = `${import.meta.env.BASE_URL}textures/`;

// Esri's cached basemap services — keyless, {z}/{y}/{x} order.
const esri = (service: string) => (x: number, y: number, z: number) =>
  `https://server.arcgisonline.com/ArcGIS/rest/services/${service}/MapServer/tile/${z}/${y}/${x}`;

export interface GlobeStyle {
  id: string;
  label: string;
  /** XYZ tile URL builder — presence of this marks the style as "tiled". */
  tileUrl?: (x: number, y: number, z: number) => string;
  /** Bundled equirectangular texture (used when `tileUrl` is absent). */
  imageUrl?: string;
  bumpImageUrl?: string;
  /** Attribution shown in the corner of the globe. */
  attribution?: string;
}

export const GLOBE_STYLES: GlobeStyle[] = [
  {
    id: "map",
    label: "Map",
    tileUrl: esri("World_Street_Map"),
    attribution: "Esri, HERE, Garmin, OpenStreetMap contributors",
  },
  {
    id: "osm",
    label: "OpenStreetMap",
    tileUrl: (x, y, z) => `https://tile.openstreetmap.org/${z}/${x}/${y}.png`,
    attribution: "© OpenStreetMap contributors",
  },
  {
    id: "light",
    label: "Light",
    tileUrl: esri("Canvas/World_Light_Gray_Base"),
    attribution: "Esri, HERE, Garmin, © OpenStreetMap contributors",
  },
  {
    id: "satellite",
    label: "Satellite",
    tileUrl: esri("World_Imagery"),
    attribution: "Esri, Maxar, Earthstar Geographics, and the GIS User Community",
  },
  {
    id: "night",
    label: "Night lights",
    imageUrl: `${TEX}earth-night.jpg`,
    bumpImageUrl: `${TEX}earth-topology.png`,
    attribution: "NASA Earth Observatory",
  },
  {
    id: "blue-marble",
    label: "Blue Marble",
    imageUrl: `${TEX}earth-blue-marble.jpg`,
    bumpImageUrl: `${TEX}earth-topology.png`,
    attribution: "NASA Visible Earth",
  },
];

export const DEFAULT_GLOBE_STYLE = "map";

export function resolveGlobeStyle(id: string | null | undefined): GlobeStyle {
  return (
    GLOBE_STYLES.find((s) => s.id === id) ??
    GLOBE_STYLES.find((s) => s.id === DEFAULT_GLOBE_STYLE) ??
    GLOBE_STYLES[0]
  );
}
