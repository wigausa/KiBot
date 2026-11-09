import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';

import { KiBotButton } from '../../shared/ui/kibot-button/kibot-button';
import { KiBotErrorState } from '../../shared/ui/kibot-error-state/kibot-error-state';
import { KiBotLoadingIndicator } from '../../shared/ui/kibot-loading-indicator/kibot-loading-indicator';
import {
  PlanCanvas,
  PlanCanvasAction,
  RejillaDelPlano,
  SitioDelBloque
} from './plan-canvas/plan-canvas';
import {
  PlanBloque,
  PlanColumnaDeMuro,
  PlanMedidas,
  PlanMuro,
  PlanRangoDePasillos,
  WarehouseMap as MapaDeBodega,
  WarehousePlan
} from './warehouse-map.models';
import { CompanyStore } from '../../core/company/company.store';
import { WarehouseMapStore } from './warehouse-map.store';

type Modo = 'lienzo' | 'texto';

/** Si un rango de pasillos corre por los mismos tramos que el que se quiere añadir. */
function mismoTramo(rango: PlanRangoDePasillos, tramos: string | undefined): boolean {
  return (rango.tramos ?? 'ambos') === (tramos ?? 'ambos');
}

/** Si dos pares de pasillos nombran la misma columna. */
function mismaColumna(a: readonly [number, number], b: readonly [number, number]): boolean {
  return a[0] === b[0] && a[1] === b[1];
}

/**
 * Dos muros de la misma columna hechos uno. Si alguno está cerrado (`completo`), el resultado
 * también: sumar un tramo no puede reabrir la transversal. Si no, tramos distintos —o alguno de
 * los dos— dan uno de los dos tramos con la transversal abierta (sin `tramos`).
 */
export function unirMuros(
  a: PlanColumnaDeMuro | null | undefined,
  b: PlanColumnaDeMuro | null | undefined
): PlanColumnaDeMuro | null {
  // Solo los tramos: el muro puede venir de otra columna, y su `entre` no vale para la nueva.
  const tramos = (m: PlanColumnaDeMuro): PlanColumnaDeMuro => (m.tramos ? { tramos: m.tramos } : {});
  if (!a) return b ? tramos(b) : null;
  if (!b) return tramos(a);
  if (a.tramos === 'completo' || b.tramos === 'completo') return { tramos: 'completo' };
  return a.tramos !== undefined && a.tramos === b.tramos ? tramos(a) : {};
}

/**
 * Los muros por coordenadas —los del norte y el sur— corridos en X.
 *
 * <p>Los pasillos y los bloques se colocan por su <b>posición en la lista</b>, desde x = 0; estos
 * muros, por coordenadas. Cuando lo demás se corre tienen que correrse con ello o se quedan atrás.</p>
 *
 * <p>Con <c>masAllaDe</c> solo se corren los extremos que quedan a su derecha. Va por extremo y no
 * por muro porque uno del norte o del sur cruza la bodega: al crecer por la izquierda se estira, y
 * al quitar un pasillo se acorta.</p>
 */
export function murosCorridos(
  muros: readonly PlanMuro[] | undefined,
  dx: number,
  masAllaDe = Number.NEGATIVE_INFINITY
): PlanMuro[] | undefined {
  const corrido = ([x, y]: [number, number]): [number, number] => [x > masAllaDe ? x + dx : x, y];
  return muros?.map((muro) => ({ desde: corrido(muro.desde), hasta: corrido(muro.hasta) }));
}

/**
 * Las medidas con las que arranca un plano nuevo: las del 7000.
 *
 * <p>Son un punto de partida, no una ley. Están aquí para que nadie tenga que escribir seis números
 * antes de poder colocar la primera pieza; se cambian en el modo texto cuando la bodega sea otra.</p>
 */
const MEDIDAS_POR_DEFECTO: PlanMedidas = {
  anchoPasillo: 1.6,
  anchoBloque: 1.96,
  largoSegmento: 1.27,
  separacionTramos: 1.96,
  niveles: 4,
  huecosPorSegmento: 1,
  grosorMuro: 0.2
};

/** Los datos del plano que se cambian sin abrir el texto. */
type DatoDelPlano = 'nombre' | 'companyId' | 'numeracionHacia';

/**
 * Un plano de ejemplo para el modo texto, con todos los campos que existen. Es válido tal cual: se
 * puede previsualizar y luego cambiar, en vez de escribir el esquema de memoria.
 */
const EJEMPLO_DE_PLANO = JSON.stringify(
  {
    nombre: 'Cooler 1',
    companyId: 1,
    notas: ['Texto libre: lo que falte por confirmar en sitio'],
    origen: { descripcion: 'Esquina del muelle 1, junto a la puerta', x: 0, y: 0 },
    medidas: {
      anchoPasillo: 1.6,
      anchoBloque: 1.96,
      largoSegmento: 1.27,
      separacionTramos: 1.96,
      niveles: 4,
      huecosPorSegmento: 1,
      grosorMuro: 0.2
    },
    numeracionHacia: 'derecha',
    pasillos: [{ desde: 1, hasta: 4 }],
    bloques: { inferior: 13, superior: 13 },
    excepciones: [{ entre: [3, 4], superior: 9 }],
    bloqueInicial: { inferior: 13, superior: 13 },
    muroFinal: { tramos: 'completo' },
    murosEntre: [{ entre: [1, 2], tramos: 'inferior' }],
    muroNorte: true,
    muroSur: true
  },
  null,
  2
);

/**
 * Un plano recién empezado: sin pasillos todavía, pero ya expandible en cuanto caiga el primero.
 *
 * <p><b>Sin nombre</b>: el campo enseña un ejemplo y se rellena antes de guardar. El origen va con
 * su texto de pendiente; ya no se pide en pantalla y se ajusta en el modo texto cuando se confirme
 * en sitio.</p>
 */
function planoEnBlanco(companyId: number | null = null): WarehousePlan {
  return {
    nombre: '',
    companyId: companyId ?? 1,
    origen: { descripcion: 'PENDIENTE DE CONFIRMAR EN SITIO', x: 0, y: 0 },
    medidas: { ...MEDIDAS_POR_DEFECTO },
    pasillos: [],
    bloques: { inferior: 13, superior: 13 }
  };
}

/**
 * El plano de bodega: dibujándolo con piezas o pegándolo como texto.
 *
 * <p><b>Los dos modos editan el mismo documento.</b> Y pueden hacerlo porque el lienzo no dibuja
 * geometría libre: coloca <b>piezas enteras de medida conocida</b> —pasillo, bloque, muro—, y cada
 * gesto se traduce a una línea del plano. Un bloque más al final es `hasta: 34`; ocho segmentos en
 * uno concreto es una excepción.</p>
 *
 * <p><b>Una desviación consciente del esqueleto estándar de pantalla:</b> la skill del repo propone
 * tapar el contenido con un indicador de carga mientras se espera. Aquí no se puede, porque lo que
 * se taparía es el texto que la persona acaba de escribir. Así que el formulario y el lienzo
 * <b>siempre están montados</b>, y los estados de carga y error viven dentro del panel de
 * resultado.</p>
 */
@Component({
  selector: 'app-warehouse-map',
  imports: [PlanCanvas, KiBotButton, KiBotErrorState, KiBotLoadingIndicator],
  providers: [WarehouseMapStore],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './warehouse-map.html',
  styleUrl: './warehouse-map.scss'
})
export class WarehouseMap {
  /** Dentro de «Planos y zonas»: sin el título de página propio. */
  readonly embebido = input(false);

  protected readonly store = inject(WarehouseMapStore);
  protected readonly companias = inject(CompanyStore);
  protected readonly modo = signal<Modo>('lienzo');

  /** El ejemplo que guía el modo texto: un plano completo y válido, con cada campo que existe. */
  protected readonly ejemplo = EJEMPLO_DE_PLANO;

  constructor() {
    void this.companias.cargar();
  }

  /**
   * Las compañías para elegir. Si el plano trae una que no está en la lista —un JSON pegado de
   * otro sitio—, se añade tal cual: el select no puede cambiarla en silencio por la primera.
   */
  protected readonly listaDeCompanias = computed(() => {
    const estado = this.companias.companias();
    const lista = estado.status === 'ready' ? estado.value : [];
    const id = Number(this.datoDel('companyId'));
    return lista.some((c) => c.idCompany === id) || !id ? lista : [{ idCompany: id, name: `Compañía ${id}` }, ...lista];
  });

  /** Un plano en blanco de la compañía con la que se está trabajando. */
  private planoNuevo(): WarehousePlan {
    return planoEnBlanco(this.companias.companiaId());
  }

  /** Empieza el modo texto con el ejemplo, para cambiarlo en vez de escribirlo desde cero. */
  protected usarEjemplo(): void {
    this.store.escribir(this.ejemplo);
  }

  /**
   * Lo que dibuja el lienzo: el mapa expandido, o un solar vacío si todavía no hay plano.
   *
   * <p>Es lo que permite <b>empezar dibujando</b>, sin pegar un JSON antes. El solar no sale de
   * ningún sitio real: es un rectángulo donde soltar la primera pieza.</p>
   */
  protected readonly lienzo = computed<MapaDeBodega>(
    () => this.store.mapa() ?? this.solarVacio()
  );

  /**
   * Lo que mide la rejilla, para que el lienzo pueda dibujar el marco de anclas aunque el plano
   * esté vacío. Sale del plano, no del mapa: el marco existe antes que la primera pieza.
   */
  protected readonly rejilla = computed<RejillaDelPlano>(() => {
    const plan = this.planActual() ?? this.planoNuevo();
    return {
      inferior: plan.bloques?.inferior ?? 0,
      superior: plan.bloques?.superior ?? 0,
      largoSegmento: plan.medidas?.largoSegmento ?? MEDIDAS_POR_DEFECTO.largoSegmento,
      hueco: plan.medidas?.separacionTramos ?? MEDIDAS_POR_DEFECTO.separacionTramos
    };
  });

  /** Si el plano todavía no tiene nada: ni un pasillo ni una estantería. */
  protected readonly enBlanco = computed(() => {
    const mapa = this.lienzo();
    return mapa.Aisles.length === 0 && mapa.ShelvingUnits.length === 0;
  });

  private solarVacio(): MapaDeBodega {
    const plan = this.planActual();
    const m = plan?.medidas ?? MEDIDAS_POR_DEFECTO;
    const r = this.rejilla();

    // El solar se mide desde el MARCO, no de un número redondo: si no, el ancla `.3` cae fuera del
    // encuadre y no se ve. El ancho da para unos cuantos pasos de pasillo.
    const dosTramos = r.inferior > 0 && r.superior > 0;
    const alto = (r.inferior + r.superior) * r.largoSegmento + (dosTramos ? r.hueco : 0);
    const ancho = (m.anchoBloque + m.anchoPasillo) * 4;
    const margen = Math.max(alto, ancho) / 12;

    return {
      MapId: '', Name: '', CompanyId: 0, Version: 0, Unit: 'meter',
      Origin: { Description: '', X: 0, Y: 0 },
      Plane: { X: -margen, Y: -margen, Width: ancho + 2 * margen, Depth: alto + 2 * margen },
      Inventory: { X: 0, Y: 0, Width: ancho, Depth: alto },
      Aisles: [], ShelvingUnits: [], Walls: [],
      ResolvedWith: {
        ShelvingWidth: m.anchoBloque,
        ShelvingSlotSpacing: m.largoSegmento,
        FaceOffset: m.anchoBloque / 2,
        GridSize: 4
      }
    };
  }

  /** Cambia un dato de identidad del plano sin tener que abrir el texto. */
  protected async cambiarDato(campo: DatoDelPlano, valor: string): Promise<void> {
    const plan = this.planActual() ?? this.planoNuevo();

    const nuevo: WarehousePlan =
      campo === 'nombre'
        ? { ...plan, nombre: valor }
        : campo === 'companyId'
          ? { ...plan, companyId: Number(valor) || 0 }
          : { ...plan, numeracionHacia: valor === 'izquierda' ? 'izquierda' : 'derecha' };

    // Sin pasillos el plano todavía no se puede expandir, así que se guarda sin previsualizar:
    // pedirlo devolvería un error que no dice nada útil mientras aún no has dibujado nada.
    if ((nuevo.pasillos ?? []).length === 0) this.store.escribir(JSON.stringify(nuevo, null, 2));
    else await this.store.aplicar(nuevo);
  }

  protected datoDel(campo: DatoDelPlano): string {
    const plan = this.planActual() ?? this.planoNuevo();
    if (campo === 'nombre') return plan.nombre;
    if (campo === 'companyId') return String(plan.companyId);
    return plan.numeracionHacia ?? 'derecha';
  }

  protected cambiarModo(modo: Modo): void {
    this.modo.set(modo);
  }

  protected alEscribir(evento: Event): void {
    this.store.escribir((evento.target as HTMLTextAreaElement).value);
  }

  /**
   * Un gesto del lienzo cambia el plano, y el plano vuelve a previsualizarse.
   *
   * <p>Esa ida y vuelta es lo que mantiene el dibujo honesto: lo que se ve siempre es lo que el
   * backend entiende del plano, no lo que el frontend cree que debería salir.</p>
   */
  protected async alActuar(accion: PlanCanvasAction): Promise<void> {
    const plan = this.planActual();
    if (plan === null) return;

    const nuevo = this.aplicar(plan, accion);
    if (nuevo !== null) await this.store.aplicar(nuevo);
  }

  private aplicar(plan: WarehousePlan, accion: PlanCanvasAction): WarehousePlan | null {
    let rangos = [...(plan.pasillos ?? [])].sort((a, b) => a.desde - b.desde);

    switch (accion.tipo) {
      case 'anadir-pasillo': {
        const tramos = accion.tramos === 'ambos' ? undefined : accion.tramos;

        if (rangos.length === 0) {
          return { ...plan, pasillos: [{ desde: 1, hasta: 1, tramos }] };
        }

        if (accion.extremo === 'inicio') {
          // Por debajo del 1 no hay pasillo, así que para crecer hacia la izquierda se corre la
          // numeración entera: el nuevo pasa a ser el 1 y los demás suben uno.
          //
          // Se hace solo DIBUJANDO, que es cuando el plano todavía no nombra nada de nadie. Sobre
          // un plano ya en uso renumerar cambiaría el nombre de sitios que no se han tocado — por
          // eso quitar un pasillo del medio sí parte el rango en vez de recolocar.
          const corridos =
            rangos[0].desde <= 1
              ? rangos.map((r) => ({ ...r, desde: r.desde + 1, hasta: r.hasta + 1 }))
              : rangos;

          const mas1 = (e: [number, number]): [number, number] => [e[0] + 1, e[1] + 1];
          const conTodoCorrido =
            corridos === rangos
              ? plan
              : {
                  ...plan,
                  excepciones: (plan.excepciones ?? []).map((e) => ({ ...e, entre: mas1(e.entre) })),
                  murosEntre: plan.murosEntre?.map((w) => ({ ...w, entre: mas1(w.entre) }))
                };

          // El pasillo nuevo entra en la PRIMERA posición, así que todo lo que ya estaba se corre un
          // paso a la derecha. Un muro del norte o del sur se estira hasta él: su punta del oeste
          // se queda en 0 y la otra va con lo demás.
          const paso = plan.medidas.anchoBloque + plan.medidas.anchoPasillo;
          plan = { ...conTodoCorrido, muros: murosCorridos(conTodoCorrido.muros, paso, 0.01) };
          rangos = corridos;

          const nuevo = rangos[0].desde - 1;
          const primero = rangos[0].desde;
          const pasillos = mismoTramo(rangos[0], tramos)
            ? [{ ...rangos[0], desde: nuevo }, ...rangos.slice(1)]
            : [{ desde: nuevo, hasta: nuevo, tramos }, ...rangos];

          // Lo del extremo NO se mueve: deja de ser «lo de antes del primero» y pasa a estar entre
          // el pasillo nuevo y el que era primero. Con un muro, el pasillo nuevo queda pegado a él
          // por el otro lado; con un bloque, el bloque se queda donde se ve en vez de saltar al
          // otro lado del pasillo recién puesto.
          if (plan.muroInicial) {
            return this.conMuro({ ...plan, pasillos, muroInicial: null }, [nuevo, primero], plan.muroInicial);
          }
          return this.conColumna(
            { ...plan, pasillos, bloqueInicial: null },
            [nuevo, primero],
            plan.bloqueInicial ?? null
          );
        }

        const u = rangos.length - 1;
        const nuevo = rangos[u].hasta + 1;
        const ultimo = rangos[u].hasta;
        const pasillos = mismoTramo(rangos[u], tramos)
          ? [...rangos.slice(0, u), { ...rangos[u], hasta: nuevo }]
          : [...rangos, { desde: nuevo, hasta: nuevo, tramos }];

        if (plan.muroFinal) {
          return this.conMuro({ ...plan, pasillos, muroFinal: null }, [ultimo, nuevo], plan.muroFinal);
        }
        return this.conColumna(
          { ...plan, pasillos, bloqueFinal: null },
          [ultimo, nuevo],
          plan.bloqueFinal ?? null
        );
      }

      case 'completar-pasillo': {
        // Soltar un pasillo en el tramo que le falta TERMINA el que ya está, en vez de abrir otro
        // con un número nuevo — que es lo que uno espera al apuntar a la misma columna.
        const salida: PlanRangoDePasillos[] = [];

        for (const r of rangos) {
          if (accion.numero < r.desde || accion.numero > r.hasta) {
            salida.push({ ...r });
            continue;
          }
          if (accion.numero > r.desde) salida.push({ desde: r.desde, hasta: accion.numero - 1, tramos: r.tramos });
          salida.push({ desde: accion.numero, hasta: accion.numero });
          if (accion.numero < r.hasta) salida.push({ desde: accion.numero + 1, hasta: r.hasta, tramos: r.tramos });
        }

        return { ...plan, pasillos: salida };
      }

      case 'quitar-pasillo':
        return this.quitarPasillo(plan, rangos, accion.numero);

      case 'poner-bloque':
        return this.ponerBloque(plan, rangos, accion.donde, accion.inferior, accion.superior);

      case 'anadir-muro':
        // Sin coordenadas: el backend lo pone por fuera de lo que haya, aunque crezca después.
        return accion.lado === 'norte' ? { ...plan, muroNorte: true } : { ...plan, muroSur: true };

      case 'poner-muro':
        // Un muro va solo al lado de pasillos: sobre una columna con bloque no se pone. Antes se
        // ponía y se comía el bloque.
        if (this.hayBloqueEn(plan, accion.donde)) return null;
        return this.conMuro(plan, accion.donde, { tramos: accion.tramos });

      case 'quitar-muro':
        return this.quitarMuro(plan, accion.wallId);
    }
  }

  /**
   * Quita un pasillo. Las dos columnas que lo rodeaban se juntan en una.
   *
   * <p>Si alguna de las dos era de muro, la que queda también lo es —con los tramos de las dos—:
   * quitar un pasillo no puede hacer desaparecer un muro. Si no, queda el bloque general.</p>
   *
   * <p>Los pasillos se colocan por su posición en la lista, así que lo que estaba a la derecha del
   * quitado se corre. Los muros del norte y del sur se acortan con ello.</p>
   */
  private quitarPasillo(plan: WarehousePlan, rangos: PlanRangoDePasillos[], k: number): WarehousePlan | null {
    const quedan = this.sinPasillo(rangos, k);
    if (quedan === null) return null;

    const numeros = rangos.flatMap((r) => Array.from({ length: r.hasta - r.desde + 1 }, (_, i) => r.desde + i));
    const i = numeros.indexOf(k);
    const p = numeros[i - 1] ?? null;
    const q = numeros[i + 1] ?? null;

    const izquierda: SitioDelBloque = p === null ? 'inicio' : [p, k];
    const derecha: SitioDelBloque = q === null ? 'fin' : [k, q];
    const queda: SitioDelBloque = p === null ? 'inicio' : q === null ? 'fin' : [p, q];
    const muro = unirMuros(this.muroEn(plan, izquierda), this.muroEn(plan, derecha));

    let siguiente: WarehousePlan = {
      ...plan,
      pasillos: quedan,
      // Lo que nombraba al pasillo quitado ya no existe: dejarlo haría el plano inválido.
      excepciones: (plan.excepciones ?? []).filter((e) => !e.entre.includes(k)),
      murosEntre: plan.murosEntre?.filter((w) => !w.entre.includes(k)),
      muros: this.murosAlQuitar(plan, k, p, q, muro !== null)
    };
    if (muro !== null) siguiente = this.conMuro(siguiente, queda, muro);

    return siguiente;
  }

  /**
   * Los muros por coordenadas tras quitar el pasillo <c>k</c>: lo que está a su derecha se corre lo
   * que mida lo quitado. Se mide en el mapa que se ve, porque con columnas de muro el paso ya no es
   * fijo.
   */
  private murosAlQuitar(plan: WarehousePlan, k: number, p: number | null, q: number | null, quedaMuro: boolean): PlanMuro[] | undefined {
    const mapa = this.store.mapa();
    const xDe = (n: number) => mapa?.Aisles.find((a) => a.Number === n)?.X;
    const xk = xDe(k);
    if (!plan.muros?.length || xk === undefined) return plan.muros;

    const m = plan.medidas;
    const columna = quedaMuro ? m.grosorMuro ?? 0.2 : m.anchoBloque;

    let dx: number;
    if (q !== null) {
      const xq = xDe(q);
      const xp = p === null ? undefined : xDe(p);
      if (xq === undefined || (p !== null && xp === undefined)) return plan.muros;
      const nuevoXq = (xp === undefined ? 0 : xp + m.anchoPasillo / 2) + columna + m.anchoPasillo / 2;
      dx = nuevoXq - xq;
    } else {
      const xp = p === null ? undefined : xDe(p);
      if (xp === undefined) return plan.muros;
      dx = xp - xk;
    }

    return murosCorridos(plan.muros, dx, xk);
  }

  /** El muro de una columna, si lo tiene. */
  private muroEn(plan: WarehousePlan, donde: SitioDelBloque): PlanColumnaDeMuro | null {
    if (donde === 'inicio') return plan.muroInicial ?? null;
    if (donde === 'fin') return plan.muroFinal ?? null;
    return plan.murosEntre?.find((w) => mismaColumna(w.entre, donde)) ?? null;
  }

  /**
   * Pone un muro en una columna, sumándolo al que ya haya. La columna deja de ser de bloque: lo que
   * hubiera ahí desaparece, porque al lado de un muro solo van pasillos.
   */
  /**
   * Si una columna tiene estantería en algún tramo. Entre dos pasillos, sin excepción, lo que haya
   * es el bloque general; una columna de muro no tiene ninguno.
   */
  private hayBloqueEn(plan: WarehousePlan, donde: SitioDelBloque): boolean {
    const tiene = (b: PlanBloque | null | undefined) => !!b && ((b.inferior ?? 0) > 0 || (b.superior ?? 0) > 0);

    if (donde === 'inicio') return tiene(plan.bloqueInicial);
    if (donde === 'fin') return tiene(plan.bloqueFinal);
    if (this.muroEn(plan, donde) !== null) return false;

    const excepcion = (plan.excepciones ?? []).find((e) => mismaColumna(e.entre, donde));
    return tiene(excepcion ?? plan.bloques);
  }

  private conMuro(plan: WarehousePlan, donde: SitioDelBloque, muro: PlanColumnaDeMuro): WarehousePlan {
    const unido = unirMuros(this.muroEn(plan, donde), muro) ?? {};

    if (donde === 'inicio') return { ...plan, muroInicial: unido, bloqueInicial: null };
    if (donde === 'fin') return { ...plan, muroFinal: unido, bloqueFinal: null };

    return {
      ...plan,
      excepciones: (plan.excepciones ?? []).filter((e) => !mismaColumna(e.entre, donde)),
      murosEntre: [
        ...(plan.murosEntre ?? []).filter((w) => !mismaColumna(w.entre, donde)),
        { entre: [donde[0], donde[1]], ...unido }
      ]
    };
  }

  /**
   * Quita un muro por el id que le dio el backend: <c>MN</c> y <c>MS</c> son el norte y el sur;
   * <c>M01</c>, uno por coordenadas de un plano viejo; <c>ME4-5.inferior</c>, el tramo de una
   * columna. Quitar un tramo de un muro de los dos deja el otro; quitar el último deja la columna
   * <b>vacía</b>, no con un bloque que nadie puso.
   */
  private quitarMuro(plan: WarehousePlan, wallId: string): WarehousePlan | null {
    if (wallId === 'MN') return { ...plan, muroNorte: false };
    if (wallId === 'MS') return { ...plan, muroSur: false };

    const porCoordenadas = /^M(\d+)$/.exec(wallId);
    if (porCoordenadas) {
      const indice = Number(porCoordenadas[1]) - 1;
      const muros = [...(plan.muros ?? [])];
      if (indice < 0 || indice >= muros.length) return null;
      muros.splice(indice, 1);
      return { ...plan, muros };
    }

    const deColumna = /^(MI|MF|ME(\d+)-(\d+))\.(ambos|inferior|superior|completo)$/.exec(wallId);
    if (!deColumna) return null;

    const donde: SitioDelBloque =
      deColumna[1] === 'MI' ? 'inicio' : deColumna[1] === 'MF' ? 'fin' : [Number(deColumna[2]), Number(deColumna[3])];
    const actual = this.muroEn(plan, donde);
    if (actual === null) return null;

    const tramo = deColumna[4];
    const resto: PlanColumnaDeMuro | null =
      tramo === 'ambos' || actual.tramos === tramo
        ? null
        : actual.tramos === undefined
          ? { tramos: tramo === 'inferior' ? 'superior' : 'inferior' }
          : actual;

    if (donde === 'inicio') return { ...plan, muroInicial: resto };
    if (donde === 'fin') return { ...plan, muroFinal: resto };

    const otros = (plan.murosEntre ?? []).filter((w) => !mismaColumna(w.entre, donde));
    if (resto !== null) return { ...plan, murosEntre: [...otros, { entre: [donde[0], donde[1]], ...resto }] };

    return this.conColumna({ ...plan, murosEntre: otros }, [donde[0], donde[1]], null);
  }

  /**
   * Fija qué hay en la columna que acaba de aparecer entre dos pasillos.
   *
   * <p>Con <c>bloque</c> nulo la declara <b>vacía</b>, y eso es lo que impide que colocar un pasillo
   * haga aparecer una estantería sola: los bloques de en medio salen del caso general de
   * <c>bloques</c> —lo que hace que el plano del 7000 quepa en treinta líneas— y dibujando se
   * espera lo contrario.</p>
   *
   * <p>Con un bloque, lo mete ahí: es como la estantería de un extremo se queda quieta cuando se
   * pone un pasillo más allá.</p>
   */
  private conColumna(
    plan: WarehousePlan,
    entre: [number, number],
    bloque: PlanBloque | null
  ): WarehousePlan {
    const otras = (plan.excepciones ?? []).filter(
      (e) => e.entre[0] !== entre[0] || e.entre[1] !== entre[1]
    );

    const general = plan.bloques ?? {};
    const contenido = bloque ?? { inferior: 0, superior: 0 };

    // Si coincide con el caso general no hace falta excepción, y el archivo se lee mejor sin ella.
    const esGeneral =
      (contenido.inferior ?? 0) === (general.inferior ?? 0) &&
      (contenido.superior ?? 0) === (general.superior ?? 0);

    return {
      ...plan,
      excepciones: esGeneral
        ? otras
        : [...otras, { entre, inferior: contenido.inferior ?? 0, superior: contenido.superior ?? 0 }]
    };
  }

  /**
   * Pone un bloque con los tramos que se le pidan.
   *
   * <p>Un tramo en <b>cero es un bloque de un solo tramo</b>, y es legítimo: no toda bodega tiene
   * los dos. Y los dos en cero quitan el bloque del extremo, que es el único que se declara.</p>
   */
  private ponerBloque(
    plan: WarehousePlan,
    rangos: PlanRangoDePasillos[],
    donde: SitioDelBloque,
    inferior: number,
    superior: number
  ): WarehousePlan {
    // Colocar una estantería NO coloca un pasillo. Se dibuja lo que uno suelta y nada más; esa
    // estantería no se podrá nombrar hasta que llegue su pasillo, y el lienzo ya la pinta en ámbar
    // y el panel la cuenta. Es información, no un fallo que haya que evitar poniendo cosas solo.
    const pasillos = rangos;

    if (typeof donde === 'string') {
      const bloque = inferior === 0 && superior === 0 ? null : { inferior, superior };
      return donde === 'inicio'
        ? { ...plan, pasillos, bloqueInicial: bloque }
        : { ...plan, pasillos, bloqueFinal: bloque };
    }

    const otras = (plan.excepciones ?? []).filter(
      (e) => e.entre[0] !== donde[0] || e.entre[1] !== donde[1]
    );
    const general = plan.bloques ?? {};

    // Si vuelve a ser el caso general no se guarda excepción: el archivo tiene que leerse de un
    // vistazo, y una excepción que no excepciona nada es ruido.
    const esGeneral = inferior === general.inferior && superior === general.superior;

    return {
      ...plan,
      pasillos,
      excepciones: esGeneral
        ? otras
        : [...otras, { entre: [donde[0], donde[1]] as [number, number], inferior, superior }]
    };
  }

  /**
   * Quita un número de los rangos. Si cae en medio, el rango se parte en dos — que es lo correcto:
   * los pasillos llevan la numeración impresa en el plano, y renumerar los de después cambiaría el
   * nombre de sitios que no se han tocado.
   */
  private sinPasillo(
    rangos: readonly PlanRangoDePasillos[],
    numero: number
  ): PlanRangoDePasillos[] | null {
    const salida: PlanRangoDePasillos[] = [];
    let encontrado = false;

    for (const rango of rangos) {
      if (numero < rango.desde || numero > rango.hasta) {
        salida.push({ ...rango });
        continue;
      }

      encontrado = true;
      // Los dos trozos conservan sus tramos: sin eso, quitar uno de varios pasillos de un solo
      // tramo convertía a los demás en pasillos completos.
      if (numero > rango.desde) salida.push({ desde: rango.desde, hasta: numero - 1, tramos: rango.tramos });
      if (numero < rango.hasta) salida.push({ desde: numero + 1, hasta: rango.hasta, tramos: rango.tramos });
    }

    return encontrado && salida.length > 0 ? salida : null;
  }

  /**
   * El plano que se está editando. <b>Si no hay texto todavía, uno en blanco</b> — y eso es lo que
   * permite que la primera pieza arrastrada cree el plano, en vez de exigir pegar un JSON antes.
   */
  private planActual(): WarehousePlan | null {
    const texto = this.store.texto().trim();
    if (texto === '') return this.planoNuevo();

    try {
      return JSON.parse(texto) as WarehousePlan;
    } catch {
      return null;
    }
  }
}
