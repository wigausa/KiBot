import { HttpErrorResponse } from '@angular/common/http';
import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { RobotApiService } from '../robot/robot-api.service';
import { RobotBatchView, RobotInventory, RobotProgress, RobotStatusView } from '../robot/robot.models';
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
      { IdZone: 1, Name: 'Zona 1' },
      { IdZone: 5, Name: 'Zona 5' }
    ],
    Devices: [
      { Type: 'Robot', Name: 'R1', IdDevice: 7, IdZone: 1, Zone: 'Zona 1' },
      // El mismo robot en otra zona: en GetInventories sale una vez por zona.
      { Type: 'Robot', Name: 'R1', IdDevice: 7, IdZone: 3, Zone: 'Zona 3' },
      { Type: 'Portal Inventario', Name: 'Puerta', IdDevice: 9, IdZone: 1, Zone: 'Zona 1' }
    ]
  };
}

function tanda(status: RobotBatchView['Status'], zonas: number[] = [1], cambios: Partial<RobotBatchView> = {}): RobotBatchView {
  return {
    BatchId: 'b-1',
    IdInventory: 'inv-1',
    IdDevice: 7,
    Status: status,
    StopReason: status === 'Stopped' ? 'CANCELLED' : null,
    RequestedBy: 'luis',
    StartedAt: '2026-10-27T10:00:00Z',
    EndedAt: status === 'Running' ? null : '2026-10-27T11:00:00Z',
    Current: 0,
    CurrentRunId: 'run-1',
    Zones: zonas.map((id, i) => ({
      IdZone: id,
      Name: `Zona ${id}`,
      From: 'p1.1',
      To: 'p3.i',
      RunId: i === 0 ? 'run-1' : null,
      State: i === 0 ? (status === 'Running' ? 'Running' : status === 'Done' ? 'Done' : 'Stopped') : 'Pending',
      EndReason: null
    })),
    LastAck: null,
    ...cambios
  };
}

function latido(mision: { RunId: string; Status: 'PREPARING' | 'RUNNING' | 'PAUSED' | 'RETURNING' }): RobotStatusView {
  return {
    IdDevice: 7,
    DeviceName: 'R1',
    RobotId: 'r1',
    Timestamp: '2026-10-27T10:05:00Z',
    ReceivedAt: '2026-10-27T10:05:00Z',
    Signal: 'OK',
    SilentForS: 2,
    Status: {
      Reason: null,
      NextExpectedS: 5,
      State: 'STOPPED',
      Activity: 'INVENTORY',
      Mission: { RunId: mision.RunId, Type: 'INVENTORY', Tramo: null, TramosDone: 1, TramosTotal: 4, Status: mision.Status },
      Pose: null,
      Chassis: null,
      Jetson: null,
      Rfid: null,
      Camera: null,
      Network: null,
      Alerts: []
    }
  };
}

/** Un doble a mano: lo que se prueba es el store, no HTTP. */
class ApiFalsa {
  lista: RobotInventory[] = [inventario('inv-1'), inventario('inv-viejo', false)];
  tandaActual: RobotBatchView | null = null;
  latidoActual: RobotStatusView | null = null;
  iniciarFalla: unknown = null;
  zonasEnviadas: number[][] = [];
  ordenes: string[] = [];
  progresos = 0;

  async inventarios(): Promise<RobotInventory[]> {
    return this.lista;
  }

  async tanda(): Promise<RobotBatchView | null> {
    return this.tandaActual;
  }

  async iniciarTanda(_inv: string, _dev: number, zonas: readonly number[]): Promise<RobotBatchView> {
    this.zonasEnviadas.push([...zonas]);
    if (this.iniciarFalla !== null) throw this.iniciarFalla;
    this.tandaActual = tanda('Running', [...zonas]);
    return this.tandaActual;
  }

  async pausar(): Promise<RobotBatchView> {
    this.ordenes.push('pause');
    return this.tandaActual!;
  }

  async reanudar(): Promise<RobotBatchView> {
    this.ordenes.push('resume');
    return this.tandaActual!;
  }

  async cancelar(): Promise<RobotBatchView> {
    this.ordenes.push('cancel');
    this.tandaActual = { ...this.tandaActual!, Status: 'Stopped', StopReason: 'CANCELLED' };
    return this.tandaActual;
  }

  async volverAlDock(): Promise<RobotBatchView> {
    this.ordenes.push('rth');
    this.tandaActual = { ...this.tandaActual!, Status: 'Stopped', StopReason: 'RTH' };
    return this.tandaActual;
  }

  async estado(): Promise<RobotStatusView | null> {
    return this.latidoActual;
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

  async function conRobot(): Promise<void> {
    store.elegirInventario('inv-1');
    await store.elegirRobot(7);
  }

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
    await conRobot();

    expect(store.puedeIniciar()).toBeFalse();
  });

  it('Iniciar manda la tanda con las zonas en el orden en que se marcaron', async () => {
    await conRobot();
    store.alternarZona(3);
    store.alternarZona(1);

    expect(store.ordenDe(3)).toBe(1);
    expect(store.ordenDe(1)).toBe(2);
    expect(store.ordenDe(5)).toBeNull();

    await store.iniciar();

    expect(api.zonasEnviadas).toEqual([[3, 1]]);
    expect(store.enMarcha()?.Status).toBe('Running');
    expect(store.zonaEnCurso()).toEqual(jasmine.objectContaining({ numero: 1, total: 2 }));
    // Recién iniciada ya pide el avance, sin esperar al primer intervalo.
    expect(api.progresos).toBeGreaterThan(0);
  });

  it('subir y bajar cambian el orden; desmarcar la quita y las de detrás suben', async () => {
    await conRobot();
    store.alternarZona(3);
    store.alternarZona(1);
    store.alternarZona(5);

    store.moverZona(5, -1);
    expect([...store.zonasMarcadas()]).toEqual([3, 5, 1]);

    // La primera no sube más, ni la última baja más.
    store.moverZona(3, -1);
    store.moverZona(1, 1);
    expect([...store.zonasMarcadas()]).toEqual([3, 5, 1]);

    store.alternarZona(3);
    expect(store.zonasEnOrden().map((z) => z.Name)).toEqual(['Zona 5', 'Zona 1']);

    await store.iniciar();
    expect(api.zonasEnviadas).toEqual([[5, 1]]);
  });

  it('un robot con una tanda en marcha trae sus zonas en su orden y no deja iniciar otra', async () => {
    api.tandaActual = tanda('Running', [5, 3]);

    await conRobot();

    expect(store.enMarcha()).not.toBeNull();
    expect([...store.zonasMarcadas()]).toEqual([5, 3]);
    expect(store.puedeIniciar()).toBeFalse();
  });

  it('una tanda que ya terminó deja iniciar otra', async () => {
    api.tandaActual = tanda('Done', [1]);
    await conRobot();
    store.alternarZona(1);

    expect(store.ultima()?.Status).toBe('Done');
    expect(store.enMarcha()).toBeNull();
    expect(store.puedeIniciar()).toBeTrue();
  });

  it('Pausar, Cancelar y Volver al dock solo con una tanda en marcha', async () => {
    await conRobot();

    await store.pausar();
    await store.cancelar();
    await store.volverAlDock();
    expect(api.ordenes).toEqual([]);

    store.alternarZona(1);
    await store.iniciar();
    await store.pausar();
    await store.cancelar();

    expect(api.ordenes).toEqual(['pause', 'cancel']);
    expect(store.enMarcha()).toBeNull();
    expect(store.ultima()?.StopReason).toBe('CANCELLED');
  });

  it('la pausa sale del latido, y solo si es de la zona en curso', async () => {
    api.tandaActual = tanda('Running', [1]);
    api.latidoActual = latido({ RunId: 'run-viejo', Status: 'PAUSED' });
    await conRobot();
    await store.refrescar();

    // La pausa de otro recorrido no es la de este.
    expect(store.enPausa()).toBeFalse();

    api.latidoActual = latido({ RunId: 'run-1', Status: 'PAUSED' });
    await store.refrescar();

    expect(store.enPausa()).toBeTrue();
  });

  it('Reanudar manda RESUME a la tanda en marcha', async () => {
    api.tandaActual = tanda('Running', [1]);
    api.latidoActual = latido({ RunId: 'run-1', Status: 'PAUSED' });
    await conRobot();
    await store.refrescar();
    expect(store.enPausa()).toBeTrue();

    await store.reanudar();

    expect(api.ordenes).toEqual(['resume']);
  });

  it('un START en PENDING se ve «arrancando» hasta que el latido lo muestra en marcha', async () => {
    const ack = { CommandId: 'c-1', Command: 'START' as const, Status: 'PENDING' as const, Reason: null,
                  Detail: 'sigue preparandose', Resolved: null, At: '2026-11-04T10:00:00Z', RequestedBy: null };
    api.tandaActual = tanda('Running', [1], { LastAck: ack });
    await conRobot();
    expect(store.arrancando()).toBeTrue();

    api.latidoActual = latido({ RunId: 'run-1', Status: 'PREPARING' });
    await store.refrescar();
    expect(store.arrancando()).toBeTrue();

    api.latidoActual = latido({ RunId: 'run-1', Status: 'RUNNING' });
    await store.refrescar();
    expect(store.arrancando()).toBeFalse();
  });

  it('un START aceptado no está «arrancando»', async () => {
    const ack = { CommandId: 'c-1', Command: 'START' as const, Status: 'ACCEPTED' as const, Reason: null,
                  Detail: null, Resolved: null, At: '2026-11-04T10:00:00Z', RequestedBy: null };
    api.tandaActual = tanda('Running', [1], { LastAck: ack });
    await conRobot();

    expect(store.arrancando()).toBeFalse();
  });

  it('el sondeo trae la tanda: cuando la nube pasa a la zona siguiente, se ve', async () => {
    await conRobot();
    store.alternarZona(1);
    store.alternarZona(3);
    await store.iniciar();

    api.tandaActual = { ...api.tandaActual!, Current: 1, CurrentRunId: 'run-2' };
    await store.refrescar();

    expect(store.zonaEnCurso()?.numero).toBe(2);
    expect(store.zonaEnCurso()?.zona.IdZone).toBe(3);
  });

  it('un rechazo del robot se enseña en palabras, con su detalle', async () => {
    api.iniciarFalla = new HttpErrorResponse({
      status: 409,
      error: { Reason: 'BATTERY_LOW', Detail: 'Batería al 12 %', Message: 'Robot rejected START' }
    });
    await conRobot();
    store.alternarZona(1);

    await store.iniciar();

    const accion = store.accion();
    expect(accion.status).toBe('error');
    if (accion.status === 'error') {
      expect(accion.reason).toBe('BATTERY_LOW');
      expect(accion.message).toBe('Batería baja para salir');
      expect(accion.details).toEqual(['Batería al 12 %']);
    }
    expect(store.enMarcha()).toBeNull();
  });

  it('una geocerca inválida (400) cuenta qué zona falla', async () => {
    api.iniciarFalla = new HttpErrorResponse({
      status: 400,
      error: { Message: 'Geocerca no válida', Reason: 'GEOFENCE_INVALID', Detail: 'Zona 1: va de .1 a .S' }
    });
    await conRobot();
    store.alternarZona(1);

    await store.iniciar();

    const accion = store.accion();
    if (accion.status === 'error') {
      expect(accion.message).toBe('La geocerca no es válida para el robot');
      expect(accion.details).toEqual(['Zona 1: va de .1 a .S']);
    } else {
      fail('se esperaba un error');
    }
  });

  it('si el robot no contesta (504), se enseña el mensaje del backend', async () => {
    api.iniciarFalla = new HttpErrorResponse({ status: 504, error: { Message: 'El robot no contestó a tiempo.' } });
    await conRobot();
    store.alternarZona(1);

    await store.iniciar();

    const accion = store.accion();
    expect(accion.status === 'error' && accion.message).toBe('El robot no contestó a tiempo.');
  });

  it('cambiar de inventario lo deja todo sin elegir', async () => {
    await conRobot();
    store.alternarZona(1);

    store.elegirInventario('inv-1');

    expect(store.robotId()).toBeNull();
    expect(store.zonasMarcadas().length).toBe(0);
  });
});
