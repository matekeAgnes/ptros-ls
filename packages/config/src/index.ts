import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  initializeFirestore,
  onSnapshot,
  query,
  Timestamp,
  updateDoc,
  where,
} from "firebase/firestore";
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

export type LocationNodeCoordinates = LatLngPoint;

export type LocationNodeType =
  | "pickup"
  | "dropoff"
  | "delivery_current"
  | "carrier_current"
  | "hub"
  | "waypoint"
  | string;

export interface DeliveryConstraintProfile {
  urgency?: "low" | "normal" | "high" | "critical" | string;
  deadlineAt?: Date | null;
  packageWeightKg?: number;
}

export interface LocationNode {
  id: string;
  nodeType: LocationNodeType;
  status?: "active" | "inactive" | "blocked" | string;
  name: string;
  coordinates: LocationNodeCoordinates;
  entityType?: "delivery" | "carrier" | "customer" | "route" | "system";
  entityId?: string;
  description?: string;
  tags?: string[];
  capacity?: {
    maxDailyKm?: number;
    traveledTodayKm?: number;
    remainingDailyKm?: number;
  };
  deliveryConstraints?: DeliveryConstraintProfile;
  updatedFromRealtime?: boolean;
  lastRealtimeTsMs?: number;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface LocationNodeEdgeCost {
  roadDistanceKm: number;
  optimizedDistanceKm: number;
  estimatedDurationMin: number;
  fuelCostEstimate: number;
  slopeScore: number;
  roadQualityScore: number;
  safetyScore: number;
  trafficScore: number;
  weatherScore: number;
}

export interface LocationNodeEdge {
  id: string;
  fromNodeId: string;
  toNodeId: string;
  status?: "active" | "stale" | "blocked" | string;
  directed?: boolean;
  source?: "google_maps" | "learned" | "manual" | "hybrid" | string;
  costs: LocationNodeEdgeCost;
  validFrom?: unknown;
  validUntil?: unknown;
  metadata?: Record<string, unknown>;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface RouteOptimizationScoreInput {
  roadDistanceKm: number;
  optimizedDistanceKm: number;
  estimatedDurationMin: number;
  fuelCostEstimate: number;
  slopeScore?: number;
  roadQualityScore?: number;
  safetyScore?: number;
  trafficScore?: number;
  weatherScore?: number;
}

export const computeRouteOptimizationScore = (
  input: RouteOptimizationScoreInput,
): number => {
  const baseDistanceSavingKm = Math.max(
    0,
    Number(input.roadDistanceKm || 0) - Number(input.optimizedDistanceKm || 0),
  );
  const distanceComponent = baseDistanceSavingKm * 8;
  const durationComponent = Math.max(0, 120 - Number(input.estimatedDurationMin || 0)) * 0.18;
  const fuelComponent = Math.max(0, 12 - Number(input.fuelCostEstimate || 0)) * 3.4;
  const qualityComponent =
    Number(input.roadQualityScore || 0) * 2.2 +
    Number(input.safetyScore || 0) * 2.6 -
    Number(input.slopeScore || 0) * 0.9;
  const livePenalty =
    Number(input.trafficScore || 0) * 1.7 + Number(input.weatherScore || 0) * 1.3;

  return Number(
    Math.max(
      0,
      Math.min(
        100,
        distanceComponent + durationComponent + fuelComponent + qualityComponent - livePenalty,
      ),
    ).toFixed(2),
  );
};

export type DeliveryGraphSyncTrigger =
  | "manual_sync"
  | "status_change"
  | "accepted"
  | "assigned"
  | "picked_up"
  | "in_transit"
  | "out_for_delivery"
  | "delivered"
  | string;

export interface DeliveryGraphSyncInput {
  deliveryId: string;
  trigger: DeliveryGraphSyncTrigger;
}

export interface DeliveryGraphNodeRefs {
  pickupNodeId?: string;
  dropoffNodeId?: string;
  deliveryCurrentNodeId?: string;
  carrierCurrentNodeId?: string;
}

export interface DeliveryGraphSyncResult {
  deliveryId: string;
  trigger: DeliveryGraphSyncTrigger;
  success: boolean;
  message: string;
  warnings: string[];
  nodeRefs: DeliveryGraphNodeRefs;
  edgesSynced: number;
}

export interface SystemGraphSyncInput {
  trigger: DeliveryGraphSyncTrigger;
  statuses?: string[];
}

export interface SystemGraphSyncResult {
  attempted: number;
  succeeded: number;
  failed: number;
  results: DeliveryGraphSyncResult[];
}

const asPoint = (value: unknown): LocationNodeCoordinates | null => {
  if (!value || typeof value !== "object") return null;
  const maybe = value as { lat?: unknown; lng?: unknown };
  const lat = Number(maybe.lat);
  const lng = Number(maybe.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat, lng };
};

const upsertGraphNode = async (input: {
  deliveryId: string;
  entityType: "delivery" | "carrier";
  entityId: string;
  nodeType: LocationNodeType;
  name: string;
  coordinates: LocationNodeCoordinates;
  updatedFromRealtime?: boolean;
}): Promise<string> => {
  const nodeQ = query(
    collection(db, "locationNodes"),
    where("entityType", "==", input.entityType),
    where("entityId", "==", input.entityId),
  );
  const existing = await getDocs(nodeQ);
  const now = Timestamp.now();

  if (!existing.empty) {
    const nodeId = existing.docs[0].id;
    await updateDoc(doc(db, "locationNodes", nodeId), {
      deliveryId: input.deliveryId,
      nodeType: input.nodeType,
      status: "active",
      name: input.name,
      coordinates: input.coordinates,
      updatedFromRealtime: !!input.updatedFromRealtime,
      lastRealtimeTsMs: Date.now(),
      updatedAt: now,
    });
    return nodeId;
  }

  const ref = await addDoc(collection(db, "locationNodes"), {
    deliveryId: input.deliveryId,
    nodeType: input.nodeType,
    status: "active",
    name: input.name,
    coordinates: input.coordinates,
    entityType: input.entityType,
    entityId: input.entityId,
    updatedFromRealtime: !!input.updatedFromRealtime,
    lastRealtimeTsMs: Date.now(),
    createdAt: now,
    updatedAt: now,
  });

  return ref.id;
};

export const syncDeliveryLocationGraphStructure = async (
  input: DeliveryGraphSyncInput,
): Promise<DeliveryGraphSyncResult> => {
  const warnings: string[] = [];

  try {
    const deliveryRef = doc(db, "deliveries", input.deliveryId);
    const deliverySnap = await getDoc(deliveryRef);

    if (!deliverySnap.exists()) {
      return {
        deliveryId: input.deliveryId,
        trigger: input.trigger,
        success: false,
        message: "Delivery not found",
        warnings,
        nodeRefs: {},
        edgesSynced: 0,
      };
    }

    const data = deliverySnap.data() as Record<string, unknown>;
    const pickup = asPoint(data.pickupLocation);
    const dropoff = asPoint(data.deliveryLocation);
    const deliveryCurrent = asPoint(data.currentLocation);
    const carrierId = typeof data.carrierId === "string" ? data.carrierId : "";

    let carrierCurrent: LocationNodeCoordinates | null = null;
    if (carrierId) {
      const carrierSnap = await getDoc(doc(db, "users", carrierId));
      if (carrierSnap.exists()) {
        const carrierData = carrierSnap.data() as Record<string, unknown>;
        carrierCurrent = asPoint(carrierData.currentLocation);
      }
    }

    const nodeRefs: DeliveryGraphNodeRefs = {};
    if (pickup) {
      nodeRefs.pickupNodeId = await upsertGraphNode({
        deliveryId: input.deliveryId,
        entityType: "delivery",
        entityId: `${input.deliveryId}:pickup`,
        nodeType: "pickup",
        name: String(data.pickupAddress || `Pickup • ${input.deliveryId}`),
        coordinates: pickup,
      });
    } else {
      warnings.push("Pickup coordinates missing");
    }

    if (dropoff) {
      nodeRefs.dropoffNodeId = await upsertGraphNode({
        deliveryId: input.deliveryId,
        entityType: "delivery",
        entityId: `${input.deliveryId}:dropoff`,
        nodeType: "dropoff",
        name: String(data.deliveryAddress || `Dropoff • ${input.deliveryId}`),
        coordinates: dropoff,
      });
    } else {
      warnings.push("Dropoff coordinates missing");
    }

    if (deliveryCurrent) {
      nodeRefs.deliveryCurrentNodeId = await upsertGraphNode({
        deliveryId: input.deliveryId,
        entityType: "delivery",
        entityId: `${input.deliveryId}:current`,
        nodeType: "delivery_current",
        name: `Delivery current • ${input.deliveryId}`,
        coordinates: deliveryCurrent,
        updatedFromRealtime: true,
      });
    }

    if (carrierId && carrierCurrent) {
      nodeRefs.carrierCurrentNodeId = await upsertGraphNode({
        deliveryId: input.deliveryId,
        entityType: "carrier",
        entityId: carrierId,
        nodeType: "carrier_current",
        name: String(data.carrierName || "Carrier current"),
        coordinates: carrierCurrent,
        updatedFromRealtime: true,
      });
    } else if (carrierId) {
      warnings.push("Carrier current coordinates unavailable");
    }

    await updateDoc(deliveryRef, {
      locationGraph: {
        schemaVersion: 1,
        mode: "location_nodes",
        syncVersion: "graph_sync_v1",
        trigger: input.trigger,
        status: "success",
        nodeRefs,
        warnings,
        edgesSynced: 0,
        updatedAt: Timestamp.now(),
      },
      updatedAt: Timestamp.now(),
    });

    return {
      deliveryId: input.deliveryId,
      trigger: input.trigger,
      success: true,
      message: "Graph structure synchronized",
      warnings,
      nodeRefs,
      edgesSynced: 0,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown graph sync error";
    return {
      deliveryId: input.deliveryId,
      trigger: input.trigger,
      success: false,
      message,
      warnings,
      nodeRefs: {},
      edgesSynced: 0,
    };
  }
};

export const syncSystemLocationGraphStructures = async (
  input: SystemGraphSyncInput,
): Promise<SystemGraphSyncResult> => {
  const statuses =
    input.statuses && input.statuses.length
      ? input.statuses
      : [
          "pending",
          "created",
          "assigned",
          "accepted",
          "waiting_for_pickup",
          "picked_up",
          "in_transit",
          "out_for_delivery",
          "delivered",
        ];

  const deliverySnap = await getDocs(
    query(collection(db, "deliveries"), where("status", "in", statuses.slice(0, 10))),
  );

  const results: DeliveryGraphSyncResult[] = [];
  for (const item of deliverySnap.docs) {
    const result = await syncDeliveryLocationGraphStructure({
      deliveryId: item.id,
      trigger: input.trigger,
    });
    results.push(result);
  }

  const succeeded = results.filter((item) => item.success).length;
  const failed = results.length - succeeded;

  return {
    attempted: results.length,
    succeeded,
    failed,
    results,
  };
};

export default app;
