export type SelectedParcelGeoJSON = {
  type: "Polygon" | "MultiPolygon";
  coordinates: number[][][] | number[][][][];
};

type Position = [number, number, ...number[]];

function isPosition(value: unknown): value is Position {
  return Array.isArray(value)
    && value.length >= 2
    && value.every((coordinate) => typeof coordinate === "number" && Number.isFinite(coordinate))
    && value[0] >= -180
    && value[0] <= 180
    && value[1] >= -90
    && value[1] <= 90;
}

function isClosedRing(value: unknown): value is Position[] {
  if (!Array.isArray(value) || value.length < 4 || !value.every(isPosition)) return false;
  const first = value[0];
  const last = value[value.length - 1];
  return first[0] === last[0] && first[1] === last[1];
}

function isPolygonCoordinates(value: unknown): value is Position[][] {
  return Array.isArray(value) && value.length > 0 && value.every(isClosedRing);
}

function isMultiPolygonCoordinates(value: unknown): value is Position[][][] {
  return Array.isArray(value) && value.length > 0 && value.every(isPolygonCoordinates);
}

export function parseSelectedParcelGeoJSON(value: unknown): SelectedParcelGeoJSON | null {
  let candidate = value;
  if (typeof candidate === "string") {
    try {
      candidate = JSON.parse(candidate) as unknown;
    } catch {
      return null;
    }
  }
  if (!candidate || typeof candidate !== "object") return null;

  const geometry = candidate as { type?: unknown; coordinates?: unknown };
  if (geometry.type === "Polygon" && isPolygonCoordinates(geometry.coordinates)) {
    return { type: "Polygon", coordinates: geometry.coordinates };
  }
  if (geometry.type === "MultiPolygon" && isMultiPolygonCoordinates(geometry.coordinates)) {
    return { type: "MultiPolygon", coordinates: geometry.coordinates };
  }
  return null;
}

export function isGautengCoordinate(latitude: unknown, longitude: unknown): latitude is number {
  return typeof latitude === "number"
    && Number.isFinite(latitude)
    && latitude >= -27
    && latitude <= -25
    && typeof longitude === "number"
    && Number.isFinite(longitude)
    && longitude >= 27
    && longitude <= 29.5;
}
