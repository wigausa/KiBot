import { provideZonelessChangeDetection, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { PlanCanvasAction } from './plan-canvas/plan-canvas';
import { WarehouseMap as MapaDeBodega, WarehousePlan } from './warehouse-map.models';
import { murosCorridos, unirMuros, WarehouseMap } from './warehouse-map';
import { CompanyStore } from '../../core/company/company.store';
import { WarehouseMapStore } from './warehouse-map.store';

/**
 * Un doble a mano del store: lo que se prueba es cómo un gesto del lienzo cambia el plano, no la
 * previsualización. Aplicar un plano lo deja escrito, que es lo que lee el siguiente gesto.
 */
class StoreFalso {
  readonly texto = signal('');
  readonly mapa = signal<MapaDeBodega | null>(null);

  async aplicar(plan: WarehousePlan): Promise<void> {
    this.texto.set(JSON.stringify(plan));
  }

  escribir(texto: string): void {
    this.texto.set(texto);
  }

  plan(): WarehousePlan {
    return JSON.parse(this.texto()) as WarehousePlan;
  }
}

/** Las compañías, sin red: la pantalla las pide al entrar y aquí no se prueban. */
class CompaniasFalsas {
  readonly companias = signal({ status: 'idle' as const });
  readonly companiaId = signal<number | null>(1);
  async cargar(): Promise<void> {}
}

/** Las medidas del 7000: un paso de pasillo a pasillo es 1,96 + 1,60 = 3,56 m. */
const PASO = 3.56;

describe('WarehouseMap — columnas de muro', () => {
  let store: StoreFalso;
  let pantalla: { alActuar(accion: PlanCanvasAction): Promise<void> };

  beforeEach(() => {
    store = new StoreFalso();
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        { provide: WarehouseMapStore, useValue: store },
        { provide: CompanyStore, useValue: new CompaniasFalsas() }
      ]
    });
    pantalla = TestBed.runInInjectionContext(() => new WarehouseMap()) as unknown as typeof pantalla;
  });

  const hacer = (accion: PlanCanvasAction) => pantalla.alActuar(accion);
  const pasillo = (extremo: 'inicio' | 'fin', tramos: 'ambos' | 'inferior' | 'superior' = 'ambos') =>
    hacer({ tipo: 'anadir-pasillo', extremo, tramos });

  async function pasillos(cuantos: number): Promise<void> {
    for (let i = 0; i < cuantos; i++) await pasillo('fin');
  }

  // --- poner un muro --------------------------------------------------------------------------

  it('un muro en una columna vacía del extremo queda pegado al pasillo', async () => {
    await pasillos(2);

    await hacer({ tipo: 'poner-muro', donde: 'inicio', tramos: 'completo' });

    expect(store.plan().muroInicial).toEqual({ tramos: 'completo' });
  });

  it('un muro no se pone al lado de un bloque: ni lo sustituye ni cambia nada', async () => {
    await pasillos(2);
    await hacer({ tipo: 'poner-bloque', donde: 'inicio', inferior: 13, superior: 0 });
    const antes = store.texto();

    await hacer({ tipo: 'poner-muro', donde: 'inicio', tramos: 'completo' });

    expect(store.texto()).toBe(antes);
  });

  it('tampoco entre dos pasillos con un bloque, aunque sea de un solo tramo', async () => {
    await pasillos(3);
    await hacer({ tipo: 'poner-bloque', donde: [1, 2], inferior: 0, superior: 7 });
    const antes = store.texto();

    await hacer({ tipo: 'poner-muro', donde: [1, 2], tramos: 'inferior' });

    expect(store.texto()).toBe(antes);
  });

  it('ni donde está el bloque general, que es el que hay entre pasillos sin excepción', async () => {
    // Un plano escrito a mano: entre el 1 y el 2 no hay excepción, así que hay bloque general.
    store.escribir(JSON.stringify({
      nombre: 'x', companyId: 1, origen: { descripcion: 'x', x: 0, y: 0 },
      medidas: { anchoPasillo: 1.6, anchoBloque: 1.96, largoSegmento: 1.27, separacionTramos: 1.96, niveles: 4, huecosPorSegmento: 1, grosorMuro: 0.2 },
      pasillos: [{ desde: 1, hasta: 2 }], bloques: { inferior: 13, superior: 13 }
    }));
    const antes = store.texto();

    await hacer({ tipo: 'poner-muro', donde: [1, 2], tramos: 'completo' });

    expect(store.texto()).toBe(antes);
  });

  it('un muro por tramo se suma al del otro tramo y queda uno de los dos', async () => {
    await pasillos(2);

    await hacer({ tipo: 'poner-muro', donde: [1, 2], tramos: 'inferior' });
    expect(store.plan().murosEntre).toEqual([{ entre: [1, 2], tramos: 'inferior' }]);

    await hacer({ tipo: 'poner-muro', donde: [1, 2], tramos: 'superior' });
    expect(store.plan().murosEntre).toEqual([{ entre: [1, 2] }]);
  });

  // --- crecer con un muro en el extremo -------------------------------------------------------

  it('un pasillo soltado al otro lado del muro inicial lo deja entre los dos, pegado a ambos', async () => {
    await pasillos(2);
    await hacer({ tipo: 'poner-muro', donde: 'inicio', tramos: 'completo' });

    await pasillo('inicio');

    const plan = store.plan();
    expect(plan.pasillos).toEqual([{ desde: 1, hasta: 3 }]);
    expect(plan.muroInicial).toBeNull();
    expect(plan.murosEntre).toEqual([{ entre: [1, 2], tramos: 'completo' }]);
    // Ni bloque ni excepción en esa columna: al lado de un muro solo van pasillos.
    expect((plan.excepciones ?? []).some((e) => e.entre[0] === 1 && e.entre[1] === 2)).toBeFalse();
  });

  it('lo mismo por el final: el muro final pasa a estar entre el último y el nuevo', async () => {
    await pasillos(2);
    await hacer({ tipo: 'poner-muro', donde: 'fin', tramos: 'inferior' });

    await pasillo('fin');

    const plan = store.plan();
    expect(plan.muroFinal).toBeNull();
    expect(plan.murosEntre).toEqual([{ entre: [2, 3], tramos: 'inferior' }]);
  });

  it('al renumerar por la izquierda los muros entre pasillos van con su columna', async () => {
    await pasillos(2);
    await hacer({ tipo: 'poner-muro', donde: [1, 2], tramos: 'completo' });

    await pasillo('inicio');

    expect(store.plan().murosEntre).toEqual([{ entre: [2, 3], tramos: 'completo' }]);
  });

  it('los muros norte y sur no llevan coordenadas: los coloca el backend por fuera de todo', async () => {
    await pasillos(2);

    await hacer({ tipo: 'anadir-muro', lado: 'norte' });
    await hacer({ tipo: 'anadir-muro', lado: 'sur' });
    expect(store.plan().muroNorte).toBeTrue();
    expect(store.plan().muroSur).toBeTrue();
    expect(store.plan().muros).toBeUndefined();

    await hacer({ tipo: 'quitar-muro', wallId: 'MN' });
    expect(store.plan().muroNorte).toBeFalse();
  });

  it('un muro soltado en la franja del medio queda cerrado, y sumarle un tramo no lo reabre', async () => {
    await pasillos(2);

    await hacer({ tipo: 'poner-muro', donde: [1, 2], tramos: 'completo' });
    await hacer({ tipo: 'poner-muro', donde: [1, 2], tramos: 'inferior' });

    expect(store.plan().murosEntre).toEqual([{ entre: [1, 2], tramos: 'completo' }]);

    await hacer({ tipo: 'quitar-muro', wallId: 'ME1-2.completo' });
    expect(store.plan().murosEntre).toEqual([]);
  });

  // --- quitar ---------------------------------------------------------------------------------

  it('quitar un pasillo junto a un muro no hace desaparecer el muro: la columna que queda es de muro', async () => {
    await pasillos(3);
    await hacer({ tipo: 'poner-muro', donde: [1, 2], tramos: 'inferior' });

    await hacer({ tipo: 'quitar-pasillo', numero: 2 });

    expect(store.plan().murosEntre).toEqual([{ entre: [1, 3], tramos: 'inferior' }]);
  });

  it('quitar el primer pasillo con un muro detrás deja ese muro como inicial', async () => {
    await pasillos(3);
    await hacer({ tipo: 'poner-muro', donde: [1, 2], tramos: 'completo' });

    await hacer({ tipo: 'quitar-pasillo', numero: 1 });

    const plan = store.plan();
    expect(plan.muroInicial).toEqual({ tramos: 'completo' });
    expect(plan.murosEntre).toEqual([]);
  });

  it('quitar un pasillo borra las excepciones que lo nombraban', async () => {
    await pasillos(3);
    await hacer({ tipo: 'poner-bloque', donde: [2, 3], inferior: 7, superior: 7 });

    await hacer({ tipo: 'quitar-pasillo', numero: 2 });

    expect((store.plan().excepciones ?? []).some((e) => e.entre.includes(2))).toBeFalse();
  });

  it('quitar un tramo de un muro de los dos deja el otro; quitar el último deja la columna vacía', async () => {
    await pasillos(2);
    // Abajo y arriba por separado: un muro de los dos tramos con la transversal abierta.
    await hacer({ tipo: 'poner-muro', donde: [1, 2], tramos: 'inferior' });
    await hacer({ tipo: 'poner-muro', donde: [1, 2], tramos: 'superior' });
    expect(store.plan().murosEntre).toEqual([{ entre: [1, 2] }]);

    await hacer({ tipo: 'quitar-muro', wallId: 'ME1-2.inferior' });
    expect(store.plan().murosEntre).toEqual([{ entre: [1, 2], tramos: 'superior' }]);

    await hacer({ tipo: 'quitar-muro', wallId: 'ME1-2.superior' });
    const plan = store.plan();
    expect(plan.murosEntre).toEqual([]);
    // Vacía, no con el bloque general que nadie puso.
    expect(plan.excepciones).toContain(jasmine.objectContaining({ entre: [1, 2], inferior: 0, superior: 0 }));
  });

  it('quitar el muro inicial o uno por coordenadas', async () => {
    await pasillos(2);
    await hacer({ tipo: 'poner-muro', donde: 'inicio', tramos: 'inferior' });
    await hacer({ tipo: 'poner-muro', donde: 'inicio', tramos: 'superior' });
    // Un plano viejo, con un muro por coordenadas.
    store.escribir(JSON.stringify({ ...store.plan(), muros: [{ desde: [0, 0], hasta: [8, 0] }] }));

    await hacer({ tipo: 'quitar-muro', wallId: 'MI.inferior' });
    expect(store.plan().muroInicial).toEqual({ tramos: 'superior' });

    await hacer({ tipo: 'quitar-muro', wallId: 'M01' });
    expect(store.plan().muros).toEqual([]);
  });

  it('quitar un pasillo acorta los muros por coordenadas de un plano viejo según lo que se ve en el mapa', async () => {
    await pasillos(3);
    // Un plano viejo, con el muro del norte por coordenadas.
    store.escribir(JSON.stringify({ ...store.plan(), muros: [{ desde: [0, 34.98], hasta: [11.64, 34.98] }] }));
    const antes = store.plan().muros![0];
    store.mapa.set(mapaConPasillos([2.76, 6.32, 9.88]));

    await hacer({ tipo: 'quitar-pasillo', numero: 2 });

    // El 3 pasa a estar donde estaba el 2: todo lo de su derecha se corre un paso.
    const despues = store.plan().muros![0];
    expect(despues.desde[0]).toBe(0);
    expect(despues.hasta[0]).toBeCloseTo(antes.hasta[0] - PASO, 6);
  });

  it('partir un rango de pasillos de un solo tramo conserva el tramo en los dos trozos', async () => {
    for (let i = 0; i < 3; i++) await pasillo('fin', 'inferior');

    await hacer({ tipo: 'quitar-pasillo', numero: 2 });

    expect(store.plan().pasillos).toEqual([
      { desde: 1, hasta: 1, tramos: 'inferior' },
      { desde: 3, hasta: 3, tramos: 'inferior' }
    ]);
  });

  // --- funciones sueltas ----------------------------------------------------------------------

  it('murosCorridos solo mueve la X, y con un límite solo los extremos que quedan más allá', () => {
    expect(murosCorridos([{ desde: [1, 2], hasta: [1, 9] }], 3)).toEqual([{ desde: [4, 2], hasta: [4, 9] }]);
    expect(murosCorridos(undefined, 3)).toBeUndefined();
    expect(murosCorridos([{ desde: [0, 5], hasta: [10, 5] }], -3, 4)).toEqual([{ desde: [0, 5], hasta: [7, 5] }]);
  });

  it('unirMuros: tramos distintos o alguno de los dos dan un muro de los dos', () => {
    expect(unirMuros(null, { tramos: 'inferior' })).toEqual({ tramos: 'inferior' });
    expect(unirMuros({ tramos: 'inferior' }, { tramos: 'inferior' })).toEqual({ tramos: 'inferior' });
    expect(unirMuros({ tramos: 'inferior' }, { tramos: 'superior' })).toEqual({});
    expect(unirMuros({}, { tramos: 'superior' })).toEqual({});
    expect(unirMuros({ tramos: 'completo' }, { tramos: 'inferior' })).toEqual({ tramos: 'completo' });
    expect(unirMuros(null, null)).toBeNull();
  });
});

/** Un mapa con solo lo que hace falta para medir: pasillos numerados en sus X. */
function mapaConPasillos(xs: number[]): MapaDeBodega {
  return {
    Aisles: xs.map((x, i) => ({ AisleId: `P${i + 1}`, Number: i + 1, X: x, Y: 0, Length: 1, Width: 1.6, Anchors: [] })),
    ShelvingUnits: [],
    Walls: [],
    Inventory: { X: 0, Y: 0, Width: 12, Depth: 30 }
  } as unknown as MapaDeBodega;
}
