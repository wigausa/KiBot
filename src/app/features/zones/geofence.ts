import { CaraResaltada } from '../warehouse-map/plan-canvas/plan-canvas';
import { codigoDeAncla, WarehouseMap, WarehouseMapZone } from '../warehouse-map/warehouse-map.models';

/**
 * La geocerca por dos anclas de pasillo (decisión del usuario, 2026-10-23; ver la wiki,
 * `geocerca-por-dos-anclas`).
 *
 * <p>Una geocerca son <b>dos anclas</b>, esquinas opuestas: <c>P12.1 → P14.I</c> es del pasillo 12
 * al 14, desde el extremo inferior hasta el final del tramo inferior. Son puntos que alguien puede
 * ir a señalar con el dedo, así que no hay que medir nada. Cada pasillo tiene <c>.1</c>, <c>.I</c>,
 * <c>.S</c> y <c>.3</c> (2026-10-26); los planos anteriores, <c>.1</c>, <c>.2</c> y <c>.3</c>.</p>
 *
 * <p><b>Borde duro.</b> Entra el rack cuyo centro queda dentro del rectángulo, igual que en el
 * backend (<c>WarehouseGeometry.ZoneContains</c>). Con anclas de pasillo, eso es justo «los bloques
 * entre esos pasillos»: la fila pegada por fuera del pasillo del borde tiene el centro fuera y no
 * entra, aunque el robot la oiga al pasar.</p>
 *
 * <p>Todo aquí es puro: lo que se guarda y lo que se enseña salen de las mismas cuentas.</p>
 */

/** Un ancla del plano: <c>P12.1</c> es el extremo inferior del pasillo 12. */
export interface Ancla {
  readonly etiqueta: string;
  readonly pasillo: number;
  /** Orden a lo largo del pasillo, de abajo arriba. */
  readonly ordinal: number;
  /** `1`, `I`, `S` o `3` (o `2` en un plano viejo). */
  readonly codigo: string;
  readonly x: number;
  readonly y: number;
}

export type Puntos = readonly { X: number; Y: number }[];

/** Lo que se le dice a quien elige un par de anclas que el robot no sabe recorrer. */
export const GEOCERCA_INVALIDA = 'Una zona tiene que ir de .1 a .I, de .S a .3 o de .1 a .3';

/** Los únicos pares que entiende el robot (órdenes de la nube v1), con el código ordenado. */
const PARES_VALIDOS: ReadonlySet<string> = new Set(['1-I', '3-S', '1-3']);

/**
 * Si dos anclas forman una geocerca que el robot sabe recorrer: los tramos inferiores
 * (<c>.1</c>–<c>.I</c>), los superiores (<c>.S</c>–<c>.3</c>) o los pasillos completos
 * (<c>.1</c>–<c>.3</c>). El orden de las dos da igual. Cualquier otra combinación —<c>.1</c>–<c>.S</c>,
 * dos <c>.I</c>, o el <c>.2</c> de un plano viejo— la rechazaría el robot con `GEOFENCE_INVALID`.
 */
export function geocercaValida(a: Pick<Ancla, 'codigo'>, b: Pick<Ancla, 'codigo'>): boolean {
  const par = [a.codigo.toUpperCase(), b.codigo.toUpperCase()].sort().join('-');
  return PARES_VALIDOS.has(par);
}

/** Las anclas de los pasillos con número, ordenadas por pasillo y luego por ordinal. */
export function anclasDelMapa(mapa: WarehouseMap): Ancla[] {
  return mapa.Aisles.filter((a) => a.Number !== null)
    .flatMap((a) =>
      a.Anchors.map((p) => ({
        etiqueta: `P${a.Number}.${codigoDeAncla(p)}`,
        pasillo: a.Number as number,
        ordinal: p.Ordinal,
        codigo: codigoDeAncla(p),
        x: p.X,
        y: p.Y
      }))
    )
    .sort((a, b) => a.pasillo - b.pasillo || a.ordinal - b.ordinal);
}

/** El rectángulo de dos anclas, como lo guarda el mapa: esquina mínima y esquina máxima. */
export function geocercaEntre(desde: Ancla, hasta: Ancla): Puntos {
  return [
    { X: Math.min(desde.x, hasta.x), Y: Math.min(desde.y, hasta.y) },
    { X: Math.max(desde.x, hasta.x), Y: Math.max(desde.y, hasta.y) }
  ];
}

function caja(puntos: Puntos): { minX: number; minY: number; maxX: number; maxY: number } {
  const xs = puntos.map((p) => p.X);
  const ys = puntos.map((p) => p.Y);
  return { minX: Math.min(...xs), minY: Math.min(...ys), maxX: Math.max(...xs), maxY: Math.max(...ys) };
}

/** Los racks cuyo centro queda dentro (borde incluido), como en el backend. */
export function racksDentro(mapa: WarehouseMap, puntos: Puntos): WarehouseMap['ShelvingUnits'] {
  if (puntos.length < 2) return [];
  const c = caja(puntos);
  return mapa.ShelvingUnits.filter(
    (u) => u.CenterX >= c.minX && u.CenterX <= c.maxX && u.CenterY >= c.minY && u.CenterY <= c.maxY
  );
}

/** Las caras de esos racks, para señalarlas en el lienzo. */
export function carasDentro(mapa: WarehouseMap, puntos: Puntos): CaraResaltada[] {
  return racksDentro(mapa, puntos).flatMap((u) => u.Faces.map((f) => ({ rackId: u.RackId, side: f.Side })));
}

/**
 * Si dos geocercas se pisan. Tocarse por el borde no es pisarse: P1.1→P3.I y P3.1→P5.I comparten
 * el pasillo 3 y son vecinas. Igual que <c>WarehouseGeometry.ZonesOverlap</c>.
 */
export function sePisan(a: Puntos, b: Puntos): boolean {
  if (a.length < 2 || b.length < 2) return false;
  const x = caja(a);
  const y = caja(b);
  return x.minX < y.maxX && y.minX < x.maxX && x.minY < y.maxY && y.minY < x.maxY;
}

/** Las otras geocercas del plano con las que esta se pisaría. */
export function conQuienSePisa(mapa: WarehouseMap, idZone: number, puntos: Puntos): WarehouseMapZone[] {
  return (mapa.Zones ?? []).filter((z) => z.IdZone !== idZone && sePisan(z.Points, puntos));
}

const CASI = 1e-6;
const igual = (a: number, b: number) => Math.abs(a - b) < CASI;

/**
 * Las dos anclas de una geocerca ya guardada, para poder enseñarla como <c>P1.1 → P3.I</c>. Nulo si
 * no sale de anclas: una dibujada a mano en Witag, por ejemplo.
 */
export function anclasDeLaGeocerca(anclas: readonly Ancla[], zona: WarehouseMapZone): [Ancla, Ancla] | null {
  if (zona.Points.length < 2) return null;
  const c = caja(zona.Points);
  for (const a of anclas) {
    for (const b of anclas) {
      const g = caja(geocercaEntre(a, b));
      if (igual(g.minX, c.minX) && igual(g.minY, c.minY) && igual(g.maxX, c.maxX) && igual(g.maxY, c.maxY)) {
        // La de menor pasillo y ordinal primero: así se lee de izquierda a derecha y de abajo arriba.
        return a.pasillo < b.pasillo || (a.pasillo === b.pasillo && a.ordinal <= b.ordinal) ? [a, b] : [b, a];
      }
    }
  }
  return null;
}
