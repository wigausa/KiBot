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
  /** La zona pedida con `?zone=`; nulo o ausente si es todo el inventario. */
  IdZone?: number | null;
  /** El recorrido del que es este avance (el de la zona, o el más reciente). Nulo si no hubo. */
  RunId?: string | null;
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
  /** Las veces que una búsqueda del robot la vio. No cambian `Locations`: la búsqueda no toca el inventario. */
  SearchSightings?: RobotSearchSighting[];
}

// --- Tanda (órdenes de la nube al robot v1) -------------------------------------------------------

/**
 * Una tanda: varias zonas en orden. La nube manda un `START` por zona y encadena sola la siguiente
 * cuando la anterior termina con `COMPLETED`; con CANCEL, RTH, ERROR, NOT_STARTED o un rechazo, se
 * detiene. De una pausa se sale reanudando, cancelando o mandándolo al dock.
 */
export type RobotBatchStatus = 'Running' | 'Done' | 'Stopped';
export type RobotBatchZoneState = 'Pending' | 'Running' | 'Done' | 'Stopped' | 'Rejected';
export type RobotCommand = 'START' | 'PAUSE' | 'RESUME' | 'CANCEL' | 'RTH';

export interface RobotBatchZone {
  IdZone: number;
  Name: string;
  /** Las anclas de su geocerca, como `p18.1` y `p22.i`. */
  From: string;
  To: string;
  RunId: string | null;
  State: RobotBatchZoneState;
  /** COMPLETED, CANCELLED, RTH, ERROR, TIMEOUT, REJECTED o NOT_STARTED. Nulo mientras no termina. */
  EndReason: string | null;
  /**
   * El motivo en texto que da el robot (firmware 2.0.0): `orden del operador: CANCEL`,
   * `seta de emergencia: ...` o por qué falló. No viene en las tandas anteriores.
   */
  EndDetail?: string | null;
}

/** Lo que el robot entendió de un `START`: se enseña para que el encargado lo compare. */
export interface RobotCommandResolved {
  Aisles: number[];
  Tramos: string[];
  TramosTotal: number;
  ReaderPowerDbm: number | null;
  MaxSpeedMps: number | null;
}

/**
 * El acuse del robot a una orden. `PENDING`: entregada sin confirmar (en un `START`, la misión se
 * lanzó y se confirma por el latido en 2 minutos). `NO_RESPONSE` lo pone la nube si el robot no
 * contesta, o si el módulo no llegó a hablar con él (`Reason: ROBOT_UNREACHABLE`).
 */
export interface RobotCommandAck {
  CommandId: string;
  Command: RobotCommand;
  Status: 'ACCEPTED' | 'REJECTED' | 'PENDING' | 'PREVIEW' | 'NO_RESPONSE';
  Reason: string | null;
  Detail: string | null;
  Resolved: RobotCommandResolved | null;
  At: string;
  RequestedBy: string | null;
}

export interface RobotBatchView {
  BatchId: string;
  IdInventory: string;
  IdDevice: number;
  Status: RobotBatchStatus;
  /** CANCELLED, RTH, ERROR, REJECTED, TIMEOUT o NOT_STARTED. Nulo si terminó bien. */
  StopReason: string | null;
  RequestedBy: string | null;
  StartedAt: string;
  EndedAt: string | null;
  /** Índice en `Zones` de la zona en curso (o de la última). */
  Current: number;
  CurrentRunId: string | null;
  Zones: RobotBatchZone[];
  LastAck: RobotCommandAck | null;
  /** `INVENTORY` o `SEARCH`. */
  MissionType?: string;
}

const RECHAZOS: Record<string, string> = {
  EXPIRED: 'La orden llegó caducada al robot',
  NOT_MY_ROBOT: 'La orden era para otro robot',
  GEOFENCE_INVALID: 'La geocerca no es válida para el robot',
  MISSING_POINTS: 'Al robot le faltan puntos de algún pasillo',
  SEARCH_EMPTY: 'No hay nada que buscar',
  CODES_INVALID: 'Algún código no es ni un USDA ni un EPC',
  TOO_MANY: 'Demasiadas cajas para una búsqueda',
  ROBOT_BUSY: 'El robot ya tiene un recorrido en marcha',
  NO_MISSION: 'El robot no tiene ningún recorrido en marcha',
  RUN_MISMATCH: 'La orden era para otro recorrido',
  RUN_ID_USED: 'El robot ya usó ese recorrido',
  NOT_PAUSED: 'El robot no está en pausa',
  TERMINANDO: 'El robot ya terminó sus tramos',
  ESTOP: 'Seta de emergencia pulsada',
  LOCALIZING: 'El robot se está relocalizando',
  BATTERY_LOW: 'Batería baja para salir',
  RFID_DOWN: 'El lector RFID no responde',
  RFID_BUSY: 'El lector RFID está ocupado',
  CHASSIS_UNREACHABLE: 'El robot no llega a su chasis',
  CHASSIS_STUCK: 'El chasis no se mueve',
  DOCK_UNKNOWN: 'El robot no sabe dónde está el dock',
  LAUNCH_FAILED: 'La misión no arrancó',
  BAD_CLOUD_KEY: 'La clave de la nube no es válida',
  CLOUD_KEY_NOT_SET: 'El robot no tiene la clave de la nube',
  LOCKED: 'Demasiadas claves equivocadas: espera 2 minutos',
  BATCH_RUNNING: 'Ya hay una tanda en marcha',
  ROBOT_UNREACHABLE: 'No se pudo hablar con el robot',
  NO_RESPONSE: 'El robot no contestó'
};

const FINES: Record<string, string> = {
  COMPLETED: 'Terminada',
  CANCELLED: 'Cancelada',
  RTH: 'Mandado volver al dock',
  ERROR: 'El robot dio un error',
  REJECTED: 'El robot rechazó la orden',
  TIMEOUT: 'El robot dejó de dar noticias',
  NOT_STARTED: 'El robot no llegó a arrancar'
};

const ESTADOS_DE_ZONA: Record<RobotBatchZoneState, string> = {
  Pending: 'Pendiente',
  Running: 'En curso',
  Done: 'Hecha',
  Stopped: 'Parada',
  Rejected: 'Rechazada'
};

/** Por qué el robot (o la nube) no aceptó una orden, en palabras. Un código desconocido, tal cual. */
export function textoDeRechazo(reason: string | null | undefined): string {
  return reason ? (RECHAZOS[reason] ?? reason) : '—';
}

/** Cómo terminó una zona (`EndReason`) o por qué se detuvo la tanda (`StopReason`). */
export function textoDeFinDeZona(reason: string | null | undefined): string {
  return reason ? (FINES[reason] ?? reason) : '—';
}

export function textoDeEstadoDeZona(estado: RobotBatchZoneState): string {
  return ESTADOS_DE_ZONA[estado] ?? estado;
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
  /**
   * En qué punto está la misión (órdenes de la nube v1). `PAUSED` solo sale de aquí: la tanda no lo
   * sabe. `PREPARING` mientras arranca. Nulo en los latidos de antes de que existieran las órdenes.
   */
  Status?: 'PREPARING' | 'RUNNING' | 'PAUSED' | 'RETURNING' | 'FINISHED' | null;
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
/**
 * Dónde está el robot ahora en el plano del inventario (`GET inventory/{id}/robot/{dev}/position`).
 * `X`/`Y` en metros de NUESTRO plano; nulos si no se pudo situar (`Reason` dice por qué).
 */
export interface RobotPosition {
  IdDevice: number;
  MapId: string;
  MapVersion: number;
  Signal: 'OK' | 'NO_SIGNAL';
  ReceivedAt: string;
  State: string | null;
  Activity: string | null;
  Zone: string | null;
  Aisle: number | null;
  Tramo: string | null;
  Segment: number | null;
  X: number | null;
  Y: number | null;
  Heading: number | null;
  /** `triangle`/`affine` (por su x/y) o `address` (centro del segmento que dice). */
  Method: string | null;
  Reason: string | null;
}

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

/**
 * El recorrido de un robot sobre el plano (`GET inventory/{id}/robot/{device}/track`). Los puntos
 * vienen YA en coordenadas de nuestro plano: el backend los lleva desde el mapa del robot con
 * triángulos entre anclas.
 */
export interface RobotTrack {
  IdInventory: string;
  IdDevice: number;
  RunId: string | null;
  RobotRunId: string | null;
  MapId: string | null;
  MapVersion: number | null;
  Run: RobotTrackRun;
  Transform: RobotTrackTransform;
  /** Ordenados por `T`. Con `since`, solo los posteriores. */
  Points: RobotTrackPoint[];
  Tramos: RobotTrackTramo[];
}

export interface RobotTrackRun {
  Status: 'OPEN' | 'CLOSED' | string;
  StartedAt: string | null;
  ClosedAt: string | null;
  Reason: string | null;
}

export interface RobotTrackTransform {
  /** Anclas que están en los dos mapas. */
  Pairs: number;
  Triangles: number;
  /** Error de la afín de respaldo en las anclas, en metros. */
  RmsM: number | null;
  /** Si un mapa es el reflejo del otro (el de 7000 Logistics lo es). */
  Reflected: boolean;
}

export interface RobotTrackPoint {
  T: string;
  /** Metros de nuestro plano. */
  X: number;
  Y: number;
  /** Radianes de nuestro plano, como `atan2`. */
  Heading: number | null;
  Zone: string | null;
  Aisle: number | null;
  Tramo: string | null;
  Segment: number | null;
  State: string | null;
  MissionTramo: string | null;
  ReadsPerS: number | null;
  BatteryPct: number | null;
  /** `TRIANGLE` (exacto en las anclas) o `AFFINE` (fuera de ellas, ~1 m). */
  Method: 'TRIANGLE' | 'AFFINE' | string;
  /** El robot decía un segmento y el punto cayó lejos: el plano o las anclas no cuadran. */
  Mismatch: boolean;
  /** `HEARTBEAT` (latido) o `READ` (lectura que tapa un hueco sin latidos). */
  Source: 'HEARTBEAT' | 'READ' | string;
}

export interface RobotTrackTramo {
  Aisle: number;
  /** El pasillo en el plano (`P18`). */
  AisleId: string | null;
  Tramo: string;
  /** `COMPLETO`, `PARCIAL`, `NO_VERIFICADO`. */
  Status: string | null;
  Direction: string | null;
  CoveredAt: string;
}

// --- Búsqueda con el robot (missionType SEARCH) -------------------------------------------------

/** Una caja que se buscó: el código tal como se escribió y su EPC. */
export interface RobotSearchTarget {
  Code: string;
  Epc: string;
}

/**
 * Dónde se vio una caja buscada. En vivo, la cara desde la que más se la leyó; al terminar, la que
 * decide el resolver del inventario, con su confianza.
 */
export interface RobotSearchFound {
  Code: string;
  Epc: string;
  AisleNumber: number | null;
  AisleId: string | null;
  Side: string | null;
  Tramo: string | null;
  Segment: number | null;
  RackId: string | null;
  RackSide: string | null;
  Readings: number;
  MeanRssi: number;
  FirstSeenAt: string;
  LastSeenAt: string;
  /** De 0 a 1, al terminar. Nula en vivo. */
  Confidence?: number | null;
  /** `Resolved` o `Ambiguous` al terminar; nulo en vivo. */
  Status?: 'Resolved' | 'Ambiguous' | null;
}

export type RobotSearchStatus = 'Running' | 'Done' | 'Stopped' | 'Rejected';

/**
 * Cómo va una búsqueda (`GET robot/search/{searchId}`). No pertenece a ningún inventario:
 * `IdInventory` es su propio ámbito (`search:{id}`).
 */
export interface RobotSearch {
  SearchId: string;
  IdInventory: string;
  IdDevice: number;
  IdZone: number;
  ZoneName: string | null;
  Geofence: { Name: string; From: string; To: string } | null;
  MapId?: string | null;
  MapVersion?: number | null;
  /** Tramos de la zona que el robot ya terminó. */
  TramosDone?: number;
  /** Tramos de la zona; nulo hasta que el robot acepta la orden. */
  TramosTotal?: number | null;
  Status: RobotSearchStatus;
  EndReason: string | null;
  StartedAt: string;
  EndedAt: string | null;
  Ack: RobotCommandAck | null;
  Total: number;
  Found: RobotSearchFound[];
  /** Lo que aún no apareció; terminada, lo que no se encontró en la zona. */
  Missing: RobotSearchTarget[];
}

/** Una vez que una búsqueda vio una caja (en Buscar caja). */
export interface RobotSearchSighting {
  SearchId: string;
  SeenAt: string;
  AisleNumber: number | null;
  Side: string | null;
  Tramo: string | null;
  Segment: number | null;
  RackId: string | null;
  RackSide: string | null;
  Readings: number;
}

/** Un USDA (letras y dígitos, hasta 12) o un EPC (24 hexadecimales). */
export function esCodigoValido(codigo: string): boolean {
  const c = codigo.trim();
  return /^[0-9A-Fa-f]{24}$/.test(c) || /^[A-Za-z0-9]{1,12}$/.test(c);
}

/** Los códigos de un texto: uno por línea, o separados por comas, espacios o punto y coma. Sin repetidos. */
export function codigosDe(texto: string): string[] {
  const vistos = new Set<string>();
  return texto
    .split(/[\s,;]+/)
    .map((c) => c.trim().toUpperCase())
    .filter((c) => c !== '' && !vistos.has(c) && (vistos.add(c), true));
}

const ESTADOS_DE_BUSQUEDA: Record<RobotSearchStatus, string> = {
  Running: 'Buscando',
  Done: 'Terminada',
  Stopped: 'Detenida',
  Rejected: 'Rechazada'
};

export function textoDeBusqueda(estado: RobotSearchStatus): string {
  return ESTADOS_DE_BUSQUEDA[estado] ?? estado;
}

/**
 * El lado de una cara como lo dice el operador: `left` → «Izquierda», `right` → «Derecha». Es el
 * lado de la estantería en el plano, no la A/B del robot.
 */
export function ladoTexto(rackSide: string | null | undefined): string {
  switch ((rackSide ?? '').toLowerCase()) {
    case 'left':
      return 'Izquierda';
    case 'right':
      return 'Derecha';
    default:
      return '—';
  }
}

/** El pasillo como número a secas: `20`, no `P20`. */
export function pasilloTexto(aisleNumber: number | null | undefined, aisleId?: string | null): string {
  if (aisleNumber !== null && aisleNumber !== undefined) return String(aisleNumber);
  const n = (aisleId ?? '').replace(/^P/i, '');
  return n === '' ? '—' : n;
}

/** El tramo legible: «Inferior», «Superior». */
export function tramoTexto(tramo: string | null | undefined): string {
  if (!tramo) return '—';
  return tramo.charAt(0).toUpperCase() + tramo.slice(1).toLowerCase();
}

export type NivelDeConfianza = 'alta' | 'media' | 'baja';

/**
 * Lo seguro que está el sitio de una caja encontrada. Ambigua es baja; sin confianza (en vivo) es
 * media. Los umbrales siguen al resolver: decidida sale con ⅔ o más.
 */
export function nivelDeConfianza(f: Pick<RobotSearchFound, 'Confidence' | 'Status'>): NivelDeConfianza {
  if (f.Status === 'Ambiguous') return 'baja';
  if (f.Confidence === null || f.Confidence === undefined) return 'media';
  if (f.Confidence >= 0.85) return 'alta';
  if (f.Confidence >= 0.66) return 'media';
  return 'baja';
}

const NIVELES: Record<NivelDeConfianza, string> = { alta: 'Alta', media: 'Media', baja: 'Baja' };

export function textoDeConfianza(f: Pick<RobotSearchFound, 'Confidence' | 'Status'>): string {
  if (f.Confidence === null || f.Confidence === undefined) return f.Status === 'Ambiguous' ? 'Ambigua' : '—';
  return `${NIVELES[nivelDeConfianza(f)]} · ${Math.round(f.Confidence * 100)} %`;
}

// --- Ocupación (GET inventory/{id}/robot/occupancy) --------------------------------------------

/** Lo calculado del último recorrido consolidado. */
export interface RobotRunSummary {
  RunEventId: string;
  IdDevice: number;
  Reason: string | null;
  Complete: boolean;
  CoveredSides: number;
  TotalSides: number;
  /** Cajas distintas leídas. */
  Epcs: number;
  EpcsWithZone: number;
  Ambiguous: number;
  OverCapacitySides: number;
  RacksUnknownToMap: string[];
  ConsolidatedAt: string | null;
}

/** Una cara de estantería con lo que el robot dejó en ella. */
export interface RobotRackOccupancy {
  RackId: string;
  Side: string;
  AisleId: string | null;
  IdZone: number | null;
  Capacity: number;
  Boxes: number;
  OccupancyPct: number | null;
  Covered: boolean;
  Anomaly: boolean;
}

export interface RobotOccupancy {
  IdInventory: string;
  MapId: string | null;
  MapVersion: number | null;
  Run: RobotRunSummary | null;
  Racks: RobotRackOccupancy[];
}
