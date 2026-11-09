import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { RobotApiService } from './robot-api.service';
import { RobotContextStore } from './robot-context.store';
import { RobotBatchView, RobotInventory } from './robot.models';

function inventario(id: string, abierto: boolean, robots: number[]): RobotInventory {
  return {
    _id: id,
    Name: id,
    EndDate: abierto ? null : '2026-10-30T00:00:00Z',
    Zones: id === 'dos' ? [{ IdZone: 1, Name: 'Zona 1' }, { IdZone: 2, Name: 'Zona 2' }] : [{ IdZone: 1, Name: 'Zona 1' }],
    Devices: robots.map((r) => ({ Type: 'Robot', Name: `R${r}`, IdDevice: r, IdZone: 1, Zone: 'Zona 1' }))
  };
}

class ApiFalsa {
  lista: RobotInventory[] = [];
  tandaDe: RobotBatchView | null = null;
  async inventarios(): Promise<RobotInventory[]> {
    return this.lista;
  }
  async tanda(): Promise<RobotBatchView | null> {
    return this.tandaDe;
  }
  async progreso() {
    return { TramosDone: 3, TramosTotal: 10, CoveredSides: 0, TotalSides: 0 };
  }
  async estado() {
    return null;
  }
}

describe('RobotContextStore', () => {
  let api: ApiFalsa;
  let store: RobotContextStore;

  beforeEach(() => {
    localStorage.removeItem('kibot.contexto.inventario');
    localStorage.removeItem('kibot.contexto.robot');
    localStorage.removeItem('kibot.contexto.zona');
    api = new ApiFalsa();
    TestBed.configureTestingModule({
      providers: [provideZonelessChangeDetection(), { provide: RobotApiService, useValue: api }]
    });
  });

  afterEach(() => store?.ngOnDestroy());

  function crear(): RobotContextStore {
    store = TestBed.inject(RobotContextStore);
    store.suspenderVigilancia(); // en las pruebas no se sondea solo
    return store;
  }

  it('con un solo inventario abierto y un solo robot, los elige solo', async () => {
    api.lista = [inventario('nov', true, [39]), inventario('oct', false, [39])];
    await crear().cargar();

    expect(store.inventarioId()).toBe('nov');
    expect(store.robotId()).toBe(39);
    expect(store.abiertos().map((i) => i._id)).toEqual(['nov']);
    expect(store.cerrados().map((i) => i._id)).toEqual(['oct']);
  });

  it('recuerda la elección entre visitas, si sigue existiendo', async () => {
    localStorage.setItem('kibot.contexto.inventario', 'oct');
    localStorage.setItem('kibot.contexto.robot', '39');
    api.lista = [inventario('nov', true, [39]), inventario('oct', false, [39])];
    await crear().cargar();

    expect(store.inventarioId()).toBe('oct');
    expect(store.abierto()).toBeFalse();
  });

  it('una elección guardada que ya no existe se olvida', async () => {
    localStorage.setItem('kibot.contexto.inventario', 'borrado');
    api.lista = [inventario('a', true, [1]), inventario('b', true, [2])];
    await crear().cargar();

    expect(store.inventarioId()).toBeNull();
    expect(store.robotId()).toBeNull();
  });

  it('cambiar de inventario elige su robot si solo tiene uno', async () => {
    api.lista = [inventario('a', true, [1, 2]), inventario('b', true, [7])];
    await crear().cargar();

    store.elegirInventario('b');
    expect(store.robotId()).toBe(7);
    expect(localStorage.getItem('kibot.contexto.inventario')).toBe('b');

    store.elegirInventario('a');
    expect(store.robotId()).toBeNull();
  });

  it('con una tanda en marcha cuenta la zona y el avance', async () => {
    api.lista = [inventario('nov', true, [39])];
    api.tandaDe = {
      BatchId: 't', IdInventory: 'nov', IdDevice: 39, Status: 'Running', StopReason: null, RequestedBy: null,
      StartedAt: '', EndedAt: null, Current: 1, CurrentRunId: 'r2', LastAck: null,
      Zones: [
        { IdZone: 1, Name: 'Norte', From: 'p1.1', To: 'p3.i', RunId: 'r1', State: 'Done', EndReason: 'COMPLETED' },
        { IdZone: 2, Name: 'Sur', From: 'p4.1', To: 'p6.i', RunId: 'r2', State: 'Running', EndReason: null }
      ]
    } as RobotBatchView;
    await crear().cargar();
    await store.vigilar();

    expect(store.enMarcha()).not.toBeNull();
    expect(store.zonaEnCurso()).toEqual({ numero: 2, total: 2, nombre: 'Sur' });
    expect(store.avance()).toBe(30);
  });

  it('la zona se recuerda y se olvida al cambiar de inventario', async () => {
    api.lista = [inventario('dos', true, [1]), inventario('uno', true, [2])];
    await crear().cargar();

    store.elegirInventario('dos');
    expect(store.zonaId()).toBeNull(); // con dos zonas no se elige sola
    store.elegirZona(2);
    expect(store.zona()?.Name).toBe('Zona 2');
    expect(localStorage.getItem('kibot.contexto.zona')).toBe('2');

    store.elegirInventario('uno');
    expect(store.zonaId()).toBe(1); // una sola zona: esa
  });
});
