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
  /** Tramos que el robot terminó en su recorrido más reciente (formato v2). */
  TramosDone?: number;
  /** Tramos de la ruta de ese recorrido. Nulo si todavía no llegó su inicio. */
  TramosTotal?: number | null;
}

/**
 * El avance en %, para la barra. Manda el de la <b>ruta</b> —tramos hechos sobre los que tiene la
 * misión— porque el robot casi nunca recorre el plano entero: contra todas las caras del plano un
 * recorrido terminado se quedaba en un 15 %. Sin ruta (no llegó el inicio), las caras del plano.
 */
export function avanceDe(p: RobotProgress | null): number {
  if (p === null) return 0;
  if (p.TramosTotal) return Math.min(100, ((p.TramosDone ?? 0) / p.TramosTotal) * 100);
  return p.TotalSides > 0 ? Math.min(100, (p.CoveredSides / p.TotalSides) * 100) : 0;
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

// --- Latido (robotStatus) ---------------------------------------------------------------------

/**
 * El último latido de un robot, como lo devuelve `GET robot/status`. `Signal` lo calcula el backend
 * al leer: `NO_SIGNAL` si lleva más del triple de lo prometido (y nunca menos de 30 s) sin noticias.
 */
export interface RobotStatusView {
  IdDevice: number;
  DeviceName: string | null;
  RobotId: string | null;
  Timestamp: string;
  ReceivedAt: string;
  Signal: 'OK' | 'NO_SIGNAL';
  SilentForS: number;
  Status: RobotStatusData;
  /** Últimos cambios de estado y avisos, del más nuevo al más viejo. Solo en el detalle. */
  Recent?: RobotStatusChange[] | null;
}

export interface RobotStatusChange {
  Timestamp: string;
  Reason: string | null;
  State: string | null;
  Activity: string | null;
  Alerts: string[];
}

export interface RobotStatusData {
  Reason: string | null;
  NextExpectedS: number | null;
  /** Lo que hace físicamente: `MOVING`, `STOPPED`, `CHARGING`, `DOCKED`, `ESTOP`, `ERROR`. */
  State: string | null;
  /** Lo que se le mandó: `IDLE`, `INVENTORY`, `SEARCH`, `RETURNING`, `MANUAL`. */
  Activity: string | null;
  Mission: RobotStatusMission | null;
  Pose: RobotStatusPose | null;
  Chassis: { BatteryPct: number | null; Charging: boolean | null; EmergencyStop: boolean | null } | null;
  Jetson: { TempC: number | null; DiskFreeGb: number | null; UptimeS: number | null; ClockSynced: boolean | null } | null;
  Rfid: { Connected: boolean | null; Reading: boolean | null; ReadsPerS: number | null } | null;
  Camera: { Connected: boolean | null; Running: boolean | null } | null;
  Network: { WifiDbm: number | null; Vpn: boolean | null; GatewayOk: boolean | null; InternetOk: boolean | null } | null;
  Alerts: string[];
}

export interface RobotStatusMission {
  RunId: string | null;
  Type: string | null;
  /** El tramo en curso, como `20-SUPERIOR`. */
  Tramo: string | null;
  TramosDone: number | null;
  TramosTotal: number | null;
}

/** `X`/`Y` son del mapa del robot (Reeman), no del nuestro: para enseñar sirve la dirección. */
export interface RobotStatusPose {
  X: number | null;
  Y: number | null;
  Heading: number | null;
  /** `AISLE`, `CORRIDOR` o `DOCK`. */
  Zone: string | null;
  Cooler: number | null;
  Aisle: number | null;
  Tramo: string | null;
  Segment: number | null;
}

const ESTADOS: Record<string, string> = {
  MOVING: 'En marcha',
  STOPPED: 'Parado',
  CHARGING: 'Cargando',
  DOCKED: 'En el dock',
  ESTOP: 'Parada de emergencia',
  ERROR: 'Error'
};

const ACTIVIDADES: Record<string, string> = {
  IDLE: 'Sin tarea',
  INVENTORY: 'Inventario',
  SEARCH: 'Búsqueda',
  RETURNING: 'Volviendo al dock',
  MANUAL: 'Manual'
};

const AVISOS: Record<string, string> = {
  ESTOP_PRESSED: 'Seta de emergencia pulsada',
  DOCK_FAILED: 'No pudo acoplarse al dock',
  BATTERY_LOW: 'Batería baja',
  NO_ROUTE_SUSTAINED: 'Sin ruta: algo bloquea el paso',
  CHASSIS_STUCK: 'Chasis bloqueado: hay que ciclar la seta',
  RFID_DOWN: 'El lector RFID no responde',
  CAMERA_DOWN: 'La cámara no responde',
  CLOCK_UNSYNCED: 'Reloj sin sincronizar: las horas de las lecturas no son fiables',
  DISK_LOW: 'Poco disco en el robot'
};

/** Lo que hace el robot, en palabras. Un valor que no conocemos se enseña tal cual. */
export function textoDeEstado(estado: string | null | undefined): string {
  return estado ? (ESTADOS[estado] ?? estado) : 'Desconocido';
}

export function textoDeActividad(actividad: string | null | undefined): string {
  return actividad ? (ACTIVIDADES[actividad] ?? actividad) : '—';
}

export function textoDeAviso(aviso: string): string {
  return AVISOS[aviso] ?? aviso;
}

/** Si el estado pide que alguien vaya a mirar. */
export function estadoGrave(estado: string | null | undefined): boolean {
  return estado === 'ESTOP' || estado === 'ERROR';
}

/**
 * Dónde está, en palabras: la dirección dentro de un pasillo, o la zona fuera de él. Con el
 * segmento como lo numera el robot (el superior sigue la cuenta del inferior: 14 en adelante).
 */
export function ubicacionDe(pose: RobotStatusPose | null | undefined): string {
  if (!pose) return 'Sin posición';
  if (pose.Zone === 'DOCK') return 'En el dock';
  if (pose.Zone === 'CORRIDOR') return 'En el corredor';
  if (pose.Aisle === null || pose.Aisle === undefined) return 'Sin posición';

  const partes = [`Pasillo ${pose.Aisle}`];
  if (pose.Tramo) partes.push(`tramo ${pose.Tramo.toLowerCase()}`);
  if (pose.Segment !== null && pose.Segment !== undefined) partes.push(`segmento ${pose.Segment}`);
  return partes.join(' · ');
}

/** Cuánto hace del último latido, en palabras cortas. */
export function haceCuanto(segundos: number): string {
  if (segundos < 60) return `hace ${Math.round(segundos)} s`;
  if (segundos < 3600) return `hace ${Math.floor(segundos / 60)} min`;
  if (segundos < 86400) return `hace ${Math.floor(segundos / 3600)} h`;
  return `hace ${Math.floor(segundos / 86400)} d`;
}

/** Los robots de los inventarios, uno por id: en `GetInventories` sale una vez por zona y por inventario. */
export function robotsDe(inventarios: readonly RobotInventory[]): { IdDevice: number; Name: string }[] {
  const vistos = new Map<number, string>();
  for (const inv of inventarios) {
    for (const d of inv.Devices ?? []) {
      if (d.Type?.toLowerCase() === 'robot' && !vistos.has(d.IdDevice)) vistos.set(d.IdDevice, d.Name);
    }
  }
  return [...vistos].map(([IdDevice, Name]) => ({ IdDevice, Name }));
}
