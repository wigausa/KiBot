import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  input,
  output,
  signal,
  viewChild
} from '@angular/core';

import { WarehouseAisle, WarehouseMap } from '../warehouse-map.models';

/** Las tres piezas que se pueden colocar. No hay más, y eso es lo que mantiene el plano sano. */
export type PiezaDelPlano = 'pasillo' | 'bloque' | 'muro';

export type Extremo = 'inicio' | 'fin';
export type Lado = 'norte' | 'sur' | 'este' | 'oeste';
export type Tramo = 'inferior' | 'superior';

/** Por qué tramos corre un pasillo. Uno que corre por uno solo no llega a las caras del otro. */
export type TramosDePasillo = 'ambos' | 'inferior' | 'superior';

/** Dónde va un bloque: entre dos pasillos, o contra el muro de un extremo. */
export type SitioDelBloque = readonly [number, number] | Extremo;

/** Los tamaños de tramo que dijo el cliente. Un bloque es de uno de estos tres. */
export const LARGOS_DE_BLOQUE = [7, 13, 14] as const;
export type LargoDeBloque = (typeof LARGOS_DE_BLOQUE)[number];

/** Lo que el lienzo pide cambiar del plano. Lo aplica la pantalla, que es quien tiene el texto. */
export type PlanCanvasAction =
  | { tipo: 'anadir-pasillo'; extremo: Extremo; tramos: TramosDePasillo }
  | { tipo: 'completar-pasillo'; numero: number }
  | { tipo: 'quitar-pasillo'; numero: number }
  | { tipo: 'poner-bloque'; donde: SitioDelBloque; inferior: number; superior: number }
  | { tipo: 'anadir-muro'; lado: Lado; tramo?: Tramo }
  | { tipo: 'quitar-muro'; indice: number };

/** Una cara de estantería que hay que señalar: la de una caja buscada, o una de sus candidatas. */
export interface CaraResaltada {
  readonly rackId: string;
  /** `left` o `right`, como en el mapa. */
  readonly side: string;
}

/** Lo que mide la rejilla, para poder dibujar el marco aunque el plano esté vacío. */
export interface RejillaDelPlano {
  readonly inferior: number;
  readonly superior: number;
  readonly largoSegmento: number;
  readonly hueco: number;
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
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '(pointermove)': 'mover($event)',
    '(pointerup)': 'soltar($event)',
    '(pointercancel)': 'soltar($event)'
  },
  templateUrl: './plan-canvas.html',
  styleUrl: './plan-canvas.scss'
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

  private readonly clavesResaltadas = computed(
    () => new Set(this.resaltadas().map((c) => `${c.rackId}-${c.side}`))
  );

  protected readonly hayResaltado = computed(() => this.clavesResaltadas().size > 0);

  private readonly svg = viewChild<ElementRef<SVGSVGElement>>('lienzo');

  protected readonly largos = LARGOS_DE_BLOQUE;
  protected readonly largoElegido = signal<LargoDeBloque>(13);

  protected readonly arrastrando = signal<PiezaDelPlano | null>(null);
  protected readonly huecoActivo = signal<string | null>(null);
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
      medio: dosTramos ? (finInferior + inicioSuperior) / 2 : total / 2,
      dosTramos
    };
  });

  protected readonly viewBox = computed(() => {
    const p = this.plano();
    return `${p.X} ${p.Y} ${p.Width} ${p.Depth}`;
  });

  private readonly espejoY = computed(() => 2 * this.plano().Y + this.plano().Depth);

  /** De una Y del plano a la Y de la pantalla. <c>alto</c> es el de la figura que se dibuja. */
  protected yDe(y: number, alto = 0): number {
    return this.espejoY() - y - alto;
  }

  protected readonly trazo = computed(() => Math.max(this.plano().Width, this.plano().Depth) / 900);

  protected readonly anchoPasillo = computed(() => this.pasillos()[0]?.Width ?? 1.6);
  protected readonly anchoBloque = computed(() => this.map().ResolvedWith.ShelvingWidth);
  protected readonly paso = computed(() => this.anchoPasillo() + this.anchoBloque());

  /**
   * El cuerpo de letra de las anclas, en metros del plano.
   *
   * <p>Va por el lado MAYOR del encuadre, que es el que decide a qué escala se dibuja todo: con el
   * menor, una bodega larga y estrecha —que es lo que es un cooler— las dejaba ilegibles.</p>
   */
  protected readonly tamanoDeAncla = computed(() =>
    Math.max(this.plano().Width, this.plano().Depth) / 22
  );

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
        resaltada: this.clavesResaltadas().has(`${u.RackId}-${f.Side}`)
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
      a.Anchors.map((p) => ({ id: `${a.AisleId}.${p.Ordinal}`, x: p.X, y: p.Y, ordinal: p.Ordinal }))
    )
  );

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
   * Dónde puede ir un muro.
   *
   * <p><b>Los de los lados van por tramo, no de punta a punta.</b> La transversal es un pasaje: un
   * muro que la cruzara la dejaría cerrada por los extremos, y por ahí no pasa ningún muro de una
   * bodega de verdad.</p>
   */
  private huecosDeMuro(): Hueco[] {
    const inv = this.map().Inventory;
    const m = this.marco();
    const grosor = Math.max(inv.Width, inv.Depth) / 25;

    const extremos: Hueco[] = [
      { id: 'norte', x: inv.X, y: inv.Y + inv.Depth - grosor, ancho: inv.Width, fondo: grosor, accion: { tipo: 'anadir-muro', lado: 'norte' } },
      { id: 'sur', x: inv.X, y: inv.Y, ancho: inv.Width, fondo: grosor, accion: { tipo: 'anadir-muro', lado: 'sur' } }
    ];

    const lados: Lado[] = ['oeste', 'este'];
    const xDe = (lado: Lado) => (lado === 'oeste' ? inv.X : inv.X + inv.Width - grosor);

    if (!m.dosTramos) {
      return [
        ...extremos,
        ...lados.map((lado) => ({
          id: lado,
          x: xDe(lado),
          y: 0,
          ancho: grosor,
          fondo: m.total,
          accion: { tipo: 'anadir-muro' as const, lado }
        }))
      ];
    }

    return [
      ...extremos,
      ...lados.flatMap((lado) => [
        {
          id: `${lado}-inferior`,
          x: xDe(lado),
          y: 0,
          ancho: grosor,
          fondo: m.finInferior,
          accion: { tipo: 'anadir-muro' as const, lado, tramo: 'inferior' as const }
        },
        {
          id: `${lado}-superior`,
          x: xDe(lado),
          y: m.inicioSuperior,
          ancho: grosor,
          fondo: m.total - m.inicioSuperior,
          accion: { tipo: 'anadir-muro' as const, lado, tramo: 'superior' as const }
        }
      ])
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
    const m = this.marco();
    const ancho = this.anchoPasillo();

    const porTramo = (id: string, x: number, extremo: Extremo): Hueco[] => {
      if (!m.dosTramos) {
        return [{ id, x, y: 0, ancho, fondo: m.total, accion: { tipo: 'anadir-pasillo', extremo, tramos: 'ambos' } }];
      }

      // La franja del medio, sobre la transversal, es la del pasillo completo: es donde está el
      // paso de un tramo al otro, y por eso es ahí donde tiene sentido pedir los dos.
      const margen = (m.inicioSuperior - m.finInferior) / 2;

      return [
        { id: `${id}-inferior`, x, y: 0, ancho, fondo: m.finInferior - margen, accion: { tipo: 'anadir-pasillo', extremo, tramos: 'inferior' } },
        { id: `${id}-ambos`, x, y: m.finInferior - margen, ancho, fondo: (m.inicioSuperior - m.finInferior) + 2 * margen, accion: { tipo: 'anadir-pasillo', extremo, tramos: 'ambos' } },
        { id: `${id}-superior`, x, y: m.inicioSuperior + margen, ancho, fondo: m.total - m.inicioSuperior - margen, accion: { tipo: 'anadir-pasillo', extremo, tramos: 'superior' } }
      ];
    };

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

    const pasillos = this.pasillos();
    const paso = this.paso();

    // El hueco va donde de verdad va a caer el pasillo nuevo: un paso entero más allá del último.
    // Midiéndolo desde el borde del recinto caía encima del bloque del extremo, y la sombra
    // prometía un sitio que ya estaba ocupado.
    const primerX = Math.min(...pasillos.map((a) => a.X));
    const ultimoX = Math.max(...pasillos.map((a) => a.X));

    // Los dos extremos, siempre. Hacia la izquierda la numeración no cabe por debajo del 1, así
    // que la pantalla corre la numeración entera — un plano se dibuja hacia donde haga falta.
    return [
      ...porTramo('inicio', primerX - paso - ancho / 2, 'inicio'),
      ...porTramo('fin', ultimoX + paso - ancho / 2, 'fin'),
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
      // El bloque que ya esté puesto tiene que encontrarse a sí mismo: pasando null, soltar en el
      // tramo de arriba borraba el de abajo en vez de sumarse a él.
      const yaPuesto = this.bloques()[0] ?? null;
      const x = yaPuesto !== null ? yaPuesto.x : inv.X + inv.Width / 2 - ancho / 2;

      return porTramo('primero', x, 'inicio', yaPuesto);
    }

    const existentes = this.bloques();
    const pasillos = [...this.pasillos()].sort((a, b) => a.X - b.X);
    const bloqueEn = (centro: number) =>
      existentes.find((b) => Math.abs(b.x + b.ancho / 2 - centro) < 0.01) ?? null;

    const salida: Hueco[] = [];

    const antes = pasillos[0].X - this.anchoPasillo() / 2 - ancho / 2;
    salida.push(...porTramo('inicio', antes - ancho / 2, 'inicio', bloqueEn(antes)));

    for (let i = 0; i + 1 < pasillos.length; i++) {
      const a = pasillos[i].Number;
      const b = pasillos[i + 1].Number;
      if (a === null || b === null) continue;

      const centro = (pasillos[i].X + pasillos[i + 1].X) / 2;
      salida.push(...porTramo(`e${a}-${b}`, centro - ancho / 2, [a, b] as const, bloqueEn(centro)));
    }

    const despues = pasillos[pasillos.length - 1].X + this.anchoPasillo() / 2 + ancho / 2;
    salida.push(...porTramo('fin', despues - ancho / 2, 'fin', bloqueEn(despues)));

    return salida;
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
  }

  protected mover(evento: PointerEvent): void {
    if (this.arrastrando() === null) return;
    const punto = this.enMetros(evento);
    this.huecoActivo.set(punto === null ? null : (this.huecoBajo(punto)?.id ?? null));
  }

  protected soltar(evento: PointerEvent): void {
    const pieza = this.arrastrando();
    if (pieza === null) return;

    const punto = this.enMetros(evento);
    const hueco = punto === null ? null : this.huecoBajo(punto);

    this.arrastrando.set(null);
    this.huecoActivo.set(null);

    if (hueco !== null) this.accion.emit(hueco.accion);
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
    return { x: punto.x, y: this.espejoY() - punto.y };
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
    if (!this.editable()) return;
    this.bloqueActivo.set(this.bloqueActivo() === id ? null : id);
  }

  protected quitarPasillo(numero: number): void {
    this.accion.emit({ tipo: 'quitar-pasillo', numero });
  }

  protected quitarMuro(indice: number): void {
    this.accion.emit({ tipo: 'quitar-muro', indice });
  }

  /** Quita un tramo entero del bloque: es lo que deja un bloque de un solo tramo. */
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
