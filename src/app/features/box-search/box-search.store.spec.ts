import { HttpErrorResponse } from '@angular/common/http';
import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { RobotApiService } from '../robot/robot-api.service';
import { BoxLocation, BoxSearchResult, BoxSearchStatus, RobotInventory } from '../robot/robot.models';
import { WarehouseMap } from '../warehouse-map/warehouse-map.models';
import { BoxSearchStore } from './box-search.store';

const LISTO: BoxSearchStatus = { State: 'Ready', Message: 'Se puede buscar.' };
const RECORRIENDO: BoxSearchStatus = {
  State: 'InProgress',
  Message: 'El robot está recorriendo. La búsqueda estará disponible cuando termine.'
};

function ubicacion(parcial: Partial<BoxLocation>): BoxLocation {
  return {
    IdDevice: 7,
    Status: 'RESOLVED',
    IdZone: 1,
    Aisle: '12',
    Side: 'A',
    Tramo: 'INFERIOR',
    Segment: 7,
    RackId: 'B11-12-I07',
    RackSide: 'right',
    Confidence: 0.91,
    Margin: 6,
    Readings: 14,
    ResolvedAt: '2026-10-15T11:05:00Z',
    MapId: 'map-1',
    MapVersion: 1,
    Candidates: [],
    ...parcial
  };
}

function resultado(locations: BoxLocation[]): BoxSearchResult {
  return { Code: 'HA0DJ2', Epc: '000000000000484130444A32', Usda: 'HA0DJ2', Locations: locations };
}

/** Un doble a mano: lo que se prueba es el store, no HTTP. */
class ApiFalsa {
  estado: BoxSearchStatus = LISTO;
  respuesta: BoxSearchResult = resultado([ubicacion({})]);
  buscarFalla: unknown = null;
  busquedas: string[] = [];
  mapas = 0;

  async inventarios(): Promise<RobotInventory[]> {
    return [{ _id: 'inv-1', Name: 'Inventario 1', EndDate: null, MapId: 'map-1', MapVersion: 1 }];
  }

  async estadoDeBusqueda(): Promise<BoxSearchStatus> {
    return this.estado;
  }

  async buscarCaja(_inv: string, code: string): Promise<BoxSearchResult> {
    this.busquedas.push(code);
    if (this.buscarFalla !== null) throw this.buscarFalla;
    return this.respuesta;
  }

  async mapa(): Promise<WarehouseMap> {
    this.mapas++;
    return { ShelvingUnits: [], Aisles: [], Walls: [] } as unknown as WarehouseMap;
  }
}

describe('BoxSearchStore', () => {
  let store: BoxSearchStore;
  let api: ApiFalsa;

  beforeEach(async () => {
    api = new ApiFalsa();
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        BoxSearchStore,
        { provide: RobotApiService, useValue: api }
      ]
    });
    store = TestBed.inject(BoxSearchStore);
    await store.cargar();
  });

  // --- la regla: solo con el recorrido terminado ---------------------------------------------

  for (const State of ['InProgress', 'Calculating', 'NoFinishedRun'] as const) {
    it(`con el estado ${State} no se busca, aunque haya código`, async () => {
      api.estado = { State, Message: 'motivo' };
      await store.elegirInventario('inv-1');
      store.codigo.set('HA0DJ2');

      await store.buscar();

      expect(store.habilitado()).toBeFalse();
      expect(store.puedeBuscar()).toBeFalse();
      expect(api.busquedas).toEqual([]);
    });
  }

  it('con el recorrido terminado y calculado sí se busca', async () => {
    await store.elegirInventario('inv-1');
    store.codigo.set('HA0DJ2');

    expect(store.puedeBuscar()).toBeTrue();
    await store.buscar();

    expect(api.busquedas).toEqual(['HA0DJ2']);
  });

  it('si el estado no se pudo consultar, tampoco se busca', async () => {
    api.estadoDeBusqueda = async () => {
      throw new HttpErrorResponse({ status: 500 });
    };
    await store.elegirInventario('inv-1');
    store.codigo.set('HA0DJ2');

    expect(store.habilitado()).toBeFalse();
  });

  it('un 409 al buscar —el robot salió entretanto— deshabilita con el motivo del backend', async () => {
    await store.elegirInventario('inv-1');
    store.codigo.set('HA0DJ2');
    api.buscarFalla = new HttpErrorResponse({ status: 409, error: RECORRIENDO });

    await store.buscar();

    const estado = store.estado();
    expect(estado.status).toBe('ready');
    if (estado.status === 'ready') expect(estado.value).toEqual(RECORRIENDO);
    expect(store.habilitado()).toBeFalse();
    // No se enseña un error: se enseña por qué no se puede.
    expect(store.resultado().status).toBe('idle');
  });

  // --- lo que se enseña ----------------------------------------------------------------------

  it('ubicada: señala su cara en el plano y carga el plano una sola vez', async () => {
    await store.elegirInventario('inv-1');
    store.codigo.set('HA0DJ2');

    await store.buscar();
    await store.buscar();

    expect(store.resaltadas()).toEqual([{ rackId: 'B11-12-I07', side: 'right' }]);
    expect(api.mapas).toBe(1);
  });

  it('ambigua: señala TODAS sus candidatas, sin elegir una', async () => {
    api.respuesta = resultado([
      ubicacion({
        Status: 'AMBIGUOUS',
        Aisle: null,
        RackId: null,
        RackSide: null,
        Candidates: [
          { RackId: 'B11-12-I07', Side: 'right', Address: 'P12 · A · inferior · 7', Readings: 6, MeanRssi: -60 },
          { RackId: 'B12-13-I07', Side: 'left', Address: 'P12 · B · inferior · 7', Readings: 5, MeanRssi: -61 }
        ]
      })
    ]);
    await store.elegirInventario('inv-1');
    store.codigo.set('HA0DJ2');

    await store.buscar();

    expect(store.resaltadas()).toEqual([
      { rackId: 'B11-12-I07', side: 'right' },
      { rackId: 'B12-13-I07', side: 'left' }
    ]);
  });

  it('no vista: resultado sin ubicaciones, nada señalado y sin pedir el plano', async () => {
    api.respuesta = resultado([]);
    await store.elegirInventario('inv-1');
    store.codigo.set('HA0DJ2');

    await store.buscar();

    const r = store.resultado();
    expect(r.status).toBe('ready');
    if (r.status === 'ready') expect(r.value.Locations).toEqual([]);
    expect(store.resaltadas()).toEqual([]);
    expect(api.mapas).toBe(0);
  });

  it('un código inválido se enseña como error, con el mensaje del backend', async () => {
    api.buscarFalla = new HttpErrorResponse({ status: 400, error: { Error: 'El código no es un USDA ni un EPC.' } });
    await store.elegirInventario('inv-1');
    store.codigo.set('???');

    await store.buscar();

    const r = store.resultado();
    expect(r.status).toBe('error');
    if (r.status === 'error') expect(r.message).toBe('El código no es un USDA ni un EPC.');
  });

  it('cambiar de inventario borra el resultado anterior', async () => {
    await store.elegirInventario('inv-1');
    store.codigo.set('HA0DJ2');
    await store.buscar();

    await store.elegirInventario(null);

    expect(store.resultado().status).toBe('idle');
    expect(store.resaltadas()).toEqual([]);
  });
});
