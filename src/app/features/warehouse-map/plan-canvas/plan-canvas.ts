import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  viewChild
} from '@angular/core';
import { DecimalPipe, NgTemplateOutlet } from '@angular/common';

import { geocercaValida } from '../../zones/geofence';
import { codigoDeAncla, WarehouseAisle, WarehouseMap } from '../warehouse-map.models';

/** Las tres piezas que se pueden colocar. No hay más, y eso es lo que mantiene el plano sano. */
export type PiezaDelPlano = 'pasillo' | 'bloque' | 'muro';

export type Extremo = 'inicio' | 'fin';
export type Lado = 'norte' | 'sur' | 'este' | 'oeste';
export type Tramo = 'inferior' | 'superior';

/** Por qué tramos corre un pasillo. Uno que corre por uno solo no llega a las caras del otro. */
export type TramosDePasillo = 'ambos' | 'inferior' | 'superior';

/** Dónde va un bloque: entre dos pasillos, o contra el muro de un extremo. */
export type SitioDelBloque = readonly [number, number] | Extremo;

/** El cuerpo de letra en pantalla de las anclas y de los números de pasillo, en píxeles. */
const PIXELES_DE_ANCLA = 14;
const PIXELES_DE_NUMERO = 11;

/**
 * La unidad de trazo en pantalla, en píxeles. Los trazos van en múltiplos de ella: un muro, 8
 * (3,2 px); el punto de un ancla, 4 de radio; una línea de la cuadrícula, 1,6.
 */
const PIXELES_DE_TRAZO = 0.4;

/** Hasta dónde se puede acercar: ocho veces el plano entero. */
const ZOOM_MAXIMO = 8;

/** Los tamaños de tramo que dijo el cliente; el 9, del CAD del cooler 2 (2026-10-26). */
export const LARGOS_DE_BLOQUE = [7, 9, 13, 14] as const;
export type LargoDeBloque = (typeof LARGOS_DE_BLOQUE)[number];

/** Lo que el lienzo pide cambiar del plano. Lo aplica la pantalla, que es quien tiene el texto. */
export type PlanCanvasAction =
  | { tipo: 'anadir-pasillo'; extremo: Extremo; tramos: TramosDePasillo }
  | { tipo: 'completar-pasillo'; numero: number }
  | { tipo: 'quitar-pasillo'; numero: number }
  | { tipo: 'poner-bloque'; donde: SitioDelBloque; inferior: number; superior: number }
  /** Un muro del norte o del sur, de lado a lado de la bodega. */
  | { tipo: 'anadir-muro'; lado: 'norte' | 'sur' }
  /**
   * Un muro en una columna de la rejilla, pegado a los pasillos de cada lado. Soltado en la franja
   * del medio es `completo`: corre de punta a punta y cierra la transversal.
   */
  | { tipo: 'poner-muro'; donde: SitioDelBloque; tramos: 'inferior' | 'superior' | 'completo' }
  /** Quita un muro del mapa por su id: `M01` es uno por coordenadas; `ME4-5.inferior`, el tramo de una columna. */
  | { tipo: 'quitar-muro'; wallId: string };

/** Las dos anclas de una geocerca, por su etiqueta. La segunda falta mientras se elige. */
export interface GeocercaElegida {
  readonly desde: string | null;
  readonly hasta: string | null;
}

/** Una cara de estantería que hay que señalar: la de una caja buscada, o una de sus candidatas. */
export interface CaraResaltada {
  readonly rackId: string;
  /** `left` o `right`, como en el mapa. */
  readonly side: string;
}

/** Un punto del recorrido del robot, en metros DEL PLANO (el backend ya lo trajo desde el del robot). */
export interface PuntoDelRecorrido {
  readonly x: number;
  readonly y: number;
}

/** Dónde está el robot y hacia dónde mira, en el plano. `heading` en radianes, como `atan2`. */
export interface RobotEnElPlano extends PuntoDelRecorrido {
  readonly heading: number | null;
}

/** Cómo quedó un tramo del recorrido, para pintarlo sobre el eje de su pasillo. */
export interface TramoDelRecorrido {
  /** `P18`. */
  readonly aisleId: string;
  readonly tramo: 'INFERIOR' | 'SUPERIOR' | string;
  readonly estado: 'completo' | 'parcial' | 'pendiente' | 'recorriendo';
}

/** Lo que mide la rejilla, para poder dibujar el marco aunque el plano esté vacío. */
export interface RejillaDelPlano {
  readonly inferior: number;
  readonly superior: number;
  readonly largoSegmento: number;
  readonly hueco: number;
}

/**
 * Una columna de la rejilla: lo que hay entre dos pasillos, o antes del primero, o después del
 * último. Es de bloque o de muro, y la de muro mide lo que el muro.
 */
interface Columna {
  readonly id: string;
  readonly donde: SitioDelBloque;
  readonly x: number;
  readonly ancho: number;
  readonly deMuro: boolean;
}

/** Un sitio donde se puede soltar la pieza que se está arrastrando. */
interface Hueco {
  readonly id: string;
  readonly x: number;
  readonly y: number;
  readonly ancho: number;
  readonly fondo: number;
  readonly accion: PlanCanvasAction;
}

/** Un bloque de estantería, reconstruido desde las caras que lo forman. */
interface Bloque {
  readonly id: string;
  readonly donde: SitioDelBloque;
  readonly etiqueta: string;
  readonly x: number;
  readonly ancho: number;
  readonly inferior: number;
  readonly superior: number;
}

function enMetros(valor: number): string {
  return `${valor.toFixed(2).replace('.', ',')} m`;
}

/** Cada cuántos metros cae una marca del eje, según lo grande que sea la bodega. */
function pasoDeEje(extension: number): number {
  if (extension <= 20) return 2;
  if (extension <= 60) return 5;
  if (extension <= 150) return 10;
  return 20;
}

/**
 * El plano de bodega, dibujado y editable.
 *
 * <p><b>No calcula geometría.</b> Pinta el mapa que devolvió <c>/warehouseMap/plan/preview</c>, que
 * ya trae pasillos, estanterías y caras con sus coordenadas resueltas.</p>
 *
 * <p><b>El marco manda.</b> Aunque el plano esté vacío se dibujan las tres anclas —el extremo
 * <c>.1</c>, la transversal <c>.2</c> y el extremo <c>.3</c>— y los dos tramos que delimitan. Una
 * pieza se suelta <b>en un tramo</b>, y por eso un bloque puede existir solo abajo, o solo arriba.</p>
 */
@Component({
  selector: 'plan-canvas',
  imports: [NgTemplateOutlet, DecimalPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '(pointermove)': 'mover($event)',
    '(pointerup)': 'soltar($event)',
    '(pointercancel)': 'soltar($event)',
    '(document:keydown.escape)': 'cancelar()'
  },
  templateUrl: './plan-canvas.html',
  styleUrls: ['./plan-canvas.scss', './plan-canvas.recorrido.scss']
})
export class PlanCanvas {
  readonly map = input.required<WarehouseMap>();
  readonly rejilla = input.required<RejillaDelPlano>();
  readonly editable = input(true);

  /**
   * Caras que señalar (B12, buscar caja). Varias porque una caja <b>ambigua</b> se enseña con todas
   * sus candidatas: elegir una sería afirmar algo que el robot no pudo decidir. Con alguna señalada,
   * el resto de celdas se apaga para que se vea dónde mirar.
   */
  readonly resaltadas = input<readonly CaraResaltada[]>([]);

  readonly accion = output<PlanCanvasAction>();

  /**
   * La geocerca que se está eligiendo, por las etiquetas de sus anclas (`P1.1`, `P3.I`). Con algo
   * aquí el lienzo entra en <b>modo geocerca</b>: las anclas se pulsan y se arrastra de una a otra.
   * Null es el lienzo de siempre.
   */
  readonly geocerca = input<GeocercaElegida | null>(null);

  /** Las anclas que se van eligiendo: al pulsar la primera, al pasar por encima de otras y al soltar. */
  readonly geocercaCambia = output<GeocercaElegida>();

  /**
   * Por dónde pasó el robot, en metros del plano. Se dibuja dentro del espejo, como todo lo demás:
   * con la numeración hacia la izquierda se refleja junto al plano y sigue cayendo en su pasillo.
   */
  readonly ruta = input<readonly PuntoDelRecorrido[]>([]);

  /** Dónde está el robot ahora, o en el instante que se repite. Null: no se dibuja. */
  readonly robot = input<RobotEnElPlano | null>(null);

  /** Los tramos del recorrido, coloreados sobre el eje de su pasillo según cómo quedaron. */
  readonly tramos = input<readonly TramoDelRecorrido[]>([]);

  protected readonly puntosDeRuta = computed(() =>
    this.ruta()
      .map((p) => `${p.x},${this.yDe(p.y)}`)
      .join(' ')
  );

  /**
   * La flecha del robot: un triángulo de tamaño fijo en pantalla, con la punta hacia donde mira. Se
   * calcula en metros del plano y luego se pasa a la Y de la pantalla, punto a punto: girarla con
   * un `rotate` tras invertir la Y la haría mirar al revés.
   */
  protected readonly flechaDelRobot = computed(() => {
    const r = this.robot();
    if (r === null) return null;
    const largo = this.trazo() * 30;
    const h = r.heading ?? Math.PI / 2;
    const punta = { x: r.x + largo * Math.cos(h), y: r.y + largo * Math.sin(h) };
    const izquierda = { x: r.x + largo * 0.6 * Math.cos(h + 2.4), y: r.y + largo * 0.6 * Math.sin(h + 2.4) };
    const derecha = { x: r.x + largo * 0.6 * Math.cos(h - 2.4), y: r.y + largo * 0.6 * Math.sin(h - 2.4) };
    return {
      cx: r.x,
      cy: this.yDe(r.y),
      conRumbo: r.heading !== null,
      puntos: [punta, izquierda, derecha].map((p) => `${p.x},${this.yDe(p.y)}`).join(' ')
    };
  });

  /** Cada tramo, como una línea sobre el eje de su pasillo: de `.1` a `.I` o de `.S` a `.3`. */
  protected readonly lineasDeTramo = computed(() => {
    const porPasillo = new Map(this.pasillos().map((a) => [a.AisleId, a]));
    return this.tramos().flatMap((t) => {
      const pasillo = porPasillo.get(t.aisleId);
      if (!pasillo) return [];
      const ancla = (codigo: string) => pasillo.Anchors.find((a) => codigoDeAncla(a) === codigo);
      const [desde, hasta] = t.tramo.toUpperCase() === 'SUPERIOR' ? [ancla('S'), ancla('3')] : [ancla('1'), ancla('I')];
      if (!desde || !hasta) return [];
      return [
        {
          id: `${t.aisleId}-${t.tramo}`,
          estado: t.estado,
          x1: desde.X,
          y1: this.yDe(desde.Y),
          x2: hasta.X,
          y2: this.yDe(hasta.Y)
        }
      ];
    });
  });

  private readonly clavesResaltadas = computed(
    () => new Set(this.resaltadas().map((c) => `${c.rackId}-${c.side}`))
  );

  // Mientras se arrastra una geocerca manda lo que entra en vivo; si no, lo que diga la pantalla.
  protected readonly hayResaltado = computed(() => this.dentroEnVivo() !== null || this.clavesResaltadas().size > 0);

  private readonly svg = viewChild<ElementRef<SVGSVGElement>>('lienzo');

  /** Lo que mide el lienzo en pantalla, en píxeles. Cambia con la ventana, no con el plano. */
  private readonly enPantalla = signal<{ ancho: number; alto: number } | null>(null);

  constructor() {
    const destroyRef = inject(DestroyRef);
    let observador: ResizeObserver | null = null;

    effect(() => {
      const svg = this.svg()?.nativeElement;
      if (!svg || observador) return;

      // Una medida ya, sin esperar al observador: con la página en segundo plano no avisa hasta
      // que vuelve a pintarse, y mientras tanto todo se dibujaba a la escala de reserva.
      this.medir();
      if (typeof ResizeObserver === 'undefined') return;

      observador = new ResizeObserver(([entrada]) =>
        this.enPantalla.set({ ancho: entrada.contentRect.width, alto: entrada.contentRect.height })
      );
      observador.observe(svg);
    });

    destroyRef.onDestroy(() => observador?.disconnect());
  }

  /** Mide el lienzo en pantalla. Una medida de cero (lienzo oculto) no se guarda. */
  private medir(): void {
    const r = this.svg()?.nativeElement.getBoundingClientRect();
    if (r && r.width > 10 && r.height > 10) this.enPantalla.set({ ancho: r.width, alto: r.height });
  }

  /**
   * Cuántos metros del plano caben en un píxel de pantalla. El SVG se ajusta para que quepa todo
   * (<c>meet</c>), así que manda el lado que más aprieta. Null hasta que el lienzo se ha medido.
   */
  private readonly metrosPorPixel = computed(() => {
    const t = this.enPantalla();
    const v = this.vista();
    if (!t || t.ancho <= 0 || t.alto <= 0) return null;
    // Sobre lo que se VE, no el plano entero: con zoom un píxel son menos metros, y así los trazos
    // y los textos siguen midiendo lo mismo en pantalla.
    return Math.max(v.ancho / t.ancho, v.alto / t.alto);
  });

  protected readonly largos = LARGOS_DE_BLOQUE;
  protected readonly largoElegido = signal<LargoDeBloque>(13);

  protected readonly arrastrando = signal<PiezaDelPlano | null>(null);
  protected readonly huecoActivo = signal<string | null>(null);

  /**
   * Dónde está el cursor mientras se arrastra, en píxeles de pantalla. La pieza lo acompaña: sin
   * eso, arrastrar no se veía y parecía que el botón no hacía nada hasta soltar.
   */
  protected readonly cursor = signal<{ x: number; y: number } | null>(null);

  /** Qué dice la pieza que se arrastra: si cae en un sitio, o dónde buscarlo. */
  protected readonly textoDelArrastre = computed(() => {
    const pieza = this.arrastrando();
    if (pieza === null) return '';
    if (this.huecoActivo() !== null) return 'Suelta para colocarlo';
    return pieza === 'muro'
      ? 'Llévalo a una zona marcada: junto a un pasillo, arriba o abajo'
      : 'Llévalo a una zona marcada del plano';
  });
  protected readonly bloqueActivo = signal<string | null>(null);

  // --- el marco de anclas ---------------------------------------------------------------------

  protected readonly plano = computed(() => this.map().Plane);
  protected readonly pasillos = computed(() => this.map().Aisles);
  protected readonly muros = computed(() => this.map().Walls ?? []);
  protected readonly sinPasillos = computed(() => this.pasillos().length === 0);

  /**
   * Las tres alturas del plano, calculadas igual que en el backend.
   *
   * <p>El hueco de la transversal <b>solo existe si hay dos tramos</b>: con uno solo sería alargar
   * el pasillo por un pasaje que no está.</p>
   */
  protected readonly marco = computed(() => {
    const r = this.rejilla();
    const dosTramos = r.inferior > 0 && r.superior > 0;

    const finInferior = r.inferior * r.largoSegmento;
    const inicioSuperior = finInferior + (dosTramos ? r.hueco : 0);
    const total = inicioSuperior + r.superior * r.largoSegmento;

    return {
      finInferior,
      inicioSuperior,
      total,
      dosTramos
    };
  });

  // --- zoom y desplazamiento ----------------------------------------------------------------

  /** Cuánto se acerca: 1 es el plano entero. Lo cambian los botones, nada más. */
  protected readonly zoom = signal(1);

  /**
   * El centro de lo que se ve, en coordenadas del SVG. Null es el centro del plano: así, mientras
   * no se mueva, sigue al plano aunque crezca.
   */
  private readonly centro = signal<{ x: number; y: number } | null>(null);

  /** Lo que se ve del plano: entero con zoom 1, o un trozo alrededor del centro. */
  private readonly vista = computed(() => {
    const p = this.plano();
    const z = this.zoom();
    const ancho = p.Width / z;
    const alto = p.Depth / z;

    // El centro no puede alejarse tanto que la vista se salga del plano.
    const c = this.centro() ?? { x: p.X + p.Width / 2, y: p.Y + p.Depth / 2 };
    const cx = Math.min(Math.max(c.x, p.X + ancho / 2), p.X + p.Width - ancho / 2);
    const cy = Math.min(Math.max(c.y, p.Y + alto / 2), p.Y + p.Depth - alto / 2);

    return { x: cx - ancho / 2, y: cy - alto / 2, ancho, alto };
  });

  protected readonly viewBox = computed(() => {
    const v = this.vista();
    return `${v.x} ${v.y} ${v.ancho} ${v.alto}`;
  });

  protected readonly ampliado = computed(() => this.zoom() > 1);

  protected acercar(): void {
    this.medir();
    this.zoom.set(Math.min(this.zoom() * 1.5, ZOOM_MAXIMO));
  }

  protected alejar(): void {
    this.medir();
    const z = Math.max(this.zoom() / 1.5, 1);
    this.zoom.set(z < 1.01 ? 1 : z);
    if (z < 1.01) this.centro.set(null);
  }

  protected ajustar(): void {
    this.zoom.set(1);
    this.centro.set(null);
  }

  /** Desde dónde se está moviendo el lienzo con el ratón, si se está moviendo. */
  private desplazando: { x: number; y: number; centro: { x: number; y: number } } | null = null;

  /**
   * Si lo último fue mover el lienzo. El clic que llega al soltar no debe seleccionar el bloque
   * sobre el que se empezó a arrastrar.
   */
  private seMovio = false;

  /** Empezar a mover el lienzo: solo con zoom, y nunca mientras se arrastra una pieza. */
  protected empezarAMover(evento: PointerEvent): void {
    this.seMovio = false;
    if (!this.ampliado() || this.arrastrando() !== null || evento.button !== 0) return;

    const v = this.vista();
    this.desplazando = { x: evento.clientX, y: evento.clientY, centro: { x: v.x + v.ancho / 2, y: v.y + v.alto / 2 } };
  }

  private moverLienzo(evento: PointerEvent): void {
    const d = this.desplazando;
    // La escala de este instante, del propio SVG: no depende de que el lienzo ya se haya medido.
    const ctm = this.svg()?.nativeElement.getScreenCTM();
    const m = ctm && ctm.a > 0 ? 1 / ctm.a : this.metrosPorPixel();
    if (d === null || m === null) return;

    const dx = evento.clientX - d.x;
    const dy = evento.clientY - d.y;
    if (Math.abs(dx) + Math.abs(dy) > 3) this.seMovio = true;

    // Arrastrar hacia la derecha trae lo de la izquierda: el centro va al revés que el ratón. El
    // viewBox está fuera del grupo en espejo, así que esto vale con espejo o sin él.
    this.centro.set({ x: d.centro.x - dx * m, y: d.centro.y - dy * m });
  }

  private readonly espejoY = computed(() => 2 * this.plano().Y + this.plano().Depth);

  /**
   * Si el plano impreso numera los pasillos hacia la izquierda (el cooler 2 del 7000). Entonces se
   * dibuja en espejo en X para que se vea como el plano del cliente y el del robot. <b>Solo el
   * dibujo</b>: las coordenadas del mapa, y con ellas las direcciones y las geocercas, no cambian.
   */
  protected readonly espejo = computed(() => this.map().AisleNumberingTowards === 'izquierda');

  private readonly ejeDelEspejo = computed(() => 2 * this.plano().X + this.plano().Width);

  /** El espejo de todo el dibujo, o nada. */
  protected readonly transformacionEspejo = computed(() =>
    this.espejo() ? `matrix(-1 0 0 1 ${this.ejeDelEspejo()} 0)` : null
  );

  /** Endereza un texto que el espejo dejaría al revés, girándolo sobre su propia X. */
  protected derecho(x: number): string | null {
    return this.espejo() ? `matrix(-1 0 0 1 ${2 * x} 0)` : null;
  }

  /** Dónde van las notas de las anclas del marco: en el borde por el que empieza la numeración. */
  protected readonly xDeNota = computed(() => this.plano().X + this.trazo() * 12);

  /** De una Y del plano a la Y de la pantalla. <c>alto</c> es el de la figura que se dibuja. */
  protected yDe(y: number, alto = 0): number {
    return this.espejoY() - y - alto;
  }

  /**
   * La unidad de todo lo que se dibuja <b>encima</b> del plano —grosor de líneas, puntos de las
   * anclas, muros, el eje de la calle—, en metros, para que en pantalla mida siempre lo mismo.
   *
   * <p>El plano se ajusta para caber entero, y eso está bien; lo que no puede es que, al ajustarse,
   * los trazos y los puntos crezcan o encojan con él. Hasta que el lienzo se ha medido, la cuenta
   * vieja, proporcional al plano.</p>
   */
  protected readonly trazo = computed(() => {
    const m = this.metrosPorPixel();
    return m === null ? Math.max(this.vista().ancho, this.vista().alto) / 900 : PIXELES_DE_TRAZO * m;
  });

  protected readonly anchoPasillo = computed(() => this.pasillos()[0]?.Width ?? 1.6);
  protected readonly anchoBloque = computed(() => this.map().ResolvedWith.ShelvingWidth);
  protected readonly paso = computed(() => this.anchoPasillo() + this.anchoBloque());

  /**
   * El cuerpo de letra de las anclas (.1 .I .S .3), en metros del plano, para que en pantalla mida
   * <b>siempre lo mismo</b>.
   *
   * <p>Antes iba proporcional al lado mayor del plano: una bodega más ancha que cabía por el alto
   * no se dibujaba más pequeña, pero sus letras sí crecían. Ahora sale de lo que mide el lienzo en
   * pantalla; hasta que se mide, la cuenta vieja.</p>
   */
  protected readonly tamanoDeAncla = computed(() => {
    const m = this.metrosPorPixel();
    return m === null ? Math.max(this.vista().ancho, this.vista().alto) / 22 : PIXELES_DE_ANCLA * m;
  });

  /** El número de cada pasillo, también de tamaño fijo en pantalla. */
  protected readonly tamanoDeNumero = computed(() => {
    const m = this.metrosPorPixel();
    return m === null ? this.vista().ancho / 90 : PIXELES_DE_NUMERO * m;
  });

  /** La raya del eje de la calle, en metros, para que no cambie de grosor con el zoom. */
  protected readonly rayaDelEje = computed(() => `${this.trazo() * 14} ${this.trazo() * 10}`);

  protected readonly anchoPasilloTexto = computed(() => enMetros(this.anchoPasillo()));
  protected readonly anchoBloqueTexto = computed(() => enMetros(this.anchoBloque()));

  // --- lo que se dibuja -----------------------------------------------------------------------

  protected readonly pasillosDibujables = computed(() =>
    this.pasillos().map((a) => ({
      id: a.AisleId,
      centro: a.X,
      x: a.X - a.Width / 2,
      y: a.Y - a.Length / 2,
      ancho: a.Width,
      fondo: a.Length
    }))
  );

  /**
   * Cada estantería, partida en sus <b>dos celdas</b>.
   *
   * <p>Es lo que de verdad hay: un bloque son dos filas espalda contra espalda, y cada una se
   * atiende desde un pasillo distinto. Dibujarlo como un rectángulo liso escondía justo eso.</p>
   */
  protected readonly celdas = computed(() => {
    const ancho = this.anchoBloque() / 2;

    return this.map().ShelvingUnits.flatMap((u) =>
      u.Faces.map((f) => ({
        id: `${u.RackId}-${f.Side}`,
        x: f.Side === 'left' ? u.CenterX - ancho : u.CenterX,
        y: u.CenterY - u.Length / 2,
        ancho,
        fondo: u.Length,
        huerfana: f.AisleId === null,
        resaltada: this.dentroEnVivo()?.has(u.RackId) ?? this.clavesResaltadas().has(`${u.RackId}-${f.Side}`)
      }))
    );
  });

  /** Los bloques, agrupados por su X y por el tramo al que pertenecen sus caras. */
  protected readonly bloques = computed<Bloque[]>(() => {
    const porX = new Map<number, { inferior: number; superior: number; x: number }>();

    const m = this.marco();

    for (const unidad of this.map().ShelvingUnits) {
      const clave = Math.round(unidad.CenterX * 100);
      const actual = porX.get(clave) ?? { inferior: 0, superior: 0, x: unidad.CenterX };

      // El tramo se deduce de DÓNDE está, no de lo que diga su cara: una estantería sin pasillo al
      // lado no tiene dirección todavía —ni tramo ni lado— y aun así hay que saber en qué mitad
      // está para poder añadirle la otra.
      if (unidad.CenterY < m.inicioSuperior) actual.inferior++;
      else actual.superior++;

      porX.set(clave, actual);
    }

    const numerados = this.pasillos()
      .map((a) => ({ x: a.X, n: a.Number }))
      .filter((a) => a.n !== null)
      .sort((a, b) => a.x - b.x);

    return [...porX.values()]
      .sort((a, b) => a.x - b.x)
      .map((b) => {
        const izquierda = numerados.filter((a) => a.x < b.x).at(-1)?.n ?? null;
        const derecha = numerados.find((a) => a.x > b.x)?.n ?? null;

        const donde: SitioDelBloque =
          izquierda !== null && derecha !== null
            ? ([izquierda, derecha] as const)
            : izquierda === null
              ? 'inicio'
              : 'fin';

        return {
          id: `b-${Math.round(b.x * 100)}`,
          donde,
          etiqueta:
            typeof donde === 'string'
              ? 'Bloque contra el muro'
              : `Bloque entre P${donde[0]} y P${donde[1]}`,
          x: b.x - this.anchoBloque() / 2,
          ancho: this.anchoBloque(),
          inferior: b.inferior,
          superior: b.superior
        };
      });
  });

  protected readonly bloqueSeleccionado = computed(
    () => this.bloques().find((b) => b.id === this.bloqueActivo()) ?? null
  );

  protected readonly anclas = computed(() =>
    this.pasillos().flatMap((a) =>
      a.Anchors.map((p) => {
        const codigo = codigoDeAncla(p);
        return {
          id: `${a.AisleId}.${codigo}`,
          x: p.X,
          y: p.Y,
          codigo,
          // .I y .S a los lados de la transversal; .2 era la transversal en los planos viejos.
          juntoATransversal: codigo === 'I' || codigo === 'S' || codigo === '2'
        };
      })
    )
  );

  // --- elegir una geocerca --------------------------------------------------------------------

  protected readonly eligiendoGeocerca = computed(() => this.geocerca() !== null);

  /** El ancla desde la que se está arrastrando, mientras se arrastra. */
  private readonly anclaInicio = signal<string | null>(null);

  /**
   * Con un clic sobre un ancla, sin arrastrar, la primera queda puesta y se espera la segunda: así
   * también se elige pulsando una y luego otra.
   */
  private esperandoSegunda: string | null = null;

  /**
   * El ancla sobre la que está el cursor mientras se arrastra. Vive solo aquí: la pantalla se
   * entera al soltar. Si se enterase en vivo, sus avisos cambiarían de alto y el lienzo saltaría
   * debajo del cursor en pleno gesto.
   */
  private readonly destinoEnVivo = signal<string | null>(null);

  /** Las dos anclas que se ven: las del arrastre en curso, o las que ya tiene la pantalla. */
  private readonly parQueSeVe = computed(() => {
    const inicio = this.anclaInicio();
    if (inicio !== null) return { desde: inicio, hasta: this.destinoEnVivo() };
    const g = this.geocerca();
    return { desde: g?.desde ?? null, hasta: g?.hasta ?? null };
  });

  /** El rectángulo de la geocerca elegida —o la que se está eligiendo—, y si el robot la acepta. */
  protected readonly rectanguloDeGeocerca = computed(() => {
    const par = this.parQueSeVe();
    const a = this.anclas().find((x) => x.id === par.desde);
    const b = this.anclas().find((x) => x.id === par.hasta);
    if (!a || !b) return null;

    const x = Math.min(a.x, b.x);
    const y = Math.min(a.y, b.y);
    return {
      x,
      y,
      ancho: Math.abs(a.x - b.x),
      fondo: Math.abs(a.y - b.y),
      valida: geocercaValida(a, b)
    };
  });

  /** Si un ancla es una de las dos elegidas —o de las del arrastre en curso—. */
  protected esElegida(id: string): boolean {
    const par = this.parQueSeVe();
    return this.eligiendoGeocerca() && (par.desde === id || par.hasta === id);
  }

  /**
   * Las estanterías que entran mientras se arrastra, para señalarlas en vivo sin esperar a soltar.
   * El centro dentro, borde incluido, como lo cuenta el backend.
   */
  private readonly dentroEnVivo = computed(() => {
    const r = this.anclaInicio() !== null ? this.rectanguloDeGeocerca() : null;
    if (r === null) return null;
    return new Set(
      this.map()
        .ShelvingUnits.filter(
          (u) => u.CenterX >= r.x && u.CenterX <= r.x + r.ancho && u.CenterY >= r.y && u.CenterY <= r.y + r.fondo
        )
        .map((u) => u.RackId)
    );
  });

  /** Mientras se arrastra: si con esa ancla de destino el par sería válido. */
  protected esDestinoValido(codigo: string): boolean {
    const inicio = this.anclas().find((a) => a.id === (this.anclaInicio() ?? this.esperandoSegunda));
    return inicio !== undefined && geocercaValida(inicio, { codigo });
  }

  protected readonly eligiendoDestino = computed(() => this.anclaInicio() !== null);

  /** Pulsar un ancla: empieza la geocerca desde ella, o la termina si ya había una esperando. */
  protected empezarGeocerca(id: string, evento: PointerEvent): void {
    if (!this.eligiendoGeocerca()) return;
    evento.stopPropagation();
    evento.preventDefault();

    // Solo se espera la segunda si la pantalla sigue con esa primera sola: si la borró («Empezar de
    // nuevo») o eligió otra cosa, la espera ya no vale y esta ancla empieza una geocerca nueva.
    const g = this.geocerca();
    if (this.esperandoSegunda !== null && (g?.desde !== this.esperandoSegunda || g?.hasta !== null)) {
      this.esperandoSegunda = null;
    }

    if (this.esperandoSegunda !== null && this.esperandoSegunda !== id) {
      this.geocercaCambia.emit({ desde: this.esperandoSegunda, hasta: id });
      this.esperandoSegunda = null;
      return;
    }

    this.esperandoSegunda = null;
    this.anclaInicio.set(id);
    this.destinoEnVivo.set(null);
  }

  /** El ancla más cercana al cursor, a menos de unos 16 px, que no sea la de partida. */
  private anclaCercana(evento: PointerEvent): string | null {
    const punto = this.enMetros(evento);
    if (punto === null) return null;

    const alcance = this.trazo() * 40;
    let mejor: string | null = null;
    let menor = alcance;
    for (const a of this.anclas()) {
      if (a.id === this.anclaInicio()) continue;
      const d = Math.hypot(a.x - punto.x, a.y - punto.y);
      if (d <= menor) {
        menor = d;
        mejor = a.id;
      }
    }
    return mejor;
  }

  /** Arrastrando desde un ancla: la de destino se imanta y la geocerca se ve en vivo, en el lienzo. */
  private moverGeocerca(evento: PointerEvent): void {
    if (this.anclaInicio() === null) return;
    this.destinoEnVivo.set(this.anclaCercana(evento));
  }

  /**
   * Soltar: sobre un ancla la deja puesta; sobre nada, la primera se queda esperando la segunda.
   * Es ahora, y no antes, cuando la pantalla se entera.
   */
  private soltarGeocerca(evento: PointerEvent): void {
    const inicio = this.anclaInicio();
    if (inicio === null) return;

    const destino = this.anclaCercana(evento);
    this.anclaInicio.set(null);
    this.destinoEnVivo.set(null);

    if (destino === null) {
      this.esperandoSegunda = inicio;
      this.geocercaCambia.emit({ desde: inicio, hasta: null });
    } else {
      this.geocercaCambia.emit({ desde: inicio, hasta: destino });
    }
  }

  protected readonly marcasX = computed(() => this.marcas(this.plano().X, this.plano().Width));
  protected readonly marcasY = computed(() => this.marcas(this.plano().Y, this.plano().Depth));

  protected readonly numeros = computed(() =>
    this.pasillos()
      .filter((a) => a.Number !== null)
      .map((a) => ({ id: a.AisleId, numero: a.Number as number, x: a.X, y: a.Y - a.Length / 2 }))
  );

  // --- los huecos donde encaja lo que arrastras -----------------------------------------------

  protected readonly huecos = computed<Hueco[]>(() => {
    const pieza = this.arrastrando();
    if (pieza === null) return [];
    if (pieza === 'muro') return this.huecosDeMuro();
    if (pieza === 'pasillo') return this.huecosDePasillo();
    return this.huecosDeBloque();
  });

  /**
   * Las columnas de la rejilla, de izquierda a derecha: la de antes del primer pasillo, una entre
   * cada dos y la de después del último.
   *
   * <p><b>Todo sale del mapa que se dibuja</b>, nunca del plano escrito: si los dos no coinciden —un
   * backend que todavía no entiende los muros de columna los ignora sin error—, las sombras tienen
   * que caer sobre lo que se ve. Entre dos pasillos la columna se mide: más estrecha que un bloque es
   * de muro. En los extremos lo dicen los muros del mapa por su id (<c>MI.</c>, <c>MF.</c>).</p>
   */
  protected readonly columnas = computed<Columna[]>(() => {
    const pasillos = this.pasillos()
      .filter((a) => a.Number !== null)
      .sort((a, b) => a.X - b.X);
    if (pasillos.length === 0) return [];

    const mitad = this.anchoPasillo() / 2;
    const bloque = this.anchoBloque();

    const muroDe = (prefijo: string) => this.muros().find((w) => w.WallId.startsWith(prefijo)) ?? null;
    const inicial = muroDe('MI.');
    const final = muroDe('MF.');

    const primero = pasillos[0];
    const ultimo = pasillos[pasillos.length - 1];
    const anchoInicial = inicial?.Thickness ?? bloque;
    const anchoFinal = final?.Thickness ?? bloque;

    const salida: Columna[] = [
      { id: 'inicio', donde: 'inicio', x: primero.X - mitad - anchoInicial, ancho: anchoInicial, deMuro: inicial !== null }
    ];

    for (let i = 0; i + 1 < pasillos.length; i++) {
      const a = pasillos[i];
      const b = pasillos[i + 1];
      const x = a.X + mitad;
      const ancho = b.X - mitad - x;
      salida.push({
        id: `e${a.Number}-${b.Number}`,
        donde: [a.Number as number, b.Number as number] as const,
        x,
        ancho,
        deMuro: ancho < bloque - 0.01
      });
    }

    salida.push({ id: 'fin', donde: 'fin', x: ultimo.X + mitad, ancho: anchoFinal, deMuro: final !== null });
    return salida;
  });

  /**
   * Las franjas donde se suelta algo que corre por tramos, como un pasillo o un muro de columna:
   * una por mitad y, sobre la transversal, una para los dos.
   *
   * <p>La franja del medio es la del elemento completo porque es ahí donde está el paso de un tramo
   * al otro.</p>
   */
  private franjas(id: string, x: number, ancho: number, accion: (tramos: TramosDePasillo) => PlanCanvasAction): Hueco[] {
    const m = this.marco();
    if (!m.dosTramos) {
      return [{ id, x, y: 0, ancho, fondo: m.total, accion: accion('ambos') }];
    }

    const margen = (m.inicioSuperior - m.finInferior) / 2;

    return [
      { id: `${id}-inferior`, x, y: 0, ancho, fondo: m.finInferior - margen, accion: accion('inferior') },
      { id: `${id}-ambos`, x, y: m.finInferior - margen, ancho, fondo: (m.inicioSuperior - m.finInferior) + 2 * margen, accion: accion('ambos') },
      { id: `${id}-superior`, x, y: m.inicioSuperior + margen, ancho, fondo: m.total - m.inicioSuperior - margen, accion: accion('superior') }
    ];
  }

  /**
   * Dónde puede ir un muro.
   *
   * <p><b>Los que corren a lo largo de los pasillos ocupan una columna</b>: la de un extremo o una
   * entre dos pasillos, y <b>solo si está vacía</b>: un muro va al lado de pasillos, nunca de un
   * bloque. Ahí queda pegado a los pasillos de cada lado, sin hueco. Se suelta por tramo, o en la franja del
   * medio para uno cerrado de punta a punta.</p>
   *
   * <p>Los del norte y el sur cruzan la bodega de lado a lado y van <b>por fuera</b>, con un segmento
   * de holgura: su sombra está ahí, donde va a caer el muro, y no encima de las estanterías.</p>
   */
  private huecosDeMuro(): Hueco[] {
    const inv = this.map().Inventory;
    const holgura = this.rejilla().largoSegmento;

    const extremos: Hueco[] = [
      { id: 'norte', x: inv.X, y: inv.Y + inv.Depth, ancho: inv.Width, fondo: holgura, accion: { tipo: 'anadir-muro', lado: 'norte' } },
      { id: 'sur', x: inv.X, y: inv.Y - holgura, ancho: inv.Width, fondo: holgura, accion: { tipo: 'anadir-muro', lado: 'sur' } }
    ];

    // Un muro va SOLO al lado de pasillos: una columna con un bloque, aunque sea de un tramo, no
    // ofrece sitio. Antes lo ofrecía y el muro se comía el bloque.
    const conBloque = (c: Columna) =>
      this.bloques().some((b) => b.x + b.ancho / 2 > c.x && b.x + b.ancho / 2 < c.x + c.ancho);

    return [
      ...extremos,
      // La franja del medio es la del muro cerrado: de punta a punta, sin hueco en la transversal.
      // Para dejarla abierta se suelta abajo y arriba por separado.
      ...this.columnas().filter((c) => !conBloque(c)).flatMap((c) =>
        this.franjas(`muro-${c.id}`, c.x, c.ancho, (tramos) => ({
          tipo: 'poner-muro',
          donde: c.donde,
          tramos: tramos === 'ambos' ? 'completo' : tramos
        }))
      )
    ];
  }

  /**
   * Un pasillo también se suelta <b>en un tramo</b>, igual que un bloque.
   *
   * <p>Soltarlo en una mitad hace un pasillo que recorre solo esa; en la franja del medio, uno
   * completo. Un pasillo de un tramo <b>no llega</b> a las estanterías del otro, y esas caras se
   * quedan sin pasillo — marcadas en ámbar, que es lo que tiene que pasar.</p>
   */
  private huecosDePasillo(): Hueco[] {
    const inv = this.map().Inventory;
    const ancho = this.anchoPasillo();

    const porTramo = (id: string, x: number, extremo: Extremo): Hueco[] =>
      this.franjas(id, x, ancho, (tramos) => ({ tipo: 'anadir-pasillo', extremo, tramos }));

    if (this.sinPasillos()) {
      // Si ya hay una estantería puesta, el pasillo va PEGADO a ella: es el sitio donde de verdad
      // va a caer, y además el único que le daría dirección a esas caras. En un lienzo del todo
      // vacío no hay nada a lo que pegarse, así que va al centro.
      const unidades = this.map().ShelvingUnits;
      const x =
        unidades.length > 0
          ? Math.max(...unidades.map((u) => u.CenterX)) + this.anchoBloque() / 2
          : inv.X + inv.Width / 2 - ancho / 2;

      return porTramo('primero', x, 'fin');
    }

    // El hueco va donde de verdad va a caer el pasillo nuevo: pasada la columna del extremo, sea
    // de bloque o de muro. Midiéndolo desde el borde del recinto caía encima del bloque del
    // extremo, y la sombra prometía un sitio que ya estaba ocupado. Con un muro en el extremo, el
    // pasillo nuevo cae al otro lado del muro, pegado a él.
    const columnas = this.columnas();
    const inicio = columnas[0];
    const fin = columnas[columnas.length - 1];

    // Los dos extremos, siempre. Hacia la izquierda la numeración no cabe por debajo del 1, así
    // que la pantalla corre la numeración entera — un plano se dibuja hacia donde haga falta.
    return [
      ...porTramo('inicio', inicio.x - ancho, 'inicio'),
      ...porTramo('fin', fin.x + fin.ancho, 'fin'),
      ...this.huecosParaCompletar()
    ];
  }

  /**
   * Los huecos que completan un pasillo que hoy solo recorre un tramo.
   *
   * <p>Sin esto, soltar un pasillo en el tramo que le falta abría uno nuevo con otro número en vez
   * de terminar el que ya está, que es lo que uno espera.</p>
   */
  private huecosParaCompletar(): Hueco[] {
    const m = this.marco();
    if (!m.dosTramos) return [];

    const ancho = this.anchoPasillo();

    return this.pasillos()
      .filter((a) => a.Number !== null && a.Length < m.total - 0.01)
      .map((a) => {
        const suInicio = a.Y - a.Length / 2;
        const leFaltaArriba = suInicio < m.finInferior + 0.01;

        return {
          id: `completar-${a.Number}`,
          x: a.X - ancho / 2,
          y: leFaltaArriba ? m.inicioSuperior : 0,
          ancho,
          fondo: leFaltaArriba ? m.total - m.inicioSuperior : m.finInferior,
          accion: { tipo: 'completar-pasillo', numero: a.Number as number }
        };
      });
  }

  /**
   * Un bloque se suelta <b>en un tramo</b>: arriba o abajo.
   *
   * <p>Por eso un bloque puede tener un solo tramo: no se coloca el otro y ya. Y por eso el marco de
   * anclas está dibujado desde el principio — es el que dice dónde está cada mitad.</p>
   */
  private huecosDeBloque(): Hueco[] {
    const inv = this.map().Inventory;
    const m = this.marco();
    const ancho = this.anchoBloque();

    // Las dos zonas son EXACTAMENTE los dos tramos del marco, sin estirarse al largo elegido:
    // estirándolas, un bloque de 14 hacía que la de abajo cruzara la transversal y se tragara la
    // de arriba, y entonces no había forma de colocar nada en el tramo superior.
    const porTramo = (id: string, x: number, donde: SitioDelBloque, existente: Bloque | null): Hueco[] => [
      {
        id: `${id}-inferior`,
        x,
        y: 0,
        ancho,
        fondo: m.finInferior,
        accion: {
          tipo: 'poner-bloque',
          donde,
          inferior: this.largoElegido(),
          superior: existente?.superior ?? 0
        }
      },
      {
        id: `${id}-superior`,
        x,
        y: m.inicioSuperior,
        ancho,
        fondo: m.total - m.inicioSuperior,
        accion: {
          tipo: 'poner-bloque',
          donde,
          inferior: existente?.inferior ?? 0,
          superior: this.largoElegido()
        }
      }
    ];

    if (this.sinPasillos()) {
      // Con un muro inicial ya no hay columna para un bloque antes del primer pasillo.
      if (this.muros().some((w) => w.WallId.startsWith('MI.'))) return [];

      // El bloque que ya esté puesto tiene que encontrarse a sí mismo: pasando null, soltar en el
      // tramo de arriba borraba el de abajo en vez de sumarse a él.
      const yaPuesto = this.bloques()[0] ?? null;
      const x = yaPuesto !== null ? yaPuesto.x : inv.X + inv.Width / 2 - ancho / 2;

      return porTramo('primero', x, 'inicio', yaPuesto);
    }

    const existentes = this.bloques();
    const bloqueEn = (centro: number) =>
      existentes.find((b) => Math.abs(b.x + b.ancho / 2 - centro) < 0.01) ?? null;

    // Al lado de un muro solo van pasillos: una columna de muro no ofrece sitio para un bloque.
    return this.columnas()
      .filter((c) => !c.deMuro)
      .flatMap((c) => porTramo(c.id, c.x, c.donde, bloqueEn(c.x + c.ancho / 2)));
  }

  // --- arrastrar ------------------------------------------------------------------------------

  protected elegirLargo(largo: LargoDeBloque): void {
    this.largoElegido.set(largo);
  }

  protected empezar(pieza: PiezaDelPlano, evento: PointerEvent): void {
    if (!this.editable()) return;
    evento.preventDefault();

    // Sin setPointerCapture a propósito: capturar en el botón de la paleta desvía hacia él todos
    // los pointermove siguientes, y entonces el plano nunca se entera de que el cursor está encima.
    this.arrastrando.set(pieza);
    this.cursor.set({ x: evento.clientX, y: evento.clientY });
    this.bloqueActivo.set(null);
  }

  protected mover(evento: PointerEvent): void {
    if (this.anclaInicio() !== null) {
      this.moverGeocerca(evento);
      return;
    }
    if (this.desplazando !== null) {
      this.moverLienzo(evento);
      return;
    }
    if (this.arrastrando() === null) return;
    this.cursor.set({ x: evento.clientX, y: evento.clientY });
    const punto = this.enMetros(evento);
    this.huecoActivo.set(punto === null ? null : (this.huecoBajo(punto)?.id ?? null));
  }

  protected soltar(evento: PointerEvent): void {
    this.desplazando = null;
    if (this.anclaInicio() !== null) {
      this.soltarGeocerca(evento);
      return;
    }

    const pieza = this.arrastrando();
    if (pieza === null) return;

    const punto = this.enMetros(evento);
    const hueco = punto === null ? null : this.huecoBajo(punto);

    this.arrastrando.set(null);
    this.huecoActivo.set(null);
    this.cursor.set(null);

    if (hueco !== null) this.accion.emit(hueco.accion);
  }

  /** Esc: suelta lo que se arrastra sin colocarlo, o deja de editar el bloque seleccionado. */
  protected cancelar(): void {
    // Arrastrando desde un ancla: se cancela y la pantalla sigue con lo que tenía.
    if (this.anclaInicio() !== null) {
      this.anclaInicio.set(null);
      this.destinoEnVivo.set(null);
      return;
    }
    // Con la primera esperando la segunda: deja de esperar, y la primera se queda sola.
    if (this.esperandoSegunda !== null) {
      this.esperandoSegunda = null;
      return;
    }
    if (this.arrastrando() !== null) {
      this.arrastrando.set(null);
      this.huecoActivo.set(null);
      this.cursor.set(null);
      return;
    }
    this.bloqueActivo.set(null);
  }

  /**
   * De píxel de pantalla a metro del plano.
   *
   * <p>Por <c>getScreenCTM()</c> y no por el rectángulo del elemento: con
   * <c>preserveAspectRatio</c> el SVG deja franjas muertas a los lados, y medir sobre el rectángulo
   * las cuenta como área útil.</p>
   */
  private enMetros(evento: PointerEvent): { x: number; y: number } | null {
    const svg = this.svg()?.nativeElement;
    const ctm = svg?.getScreenCTM();
    if (!svg || !ctm) return null;

    const punto = new DOMPoint(evento.clientX, evento.clientY).matrixTransform(ctm.inverse());
    // El espejo en X está en un grupo de dentro, que el CTM del svg no ve: se deshace aquí.
    const x = this.espejo() ? this.ejeDelEspejo() - punto.x : punto.x;
    return { x, y: this.espejoY() - punto.y };
  }

  /** El hueco bajo el cursor; si no hay ninguno, el más cercano dentro de medio paso. */
  private huecoBajo(punto: { x: number; y: number }): Hueco | null {
    const huecos = this.huecos();

    const dentro = huecos.find(
      (h) => punto.x >= h.x && punto.x <= h.x + h.ancho && punto.y >= h.y && punto.y <= h.y + h.fondo
    );
    if (dentro !== undefined) return dentro;

    const alcance = this.paso();
    let mejor: Hueco | null = null;
    let menor = Number.POSITIVE_INFINITY;

    for (const h of huecos) {
      const dx = Math.max(h.x - punto.x, 0, punto.x - (h.x + h.ancho));
      const dy = Math.max(h.y - punto.y, 0, punto.y - (h.y + h.fondo));
      const d = Math.hypot(dx, dy);
      if (d < menor && d <= alcance) {
        menor = d;
        mejor = h;
      }
    }

    return mejor;
  }

  // --- pulsar ---------------------------------------------------------------------------------

  protected seleccionarBloque(id: string): void {
    if (!this.editable() || this.seMovio) return;
    this.bloqueActivo.set(this.bloqueActivo() === id ? null : id);
  }

  protected quitarPasillo(numero: number): void {
    this.accion.emit({ tipo: 'quitar-pasillo', numero });
  }

  protected quitarMuro(wallId: string): void {
    this.accion.emit({ tipo: 'quitar-muro', wallId });
  }

  /** Quita un tramo entero del bloque: es lo que deja un bloque de un solo tramo. */
  /** Quita el bloque entero: la columna queda vacía, y ahí ya puede ir un muro. */
  protected quitarBloque(bloque: Bloque): void {
    this.accion.emit({ tipo: 'poner-bloque', donde: bloque.donde, inferior: 0, superior: 0 });
    this.bloqueActivo.set(null);
  }

  protected quitarTramo(bloque: Bloque, tramo: Tramo): void {
    this.accion.emit({
      tipo: 'poner-bloque',
      donde: bloque.donde,
      inferior: tramo === 'inferior' ? 0 : bloque.inferior,
      superior: tramo === 'superior' ? 0 : bloque.superior
    });
  }

  protected ponerLargo(bloque: Bloque, tramo: Tramo, largo: LargoDeBloque): void {
    this.accion.emit({
      tipo: 'poner-bloque',
      donde: bloque.donde,
      inferior: tramo === 'inferior' ? largo : bloque.inferior,
      superior: tramo === 'superior' ? largo : bloque.superior
    });
  }

  protected pasilloExtremo(cual: 'min' | 'max'): number | null {
    const numeros = this.pasillos()
      .map((a: WarehouseAisle) => a.Number)
      .filter((n): n is number => n !== null);
    if (numeros.length === 0) return null;
    return cual === 'min' ? Math.min(...numeros) : Math.max(...numeros);
  }

  /**
   * El grosor con el que se dibuja un muro: <b>fijo en pantalla</b>, como el resto de trazos.
   *
   * <p>Con el grosor real (0,20 m) en una bodega grande era uno o dos píxeles y se confundía con el
   * borde del pasillo; en una pequeña, el ajuste lo engordaba. Solo cambia el dibujo: el muro
   * sigue centrado donde está y mide lo que mide en el mapa.</p>
   */
  protected grosorVisible(_muro: { Thickness: number }): number {
    return this.trazo() * 8;
  }

  /** Al dibujar con la Y hacia arriba, un ángulo del plano gira al revés en pantalla. */
  protected transformacion(muro: { X: number; Y: number; Rotation: number }): string {
    return `rotate(${-muro.Rotation} ${muro.X} ${this.yDe(muro.Y)})`;
  }

  private marcas(inicio: number, extension: number): number[] {
    const paso = pasoDeEje(extension);
    const primera = Math.ceil(inicio / paso) * paso;
    const salida: number[] = [];
    for (let v = primera; v <= inicio + extension; v += paso) salida.push(Math.round(v * 100) / 100);
    return salida;
  }
}
