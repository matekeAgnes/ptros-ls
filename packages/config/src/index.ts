import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { collection, initializeFirestore, onSnapshot } from "firebase/firestore";
import { getDatabase } from "firebase/database";
import { getStorage } from "firebase/storage";
const firebaseConfig = {
  apiKey: "AIzaSyBXSeU4cfq171-Mq0GWhxViYl3UUyYwQoE",
  authDomain: "ptros-lesotho-d145d.firebaseapp.com",
  databaseURL: "https://ptros-lesotho-d145d-default-rtdb.firebaseio.com/",
  projectId: "ptros-lesotho-d145d",
  storageBucket: "ptros-lesotho-d145d.firebasestorage.app",
  messagingSenderId: "355339066230",
  appId: "1:355339066230:web:fca735feb941dbd8e57857",
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = initializeFirestore(app, {
  // Helps on restrictive/proxy networks where streaming transports fail
  // (e.g. intermittent Listen channel / QUIC timeout issues).
  experimentalAutoDetectLongPolling: true,
  ignoreUndefinedProperties: true,
});
export const storage = getStorage(app);
export const realtimeDb = getDatabase(app);

export interface LatLngPoint {
  lat: number;
  lng: number;
}

export type RouteNetworkSegmentType =
  | "shortcut"
  | "blocked_path"
  | "restricted_path"
  | "preferred_corridor"
  | string;

export interface RouteNetworkSegment {
  id: string;
  name: string;
  type: RouteNetworkSegmentType;
  status?: "active" | "under_review" | "deprecated" | string;
  note?: string;
  start: LatLngPoint;
  end: LatLngPoint;
  blocked?: boolean;
  temporary?: boolean;
  maxWeightKg?: number | null;
  allowedVehicleTypes?: string[];
  createdAt?: Date;
  updatedAt?: Date;
  source?: string;
  createdByName?: string;
  usageCount?: number;
}

export interface RouteNetworkSegmentStyle {
  strokeColor: string;
  strokeOpacity: number;
  strokeWeight: number;
  iconMode: "none" | "cross" | "dash" | "dot" | "arrow";
}

const toDateSafe = (value: any): Date | undefined => {
  if (!value) return undefined;
  if (value instanceof Date) return value;
  if (typeof value?.toDate === "function") return value.toDate();
  if (typeof value === "number") return new Date(value);
  if (typeof value === "string") {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? undefined : parsed;
  }
  return undefined;
};

const isValidPoint = (point: any): point is LatLngPoint =>
  Boolean(
    point &&
      typeof point.lat === "number" &&
      Number.isFinite(point.lat) &&
      typeof point.lng === "number" &&
      Number.isFinite(point.lng),
  );

const haversineKm = (a: LatLngPoint, b: LatLngPoint) => {
  const earthRadiusKm = 6371;
  const toRadians = (degrees: number) => (degrees * Math.PI) / 180;

  const dLat = toRadians(b.lat - a.lat);
  const dLng = toRadians(b.lng - a.lng);
  const lat1 = toRadians(a.lat);
  const lat2 = toRadians(b.lat);

  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;

  return 2 * earthRadiusKm * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
};

export const formatRouteNetworkSegmentType = (
  type: RouteNetworkSegmentType,
) => {
  switch (type) {
    case "shortcut":
      return "Shortcut";
    case "blocked_path":
      return "Blocked path";
    case "restricted_path":
      return "Restricted path";
    case "preferred_corridor":
      return "Preferred corridor";
    default:
      return String(type || "segment")
        .replace(/_/g, " ")
        .replace(/\b\w/g, (char) => char.toUpperCase());
  }
};

export const getRouteNetworkSegmentStyle = (
  segment: RouteNetworkSegment,
): RouteNetworkSegmentStyle => {
  const base: RouteNetworkSegmentStyle = {
    strokeColor: "#16a34a",
    strokeOpacity: 0.92,
    strokeWeight: 5,
    iconMode: "arrow",
  };

  switch (segment.type) {
    case "blocked_path":
      base.strokeColor = "#dc2626";
      base.strokeOpacity = 0.95;
      base.strokeWeight = 6;
      base.iconMode = "cross";
      break;
    case "restricted_path":
      base.strokeColor = "#7c3aed";
      base.strokeOpacity = 0.9;
      base.strokeWeight = 5;
      base.iconMode = "dash";
      break;
    case "preferred_corridor":
      base.strokeColor = "#0891b2";
      base.strokeOpacity = 0.9;
      base.strokeWeight = 5;
      base.iconMode = "dot";
      break;
    case "shortcut":
    default:
      base.strokeColor = "#16a34a";
      base.strokeOpacity = 0.92;
      base.strokeWeight = 5;
      base.iconMode = "arrow";
      break;
  }

  if (segment.status === "under_review") {
    base.strokeOpacity = Math.min(base.strokeOpacity, 0.62);
  }

  if (segment.status === "deprecated") {
    base.strokeOpacity = Math.min(base.strokeOpacity, 0.4);
    base.strokeWeight = Math.max(3, base.strokeWeight - 1);
    if (base.iconMode === "arrow") {
      base.iconMode = "dash";
    }
  }

  if (segment.temporary) {
    base.strokeOpacity = Math.min(1, base.strokeOpacity + 0.05);
  }

  return base;
};

export const getDisplayRouteNetworkSegments = (
  segments: RouteNetworkSegment[],
  contextPoints: Array<LatLngPoint | null | undefined>,
  options?: {
    thresholdKm?: number;
    fallbackLimit?: number;
  },
) => {
  const thresholdKm = options?.thresholdKm ?? 8;
  const fallbackLimit = options?.fallbackLimit ?? 30;
  const activeSegments = (segments || []).filter(
    (segment) => segment.status !== "deprecated" && isValidPoint(segment.start) && isValidPoint(segment.end),
  );

  const points = contextPoints.filter(isValidPoint);
  if (activeSegments.length === 0) return [];
  if (points.length === 0) {
    return activeSegments.slice(0, fallbackLimit);
  }

  const scored = activeSegments
    .map((segment) => {
      const minDistanceKm = points.reduce((minDistance, point) => {
        const candidate = Math.min(
          haversineKm(segment.start, point),
          haversineKm(segment.end, point),
        );
        return Math.min(minDistance, candidate);
      }, Number.POSITIVE_INFINITY);

      return {
        segment,
        minDistanceKm,
      };
    })
    .sort((a, b) => a.minDistanceKm - b.minDistanceKm);

  const nearby = scored
    .filter((item) => item.minDistanceKm <= thresholdKm)
    .map((item) => item.segment);

  if (nearby.length > 0) {
    return nearby.slice(0, fallbackLimit);
  }

  return scored.slice(0, fallbackLimit).map((item) => item.segment);
};

export const subscribeRouteNetworkSegments = (
  callback: (segments: RouteNetworkSegment[]) => void,
) => {
  return onSnapshot(collection(db, "routeNetworkSegments"), (snapshot) => {
    const segments = snapshot.docs
      .map((docSnap) => {
        const data = docSnap.data() as any;
        return {
          id: docSnap.id,
          name: data.name || "Unnamed segment",
          type: data.type || "shortcut",
          status: data.status || "active",
          note: data.note,
          start: data.start,
          end: data.end,
          blocked: !!data.blocked,
          temporary: !!data.temporary,
          maxWeightKg:
            typeof data.maxWeightKg === "number" ? data.maxWeightKg : null,
          allowedVehicleTypes: Array.isArray(data.allowedVehicleTypes)
            ? data.allowedVehicleTypes
            : [],
          createdAt: toDateSafe(data.createdAt),
          updatedAt: toDateSafe(data.updatedAt),
          source: data.source,
          createdByName: data.createdByName,
          usageCount: Number(data.usageCount || 0),
        } satisfies RouteNetworkSegment;
      })
      .filter((segment) => isValidPoint(segment.start) && isValidPoint(segment.end))
      .sort(
        (a, b) =>
          (b.updatedAt?.getTime() || 0) - (a.updatedAt?.getTime() || 0),
      );

    callback(segments);
  });
};

export default app;
