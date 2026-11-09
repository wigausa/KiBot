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

  zonasDeProgreso: (number | null)[] = [];

  async progreso(_inv: string, zona: number | null = null): Promise<RobotProgress> {
    this.progresos++;
    this.zonasDeProgreso.push(zona);
    // Por zona: la 1 lleva 2 de 4 tramos y la 3, 1 de 4.
    const tramos = zona === 1 ? { TramosDone: 2, TramosTotal: 4, RunId: 'run-z1' } : zona === 3 ? { TramosDone: 1, TramosTotal: 4, RunId: 'run-z3' } : {};
    return {
      IdInventory: 'inv-1',
      IdZone: zona,
      ...tramos,
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

  it('un recorrido que no salió de KiBot (latido con misión) se sigue y no deja iniciar otro', async () => {
    api.latidoActual = latido({ RunId: 'run-manual', Status: 'RUNNING' });
    await conRobot();
    store.verZona(1);

    expect(store.recorridoSinTanda()).toEqual({ runId: 'run-manual' });
    expect(store.botones().iniciar).toBeFalse();
    expect(store.botones().motivo).toContain('no se inició desde KiBot');
    // El sondeo sigue: una segunda vuelta vuelve a pedir el avance.
    const antes = api.progresos;
    await store.refrescar();
    expect(api.progresos).toBeGreaterThan(antes);
  });

  it('sin tanda ni misión viva, no hay recorrido que seguir', async () => {
    await conRobot();
    expect(store.recorridoSinTanda()).toBeNull();
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

  // --- Control por zona (2026-11-06) ---------------------------------------------------------

  it('la pestaña de una zona trae el avance de esa zona', async () => {
    await conRobot();
    store.verZona(1);
    await new Promise((r) => setTimeout(r));

    expect(api.zonasDeProgreso).toContain(1);
    expect(store.progresoDeLaVista()?.RunId).toBe('run-z1');
    expect(store.avanceDeLaVista()).toBe(50);
  });

  it('Iniciar en la pestaña de una zona manda una tanda con solo esa zona', async () => {
    await conRobot();
    store.verZona(3);

    expect(store.botones().iniciar).toBeTrue();
    expect(store.botones().pausar).toBeFalse();
    expect(store.botones().motivo).toContain('Inicia el recorrido');

    await store.iniciarZona(3);
    expect(api.zonasEnviadas).toEqual([[3]]);
  });

  it('sin recorrido, Pausar, Detener y Volver a casa salen apagados', async () => {
    await conRobot();
    store.verZona(1);
    const b = store.botones();
    expect([b.pausar, b.detener, b.casa]).toEqual([false, false, false]);
  });

  it('con la tanda en marcha en esa zona se puede pausar, detener y mandar a casa, pero no iniciar', async () => {
    api.tandaActual = tanda('Running', [1]);
    await conRobot();
    store.verZona(1);

    const b = store.botones();
    expect([b.iniciar, b.pausar, b.detener, b.casa]).toEqual([false, true, true, true]);
  });

  it('en pausa, Iniciar pasa a ser Reanudar', async () => {
    api.tandaActual = tanda('Running', [1]);
    api.latidoActual = latido({ RunId: 'run-1', Status: 'PAUSED' });
    await conRobot();
    store.verZona(1);
    await store.refrescar();

    const b = store.botones();
    expect(b.iniciar).toBeTrue();
    expect(b.reanudar).toBeTrue();
    expect(b.pausar).toBeFalse();
  });

  it('la pestaña de otra zona dice dónde está el robot y apaga los botones', async () => {
    api.tandaActual = tanda('Running', [1]);
    await conRobot();
    store.verZona(5);

    const b = store.botones();
    expect([b.iniciar, b.pausar, b.detener, b.casa]).toEqual([false, false, false, false]);
    expect(b.motivo).toContain('«Zona 1»');
  });

  it('General suma los tramos de todas las zonas de la tanda', async () => {
    api.tandaActual = tanda('Running', [1, 3]);
    await conRobot();
    store.verZona(null);
    await store.refrescar();

    // (2 + 1) de (4 + 4) tramos.
    expect(store.avanceDeLaVista()).toBeCloseTo(37.5, 5);
    expect(store.zonasDeGeneral()).toEqual([1, 3]);
  });

  it('una zona que va en la tanda general lo dice', async () => {
    api.tandaActual = tanda('Running', [1, 3]);
    await conRobot();
    store.verZona(3);

    expect(store.parteDeGeneral()).toEqual({ numero: 2, total: 2, enMarcha: true });
  });
});
