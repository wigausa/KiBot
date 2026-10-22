/**
 * Lo que WiscanAPIs devuelve para el robot. PascalCase porque así lo serializa el backend (igual que
 * lo consume WitagFrontend).
 */

/** Un inventario de `GetInventories`, con lo que hace falta para trabajar con el robot. */
export interface RobotInventory {
  _id: string;
  Name: string;
  EndDate: string | null;
  /** El plano que congeló. Nulo en un inventario sin robot. */
  MapId?: string | null;
  MapVersion?: number | null;
  Zones?: RobotInventoryZone[] | null;
  Devices?: RobotInventoryDevice[] | null;
}

export interface RobotInventoryZone {
  IdZone: number;
  Name: string;
}

export interface RobotInventoryDevice {
  /** `Robot`, `Portal Inventario`, `Pistola`… */
  Type: string;
  Name: string;
  IdDevice: number;
  IdZone: number;
  Zone: string;
}

/** Un recorrido (B1/B2). `Status`: `OPEN` mientras anda, `CLOSED` al terminar. */
export interface RobotRun {
  RunId: string | null;
  IdInventory: string;
  IdDevice: number;
  Status: string | null;
  StartedAt: string | null;
  ClosedAt: string | null;
  Zones: number[] | null;
  Reason: string | null;
}

/** El avance mientras el robot recorre: lecturas y caras terminadas, nunca conteo de cajas. */
export interface RobotProgress {
  IdInventory: string;
  TotalSides: number;
  CoveredSides: number;
  Readings: number;
  LastReadAt: string | null;
  Closed: boolean;
  Consolidated: boolean;
}

/** Si ya se puede buscar una caja: solo con el recorrido terminado y calculado. */
export type BoxSearchState = 'Ready' | 'InProgress' | 'Calculating' | 'NoFinishedRun';

export interface BoxSearchStatus {
  State: BoxSearchState;
  /** Escrito para la persona: se enseña tal cual. */
  Message: string;
}

export interface BoxCandidate {
  RackId: string;
  Side: string;
  /** "P12 · A · inferior · 7". Nulo en las lecturas de la forma vieja. */
  Address: string | null;
  Readings: number;
  MeanRssi: number;
}

/** Dónde quedó una caja según un robot. Una ambigua no trae sitio: trae sus candidatas. */
export interface BoxLocation {
  IdDevice: number;
  Status: 'RESOLVED' | 'AMBIGUOUS';
  IdZone: number | null;
  Aisle: string | null;
  Side: string | null;
  Tramo: string | null;
  Segment: number | null;
  RackId: string | null;
  RackSide: string | null;
  Confidence: number;
  Margin: number;
  Readings: number;
  ResolvedAt: string;
  MapId: string | null;
  MapVersion: number;
  Candidates: BoxCandidate[];
}

/** El resultado de buscar un código. Sin ubicaciones: el robot no la vio. */
export interface BoxSearchResult {
  Code: string;
  Epc: string;
  Usda: string | null;
  Locations: BoxLocation[];
}
