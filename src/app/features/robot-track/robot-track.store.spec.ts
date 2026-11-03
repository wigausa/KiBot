import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { RobotApiService } from '../robot/robot-api.service';
import { RobotInventory, RobotTrack, RobotTrackPoint } from '../robot/robot.models';
import { WarehouseMap } from '../warehouse-map/warehouse-map.models';
import { RobotTrackStore, robotEn } from './robot-track.store';

const inventarios: RobotInventory[] = [
  {
    _id: 'inv-1',
    Name: 'Inventario7Kpruebas2',
    EndDate: null,
    MapId: 'mapa-1',
    MapVersion: 3,
    Devices: [{ Type: 'Robot', Name: 'RobotInventario01', IdDevice: 39, IdZone: 26, Zone: 'ZonaPrueba1' }]
  }
];

function punto(segundos: number, x: number, y: number, cambios: Partial<RobotTrackPoint> = {}): RobotTrackPoint {
  return {
    T: new Date(Date.UTC(2026, 9, 27, 4, 30, segundos)).toISOString(),
    X: x,
    Y: y,
    Heading: Math.PI / 2,
    Zone: 'AISLE',
    Aisle: 22,
    Tramo: 'INFERIOR',
    Segment: 3,
    State: 'MOVING',
    MissionTramo: '22-INFERIOR',
    ReadsPerS: 500,
    BatteryPct: 88,
    Method: 'TRIANGLE',
    Mismatch: false,
    Source: 'HEARTBEAT',
    ...cambios
  };
}

function recorrido(abierto: boolean, puntos: RobotTrackPoint[]): RobotTrack {
  return {
    IdInventory: 'inv-1',
    IdDevice: 39,
    RunId: 'run-1',
    RobotRunId: 'robot-run-1',
    MapId: 'mapa-1',
    MapVersion: 3,
    Run: { Status: abierto ? 'OPEN' : 'CLOSED', StartedAt: null, ClosedAt: null, Reason: null },
    Transform: { Pairs: 48, Triangles: 66, RmsM: 1.4, Reflected: true },
    Points: puntos,
    Tramos: [
      { Aisle: 21, AisleId: 'P21', Tramo: 'INFERIOR', Status: 'COMPLETO', Direction: 'BAJA', CoveredAt: punto(0, 0, 0).T }
    ]
  };
}

class ApiFalsa {
  respuestas: RobotTrack[] = [];
  pedidos: { runId?: string | null; since?: string | null }[] = [];
  mapas = 0;

  async inventarios(): Promise<RobotInventory[]> {
    return inventarios;
  }

  async recorrido(_inv: string, _dev: number, runId?: string | null, since?: string | null): Promise<RobotTrack> {
    this.pedidos.push({ runId, since });
    return this.respuestas.shift()!;
  }

  async mapa(): Promise<WarehouseMap> {
    this.mapas++;
    return { MapId: 'mapa-1', Version: 3 } as WarehouseMap;
  }
}

describe('RobotTrackStore', () => {
  let api: ApiFalsa;
  let store: RobotTrackStore;

  beforeEach(async () => {
    api = new ApiFalsa();
    TestBed.configureTestingModule({
      providers: [provideZonelessChangeDetection(), RobotTrackStore, { provide: RobotApiService, useValue: api }]
    });
    store = TestBed.inject(RobotTrackStore);
    await store.cargar();
  });

  afterEach(() => store.ngOnDestroy());

  it('con un solo robot en el inventario lo elige solo y carga su recorrido y el plano', async () => {
    api.respuestas = [recorrido(true, [punto(0, 74, 1), punto(2, 74, 2)])];

    await store.elegirInventario('inv-1');

    expect(store.robotId()).toBe(39);
    expect(store.puntos().length).toBe(2);
    expect(api.mapas).toBe(1);
    expect(store.abierto()).toBeTrue();
  });

  it('en vivo el robot está en el último punto y la ruta tiene todos', async () => {
    api.respuestas = [recorrido(true, [punto(0, 74, 1), punto(2, 74, 2)])];
    await store.elegirInventario('inv-1');

    expect(store.robot()).toEqual({ x: 74, y: 2, heading: Math.PI / 2 });
    expect(store.ruta().length).toBe(2);
    // El tramo que recorre, además de los terminados.
    expect(store.tramos()).toContain({ aisleId: 'P22', tramo: 'INFERIOR', estado: 'recorriendo' });
    expect(store.tramos()).toContain({ aisleId: 'P21', tramo: 'INFERIOR', estado: 'completo' });
  });

  it('al refrescar pide solo lo nuevo, con el id del robot, y lo suma sin repetir', async () => {
    api.respuestas = [recorrido(true, [punto(0, 74, 1), punto(2, 74, 2)])];
    await store.elegirInventario('inv-1');

    api.respuestas = [recorrido(true, [punto(2, 74, 2), punto(4, 74, 3)])];
    await store.refrescar();

    expect(api.pedidos.at(-1)).toEqual({ runId: 'robot-run-1', since: punto(2, 0, 0).T });
    expect(store.puntos().map((p) => p.Y)).toEqual([1, 2, 3]);
  });

  it('cuando el recorrido cierra deja la repetición lista al principio', async () => {
    api.respuestas = [recorrido(true, [punto(0, 74, 1)])];
    await store.elegirInventario('inv-1');

    api.respuestas = [recorrido(false, [punto(10, 74, 6)])];
    await store.refrescar();

    expect(store.abierto()).toBeFalse();
    expect(store.instante()).toBe(store.inicio());
    expect(store.ruta().length).toBe(1);
  });

  it('en la repetición el robot se interpola entre los dos puntos que rodean el instante', async () => {
    api.respuestas = [recorrido(false, [punto(0, 74, 0), punto(10, 74, 10)])];
    await store.elegirInventario('inv-1');

    store.avanzar(2500);

    expect(store.robot()!.y).toBeCloseTo(2.5, 6);
    expect(store.ruta().length).toBe(1);
  });

  it('la repetición se para al llegar al final', async () => {
    api.respuestas = [recorrido(false, [punto(0, 74, 0), punto(10, 74, 10)])];
    await store.elegirInventario('inv-1');
    store.reproducir();

    store.avanzar(60_000);

    expect(store.instante()).toBe(store.fin());
    expect(store.reproduciendo()).toBeFalse();
  });

  it('cuenta los puntos que no cuadran y los que salieron por la afín', async () => {
    api.respuestas = [
      recorrido(true, [punto(0, 74, 1, { Mismatch: true }), punto(2, 60, 2, { Method: 'AFFINE' }), punto(4, 74, 3)])
    ];
    await store.elegirInventario('inv-1');

    expect(store.desfasados()).toBe(1);
    expect(store.porAfin()).toBe(1);
  });

  it('robotEn no sitúa al robot antes del primer punto', () => {
    const t0 = Date.parse(punto(5, 0, 0).T);
    const puntos = [{ ...punto(5, 1, 1), t: t0 }];

    expect(robotEn(puntos, t0 - 1)).toBeNull();
    expect(robotEn(puntos, t0 + 1000)).toEqual({ x: 1, y: 1, heading: Math.PI / 2 });
  });
});
