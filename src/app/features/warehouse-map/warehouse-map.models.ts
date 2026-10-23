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
  bloques: PlanBloque;
  excepciones?: PlanExcepcion[];
  bloqueInicial?: PlanBloque | null;
  bloqueFinal?: PlanBloque | null;

  /**
   * Los muros. Son lo único del plano que no sale de la rejilla, y por eso lo único que se declara
   * por coordenadas.
   */
  muros?: PlanMuro[];
}

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
  Inventory: WarehouseRect;
  Aisles: WarehouseAisle[];
  ShelvingUnits: WarehouseShelvingUnit[];
  Walls: WarehouseWall[];
  ResolvedWith: WarehouseLayoutConstants;
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

/** 1 extremo inferior · 2 transversal · 3 extremo superior. */
export interface WarehouseAnchor {
  Ordinal: number;
  X: number;
  Y: number;
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
