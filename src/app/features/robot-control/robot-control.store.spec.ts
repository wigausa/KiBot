import { HttpErrorResponse } from '@angular/common/http';
import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { RobotApiService } from '../robot/robot-api.service';
import { RobotInventory, RobotProgress, RobotRun } from '../robot/robot.models';
import { RobotControlStore } from './robot-control.store';

function inventario(id: string, abierto = true): RobotInventory {
  return {
    _id: id,
    Name: `Inventario ${id}`,
    EndDate: abierto ? null : '2026-10-01T00:00:00Z',
    MapId: 'map-1',
    MapVersion: 1,
    Zones: [
      { IdZone: 3, Name: 'Zona 3' },
      { IdZone: 1, Name: 'Zona 1' }
    ],
    Devices: [
      { Type: 'Robot', Name: 'R1', IdDevice: 7, IdZone: 1, Zone: 'Zona 1' },
      // El mismo robot en otra zona: en GetInventories sale una vez por zona.
      { Type: 'Robot', Name: 'R1', IdDevice: 7, IdZone: 3, Zone: 'Zona 3' },
      { Type: 'Portal Inventario', Name: 'Puerta', IdDevice: 9, IdZone: 1, Zone: 'Zona 1' }
    ]
  };
}

function recorrido(status: 'OPEN' | 'CLOSED', zonas: number[] = [1]): RobotRun {
  return {
    RunId: 'run-1',
    IdInventory: 'inv-1',
    IdDevice: 7,
    Status: status,
    StartedAt: '2026-10-15T10:00:00Z',
    ClosedAt: status === 'CLOSED' ? '2026-10-15T11:00:00Z' : null,
    Zones: zonas,
    Reason: status === 'CLOSED' ? 'ABORTED' : null
  };
}

/** Un doble a mano: lo que se prueba es el store, no HTTP. */
class ApiFalsa {
  lista: RobotInventory[] = [inventario('inv-1'), inventario('inv-viejo', false)];
  abiertoActual: RobotRun | null = null;
  abrirFalla: unknown = null;
  zonasEnviadas: number[][] = [];
  cierres = 0;
  progresos = 0;

  async inventarios(): Promise<RobotInventory[]> {
    return this.lista;
  }

  async recorridoAbierto(): Promise<RobotRun | null> {
    return this.abiertoActual;
  }

  async abrir(_inv: string, _dev: number, zonas: number[]): Promise<RobotRun> {
    this.zonasEnviadas.push(zonas);
    if (this.abrirFalla !== null) throw this.abrirFalla;
    return recorrido('OPEN', zonas);
  }

  async cerrar(): Promise<RobotRun> {
    this.cierres++;
    return recorrido('CLOSED');
  }

  async progreso(): Promise<RobotProgress> {
    this.progresos++;
    return {
      IdInventory: 'inv-1',
      TotalSides: 10,
      CoveredSides: 4,
      Readings: 120,
      LastReadAt: null,
      Closed: false,
      Consolidated: false
    };
  }
}

describe('RobotControlStore', () => {
  let store: RobotControlStore;
  let api: ApiFalsa;

  beforeEach(async () => {
    api = new ApiFalsa();
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        RobotControlStore,
        { provide: RobotApiService, useValue: api }
      ]
    });
    store = TestBed.inject(RobotControlStore);
    await store.cargar();
  });

  afterEach(() => store.ngOnDestroy());

  it('solo ofrece los inventarios abiertos', () => {
    const lista = store.inventarios();
    expect(lista.status).toBe('ready');
    if (lista.status === 'ready') expect(lista.value.map((i) => i._id)).toEqual(['inv-1']);
  });

  it('solo ofrece los robots del inventario, uno por id', () => {
    store.elegirInventario('inv-1');

    // La puerta no recorre, y el robot que está en dos zonas es UN robot.
    expect(store.robots()).toEqual([{ IdDevice: 7, Name: 'R1' }]);
  });

  it('no deja iniciar sin zonas marcadas', async () => {
    store.elegirInventario('inv-1');
    await store.elegirRobot(7);

    expect(store.puedeIniciar()).toBeFalse();
  });

  it('Iniciar manda exactamente las zonas marcadas, ordenadas', async () => {
    store.elegirInventario('inv-1');
    await store.elegirRobot(7);
    store.alternarZona(3);
    store.alternarZona(1);

    await store.iniciar();

    expect(api.zonasEnviadas).toEqual([[1, 3]]);
    expect(store.abierto()?.Status).toBe('OPEN');
    // Recién iniciado ya pide el avance, sin esperar al primer intervalo.
    expect(api.progresos).toBeGreaterThan(0);
  });

  it('desmarcar una zona la quita de lo que se manda', async () => {
    store.elegirInventario('inv-1');
    await store.elegirRobot(7);
    store.alternarZona(3);
    store.alternarZona(1);
    store.alternarZona(3);

    await store.iniciar();

    expect(api.zonasEnviadas).toEqual([[1]]);
  });

  it('un robot que ya anda trae sus zonas y no deja iniciar otro recorrido', async () => {
    api.abiertoActual = recorrido('OPEN', [3]);
    store.elegirInventario('inv-1');

    await store.elegirRobot(7);

    expect(store.abierto()).not.toBeNull();
    expect([...store.zonasMarcadas()]).toEqual([3]);
    expect(store.puedeIniciar()).toBeFalse();
  });

  it('Cerrar solo cuando hay un recorrido abierto', async () => {
    store.elegirInventario('inv-1');
    await store.elegirRobot(7);

    await store.cerrar();
    expect(api.cierres).toBe(0);

    store.alternarZona(1);
    await store.iniciar();
    await store.cerrar();

    expect(api.cierres).toBe(1);
    expect(store.abierto()).toBeNull();
  });

  it('un fallo al iniciar se enseña con el mensaje del backend', async () => {
    api.abrirFalla = new HttpErrorResponse({ status: 409, error: { Error: 'Ya hay un recorrido abierto.' } });
    store.elegirInventario('inv-1');
    await store.elegirRobot(7);
    store.alternarZona(1);

    await store.iniciar();

    const accion = store.accion();
    expect(accion.status).toBe('error');
    if (accion.status === 'error') expect(accion.message).toBe('Ya hay un recorrido abierto.');
    expect(store.abierto()).toBeNull();
  });

  it('cambiar de inventario lo deja todo sin elegir', async () => {
    store.elegirInventario('inv-1');
    await store.elegirRobot(7);
    store.alternarZona(1);

    store.elegirInventario('inv-1');

    expect(store.robotId()).toBeNull();
    expect(store.zonasMarcadas().size).toBe(0);
  });
});
