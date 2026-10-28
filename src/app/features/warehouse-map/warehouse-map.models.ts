/**
 * El contrato del plano de bodega, tal como lo habla WiscanAPIs.
 *
 * <p>Hay dos vocabularios aquí y no es un descuido:</p>
 *
 * <ul>
 *   <li><b>El plano compacto va en español y en minúsculas</b> —`pasillos`, `bloques`,
 *     `excepciones`—, porque ese JSON lo escribe y lo lee una persona mirando el plano impreso.</li>
 *   <li><b>Las respuestas van en PascalCase</b>, que es como contesta .NET y como ya se tipan en el
 *     resto de la casa.</li>
 * </ul>
 */

// --- lo que se manda: el plano compacto -----------------------------------------------------

export interface WarehousePlan {
  nombre: string;
  companyId: number;
  notas?: string[];
  origen: PlanOrigen;
  medidas: PlanMedidas;
  pasillos: PlanRangoDePasillos[];

  /**
   * Hacia dónde crecen los números de pasillo en el plano impreso. Falta = `derecha`. Solo cambia
   * cómo se dibuja: ver `WarehouseMap.AisleNumberingTowards`.
   */
  numeracionHacia?: NumeracionHacia;
  bloques: PlanBloque;
  excepciones?: PlanExcepcion[];
  bloqueInicial?: PlanBloque | null;
  bloqueFinal?: PlanBloque | null;

  /**
   * Los muros por coordenadas: los del norte y el sur, que cruzan la bodega. Son lo único del plano
   * que no sale de la rejilla.
   */
  muros?: PlanMuro[];

  /**
   * Muros que ocupan una <b>columna de la rejilla</b> en vez de un bloque: antes del primer pasillo,
   * después del último o entre dos. La columna mide lo que el muro, así que los pasillos quedan
   * pegados a él y ahí no cabe ninguna estantería.
   */
  muroInicial?: PlanColumnaDeMuro | null;
  muroFinal?: PlanColumnaDeMuro | null;
  murosEntre?: PlanMuroEntre[];

  /**
   * Muros del norte y del sur. Sin coordenadas: el backend los pone por fuera de todo, con un
   * segmento de holgura, y de un muro lateral al otro.
   */
  muroNorte?: boolean;
  muroSur?: boolean;
}

/**
 * Un muro de columna. Sin `tramos` corre por los dos, cortado en la transversal; `completo` corre
 * de punta a punta sin cortarse y la cierra.
 */
export interface PlanColumnaDeMuro {
  tramos?: 'inferior' | 'superior' | 'completo';
}

/** Un muro de columna entre dos pasillos consecutivos. */
export interface PlanMuroEntre extends PlanColumnaDeMuro {
  entre: [number, number];
}

/** Hacia dónde crecen los números de pasillo en el plano impreso. */
export type NumeracionHacia = 'derecha' | 'izquierda';

/** Un muro, por sus dos extremos en metros. */
export interface PlanMuro {
  desde: [number, number];
  hasta: [number, number];
}

/** El (0,0) físico. La descripción es obligatoria: si el origen se corre, se corre el mapa entero. */
export interface PlanOrigen {
  descripcion: string;
  x: number;
  y: number;
}

/** Las medidas de la bodega, en metros. Son pocas porque un cooler de racks es regular. */
export interface PlanMedidas {
  anchoPasillo: number;

  /**
   * Fondo de un **bloque** entero, de pasillo a pasillo.
   *
   * Un bloque son **dos filas de estantería espalda contra espalda**, una por cada pasillo que lo
   * rodea: esta medida es la de las dos juntas, no la de una.
   */
  anchoBloque: number;
  largoSegmento: number;
  separacionTramos: number;
  niveles: number;
  huecosPorSegmento: number;
  grosorMuro?: number;
}

/** Un rango de pasillos consecutivos, con la numeración del plano. */
export interface PlanRangoDePasillos {
  desde: number;
  hasta: number;

  /**
   * Por qué tramos corre: `ambos` (lo normal, y lo que vale si falta), `inferior` o `superior`.
   *
   * Un pasillo que corre por un solo tramo **no llega** a las estanterías del otro.
   */
  tramos?: 'ambos' | 'inferior' | 'superior';
}

/** Cuántos segmentos tiene cada tramo de un bloque de estantería. */
export interface PlanBloque {
  inferior?: number | null;
  superior?: number | null;
}

/** Un bloque que no es como el general, por los dos pasillos entre los que está. */
export interface PlanExcepcion {
  entre: [number, number];
  inferior?: number | null;
  superior?: number | null;
}

// --- lo que contesta ------------------------------------------------------------------------

/**
 * La previsualización.
 *
 * <p><b>`Valid: false` no es un fallo de la petición.</b> Es el contenido de la pantalla: la lista
 * de lo que hay que arreglar en el plano. El fallo de verdad llega como `HttpErrorResponse`.</p>
 */
export interface PlanPreview {
  Valid: boolean;
  Errors: string[];
  Warnings: string[];
  Resumen: PlanResumen;
  Map: WarehouseMap;
}

export interface PlanResumen {
  Aisles: number;
  Racks: number;
  Faces: number;
  /** Caras a las que no llega ningún pasillo: media estantería que nunca se inventariaría. */
  FacesWithoutAisle: number;
  Plane: WarehouseRect;
  Inventory: WarehouseRect;
}

export interface PlanSaveResult {
  MapId: string;
  Version: number;
  Warnings: string[];
  FaceAisles: unknown[];
}

// --- el mapa expandido, que es lo que dibuja el lienzo ---------------------------------------

/**
 * El mapa con la geometría ya resuelta.
 *
 * <p>Lo calcula el backend al expandir el plano, y el lienzo <b>dibuja esto</b>. Por eso no hay ni
 * una fórmula de geometría en el frontend: el dibujo y el texto no pueden discrepar porque salen de
 * la misma cuenta.</p>
 */
export interface WarehouseMap {
  MapId: string;
  Name: string;
  CompanyId: number;
  Version: number;
  Unit: string;
  Origin: WarehouseOrigin;
  Plane: WarehouseRect;

  /**
   * Hacia dónde crecen los números de pasillo en el plano impreso. Con `izquierda` el lienzo se
   * dibuja en espejo en X para verse como el plano del cliente; **las coordenadas no cambian**.
   * Nulo o ausente es `derecha` (los planos anteriores).
   */
  AisleNumberingTowards?: NumeracionHacia | null;
  Inventory: WarehouseRect;
  Aisles: WarehouseAisle[];
  ShelvingUnits: WarehouseShelvingUnit[];
  Walls: WarehouseWall[];
  ResolvedWith: WarehouseLayoutConstants;
  /** Las geocercas: dónde está cada zona en este plano. Ver `features/zones/geofence.ts`. */
  Zones?: WarehouseMapZone[];
}

/**
 * La geocerca de una zona: el sitio de una zona del catálogo (manual o externa) en este plano. No
 * crea la zona; la sitúa. El robot atribuye cada caja a la zona cuya geocerca contiene su rack.
 */
export interface WarehouseMapZone {
  IdZone: number;
  Name: string;
  /** `rect`: dos esquinas opuestas en `Points`. */
  Shape: string;
  Points: { X: number; Y: number }[];
}

/** Un muro ya resuelto: centro, largo y ángulo. 0 grados corre sobre X y 90 sobre Y. */
export interface WarehouseWall {
  WallId: string;
  Name: string;
  X: number;
  Y: number;
  Length: number;
  Rotation: number;
  Thickness: number;
}

export interface WarehouseOrigin {
  Description: string;
  X: number;
  Y: number;
}

export interface WarehouseRect {
  X: number;
  Y: number;
  Width: number;
  Depth: number;
}

export interface WarehouseAisle {
  AisleId: string;
  Name: string;
  /** El número impreso en el plano. Es con lo que el operario nombra el sitio. */
  Number: number | null;
  X: number;
  Y: number;
  Length: number;
  Width: number;
  Rotation: number;
  Anchors: WarehouseAnchor[];
}

/**
 * Un punto de referencia del pasillo, nombrado por `Code`: `P12.I` es el final del tramo inferior.
 *
 * <p>Desde el 2026-10-26 son cuatro —`.1`, `.I`, `.S`, `.3`— con la transversal entre `.I` y `.S`
 * (ahí el robot no lee). Un pasillo de un solo tramo tiene `.1` y `.3`. Los planos guardados antes
 * traen `.1/.2/.3` sin código; ver `codigoDeAncla`.</p>
 */
export interface WarehouseAnchor {
  /** Orden a lo largo del pasillo: 1 `.1` · 2 `.I` · 3 `.S` · 4 `.3`. */
  Ordinal: number;
  /** `1`, `I`, `S` o `3`. Vacío o ausente en los planos anteriores al 2026-10-26. */
  Code?: string;
  X: number;
  Y: number;
}

/**
 * El código de un ancla, también para los planos viejos: sin `Code`, los ordinales 1/2/3 eran
 * `.1`, `.2` (la transversal) y `.3`.
 */
export function codigoDeAncla(ancla: WarehouseAnchor): string {
  if (ancla.Code) return ancla.Code;
  return String(ancla.Ordinal);
}

export interface WarehouseShelvingUnit {
  RackId: string;
  Name: string;
  Length: number;
  Levels: number;
  Slots: number;
  CenterX: number;
  CenterY: number;
  Faces: WarehouseRackFace[];
}

export interface WarehouseRackFace {
  /** `left` o `right`: el vocabulario del robot, relativo a su marcha. */
  Side: string;
  X: number;
  Y: number;
  AisleId: string | null;
  /** `A` o `B`, absoluto en el mapa. `A` es el lado del pasillo de numeración menor. */
  GridSide: string | null;
  Tramo: string | null;
  Segment: number | null;
}

/**
 * Con qué medidas se resolvió la geometría.
 *
 * <p>El mapa las persiste para que nadie tenga que replicar las constantes del constructor. El
 * lienzo saca de aquí el ancho con el que dibuja un rack, en vez de llevarlo escrito.</p>
 */
export interface WarehouseLayoutConstants {
  ShelvingWidth: number;
  ShelvingSlotSpacing: number;
  FaceOffset: number;
  GridSize: number;
}
