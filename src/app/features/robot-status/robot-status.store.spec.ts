import { HttpErrorResponse } from '@angular/common/http';
import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { RobotApiService } from '../robot/robot-api.service';
import { RobotInventory, RobotStatusView } from '../robot/robot.models';
import { RobotStatusStore } from './robot-status.store';

function latido(idDevice: number, cambios: Partial<RobotStatusView> = {}): RobotStatusView {
  return {
    IdDevice: idDevice,
    DeviceName: `Robot ${idDevice}`,
    RobotId: `wiga-${idDevice}`,
    Timestamp: '2026-10-26T17:57:34Z',
    ReceivedAt: '2026-10-26T17:57:35Z',
    Signal: 'OK',
    SilentForS: 4,
    Status: {
      Reason: 'periodic',
      NextExpectedS: 60,
      State: 'CHARGING',
      Activity: 'IDLE',
      Mission: null,
      Pose: { X: 0.047, Y: -0.02, Heading: -0.04, Zone: 'DOCK', Cooler: null, Aisle: null, Tramo: null, Segment: null },
      Chassis: { BatteryPct: 100, Charging: true, EmergencyStop: false },
      Jetson: null,
      Rfid: null,
      Camera: null,
      Network: null,
      Alerts: []
    },
    ...cambios
  };
}

const inventarios: RobotInventory[] = [
  {
    _id: 'abierto',
    Name: 'Abierto',
    EndDate: null,
    Devices: [{ Type: 'Robot', Name: 'R7', IdDevice: 7, IdZone: 1, Zone: 'Z1' }]
  },
  {
    // Un robot que solo está en un inventario cerrado también late desde el dock.
    _id: 'cerrado',
    Name: 'Cerrado',
    EndDate: '2026-10-01T00:00:00Z',
    Devices: [{ Type: 'Robot', Name: 'R8', IdDevice: 8, IdZone: 1, Zone: 'Z1' }]
  }
];

class ApiFalsa {
  estadosPedidos: number[][] = [];
  respuesta: RobotStatusView[] = [latido(7)];
  falla: unknown = null;
  detalles: number[] = [];

  async inventarios(): Promise<RobotInventory[]> {
    return inventarios;
  }

  async estados(ids: readonly number[]): Promise<RobotStatusView[]> {
    this.estadosPedidos.push([...ids]);
    if (this.falla !== null) throw this.falla;
    return this.respuesta;
  }

  async estado(id: number): Promise<RobotStatusView | null> {
    this.detalles.push(id);
    return this.respuesta.find((r) => r.IdDevice === id) ?? null;
  }
}

describe('RobotStatusStore', () => {
  let store: RobotStatusStore;
  let api: ApiFalsa;

  beforeEach(async () => {
    api = new ApiFalsa();
    TestBed.configureTestingModule({
      providers: [provideZonelessChangeDetection(), RobotStatusStore, { provide: RobotApiService, useValue: api }]
    });
    store = TestBed.inject(RobotStatusStore);
    await store.cargar();
  });

  afterEach(() => store.ngOnDestroy());

  it('pide el latido de los robots de todos los inventarios, también los cerrados', () => {
    expect(api.estadosPedidos[0]).toEqual([7, 8]);
  });

  it('cada robot sale con su latido, o sin él si nunca mandó uno', () => {
    expect(store.filas().map((f) => [f.IdDevice, f.estado?.Status.State ?? null])).toEqual([
      [7, 'CHARGING'],
      [8, null]
    ]);
  });

  it('si un refresco falla se queda lo último bueno y lo avisa', async () => {
    api.falla = new HttpErrorResponse({ status: 500 });

    await store.refrescar();

    expect(store.refrescoFallido()).toBeTrue();
    expect(store.filas()[0].estado?.Status.State).toBe('CHARGING');
  });

  it('si el primero falla, enseña el error', async () => {
    api.falla = new HttpErrorResponse({ status: 500 });
    const otro = TestBed.runInInjectionContext(() => new RobotStatusStore());

    await otro.cargar();
    otro.ngOnDestroy();

    expect(otro.estados().status).toBe('error');
  });

  it('elegir un robot trae su detalle y se refresca con la lista', async () => {
    await store.elegir(7);
    expect(store.detalle()?.IdDevice).toBe(7);

    api.respuesta = [latido(7, { Signal: 'NO_SIGNAL' })];
    await store.refrescar();

    expect(store.detalle()?.Signal).toBe('NO_SIGNAL');
    expect(api.detalles).toEqual([7, 7]);
  });

  it('dejar de elegir no pide más detalle', async () => {
    await store.elegir(7);
    await store.elegir(null);
    await store.refrescar();

    expect(store.detalle()).toBeNull();
    expect(api.detalles).toEqual([7]);
  });
});
