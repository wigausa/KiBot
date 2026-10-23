import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';

import { KiBotButton } from '../../shared/ui/kibot-button/kibot-button';
import { KiBotErrorState } from '../../shared/ui/kibot-error-state/kibot-error-state';
import { KiBotLoadingIndicator } from '../../shared/ui/kibot-loading-indicator/kibot-loading-indicator';
import {
  Lado,
  PlanCanvas,
  PlanCanvasAction,
  RejillaDelPlano,
  SitioDelBloque,
  Tramo
} from './plan-canvas/plan-canvas';
import {
  PlanBloque,
  PlanMedidas,
  PlanMuro,
  PlanRangoDePasillos,
  WarehouseMap as MapaDeBodega,
  WarehousePlan
} from './warehouse-map.models';
import { WarehouseMapStore } from './warehouse-map.store';

type Modo = 'lienzo' | 'texto';

/** Si un rango de pasillos corre por los mismos tramos que el que se quiere añadir. */
function mismoTramo(rango: PlanRangoDePasillos, tramos: string | undefined): boolean {
  return (rango.tramos ?? 'ambos') === (tramos ?? 'ambos');
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

/** Un plano recién empezado: sin pasillos todavía, pero ya expandible en cuanto caiga el primero. */
function planoEnBlanco(): WarehousePlan {
  return {
    nombre: 'Bodega sin nombre',
    companyId: 1,
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
  protected readonly store = inject(WarehouseMapStore);
  protected readonly modo = signal<Modo>('lienzo');

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
    const plan = this.planActual() ?? planoEnBlanco();
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
  protected async cambiarDato(campo: 'nombre' | 'companyId' | 'origen', valor: string): Promise<void> {
    const plan = this.planActual() ?? planoEnBlanco();

    const nuevo: WarehousePlan =
      campo === 'nombre'
        ? { ...plan, nombre: valor }
        : campo === 'companyId'
          ? { ...plan, companyId: Number(valor) || 0 }
          : { ...plan, origen: { ...plan.origen, descripcion: valor } };

    // Sin pasillos el plano todavía no se puede expandir, así que se guarda sin previsualizar:
    // pedirlo devolvería un error que no dice nada útil mientras aún no has dibujado nada.
    if ((nuevo.pasillos ?? []).length === 0) this.store.escribir(JSON.stringify(nuevo, null, 2));
    else await this.store.aplicar(nuevo);
  }

  protected datoDel(campo: 'nombre' | 'companyId' | 'origen'): string {
    const plan = this.planActual() ?? planoEnBlanco();
    if (campo === 'nombre') return plan.nombre;
    if (campo === 'companyId') return String(plan.companyId);
    return plan.origen?.descripcion ?? '';
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

          const conExcepcionesCorridas =
            corridos === rangos
              ? plan
              : {
                  ...plan,
                  excepciones: (plan.excepciones ?? []).map((e) => ({
                    ...e,
                    entre: [e.entre[0] + 1, e.entre[1] + 1] as [number, number]
                  }))
                };

          plan = conExcepcionesCorridas;
          rangos = corridos;

          const nuevo = rangos[0].desde - 1;
          const pasillos = mismoTramo(rangos[0], tramos)
            ? [{ ...rangos[0], desde: nuevo }, ...rangos.slice(1)]
            : [{ desde: nuevo, hasta: nuevo, tramos }, ...rangos];

          // La estantería del extremo NO se mueve: deja de ser «la de antes del primero» y pasa a
          // estar entre el pasillo nuevo y el que era primero. Sin esto el bloque saltaba al otro
          // lado del pasillo recién puesto, que es lo contrario de lo que uno ve al soltarlo.
          return this.conColumna(
            { ...plan, pasillos, bloqueInicial: null },
            [nuevo, rangos[0].desde],
            plan.bloqueInicial ?? null
          );
        }

        const u = rangos.length - 1;
        const nuevo = rangos[u].hasta + 1;
        const pasillos = mismoTramo(rangos[u], tramos)
          ? [...rangos.slice(0, u), { ...rangos[u], hasta: nuevo }]
          : [...rangos, { desde: nuevo, hasta: nuevo, tramos }];

        return this.conColumna(
          { ...plan, pasillos, bloqueFinal: null },
          [rangos[u].hasta, nuevo],
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

      case 'quitar-pasillo': {
        const quedan = this.sinPasillo(rangos, accion.numero);
        return quedan === null ? null : { ...plan, pasillos: quedan };
      }

      case 'poner-bloque':
        return this.ponerBloque(plan, rangos, accion.donde, accion.inferior, accion.superior);

      case 'anadir-muro':
        return {
          ...plan,
          muros: [...(plan.muros ?? []), this.muroDelLado(plan, accion.lado, accion.tramo)]
        };

      case 'quitar-muro': {
        const muros = [...(plan.muros ?? [])];
        if (accion.indice < 0 || accion.indice >= muros.length) return null;
        muros.splice(accion.indice, 1);
        return { ...plan, muros };
      }
    }
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
   * Un muro a lo largo de un lado del recinto.
   *
   * <p>Las coordenadas salen de lo que ya mide el plano: pasillos por su paso, y largo por el tramo
   * más alto más la transversal. Nadie escribe un número.</p>
   */
  private muroDelLado(plan: WarehousePlan, lado: Lado, tramo?: Tramo): PlanMuro {
    const m = plan.medidas;
    const paso = m.anchoBloque + m.anchoPasillo;

    const numeros = (plan.pasillos ?? []).flatMap((r) =>
      Array.from({ length: r.hasta - r.desde + 1 }, (_, i) => r.desde + i)
    );
    const cuantos = Math.max(numeros.length, 1);

    const inferior = Math.max(plan.bloques?.inferior ?? 0, ...this.excepcionales(plan, 'inferior'));
    const superior = Math.max(plan.bloques?.superior ?? 0, ...this.excepcionales(plan, 'superior'));

    const dosTramos = inferior > 0 && superior > 0;
    const hueco = dosTramos ? m.separacionTramos : 0;
    const finInferior = inferior * m.largoSegmento;
    const inicioSuperior = finInferior + hueco;

    const x0 = 0;
    const x1 = m.anchoBloque + cuantos * paso;
    const z0 = 0;
    const z1 = inicioSuperior + superior * m.largoSegmento;

    // Un muro de un lado corre solo por su tramo: la transversal es un pasaje y por ahí no pasa
    // ningún muro. Sin tramo —o sin transversal que respetar— va de punta a punta.
    const [za, zb] =
      tramo === 'inferior' ? [z0, finInferior] : tramo === 'superior' ? [inicioSuperior, z1] : [z0, z1];

    switch (lado) {
      case 'sur':
        return { desde: [x0, z0], hasta: [x1, z0] };
      case 'norte':
        return { desde: [x0, z1], hasta: [x1, z1] };
      case 'oeste':
        return { desde: [x0, za], hasta: [x0, zb] };
      case 'este':
        return { desde: [x1, za], hasta: [x1, zb] };
    }
  }

  private excepcionales(plan: WarehousePlan, cual: 'inferior' | 'superior'): number[] {
    const valores = (plan.excepciones ?? []).map((e) => e[cual]).filter((v): v is number => typeof v === 'number');
    return valores.length > 0 ? valores : [0];
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
      if (numero > rango.desde) salida.push({ desde: rango.desde, hasta: numero - 1 });
      if (numero < rango.hasta) salida.push({ desde: numero + 1, hasta: rango.hasta });
    }

    return encontrado && salida.length > 0 ? salida : null;
  }

  /**
   * El plano que se está editando. <b>Si no hay texto todavía, uno en blanco</b> — y eso es lo que
   * permite que la primera pieza arrastrada cree el plano, en vez de exigir pegar un JSON antes.
   */
  private planActual(): WarehousePlan | null {
    const texto = this.store.texto().trim();
    if (texto === '') return planoEnBlanco();

    try {
      return JSON.parse(texto) as WarehousePlan;
    } catch {
      return null;
    }
  }
}
