import { HttpErrorResponse } from '@angular/common/http';
import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { CompanyStore } from '../../core/company/company.store';
import { InventoriesApiService } from '../inventories/inventories-api.service';
import { Device } from '../inventories/inventories.models';
import { RobotApiService } from '../robot/robot-api.service';
import {
  RobotSearch,
  RobotStatusView,
  codigosDe,
  esCodigoValido,
  ladoTexto,
  nivelDeConfianza,
  pasilloTexto,
  textoDeConfianza
} from '../robot/robot.models';
import { WarehouseMap } from '../warehouse-map/warehouse-map.models';
import { ZonesApiService } from '../zones/zones-api.service';
import { MapSummary } from '../zones/zones.models';
import { RobotSearchStore, motivoParaNoSalir } from './robot-search.store';

const planos: MapSummary[] = [
  {
    MapId: 'mapa-1', Name: 'Plano Prueba 7K', CompanyId: 1, Version: 8, CreatedAt: '2026-11-01T00:00:00Z',
    Racks: 10, Aisles: 4, Zones: [{ IdZone: 26, Name: 'ZonaPrueba1' }]
  },
  {
    MapId: 'mapa-2', Name: 'Otro', CompanyId: 1, Version: 1, CreatedAt: '2026-11-01T00:00:00Z',
    Racks: 1, Aisles: 1, Zones: [{ IdZone: 30, Name: 'A' }, { IdZone: 31, Name: 'B' }]
  }
];

const dispositivos: Device[] = [
  { idPuerta: 39, nombre: 'RobotInventario01', tipoPuerta: { nombre: 'Robot' }, controlador: { company: { idCompany: 1 } } },
  { idPuerta: 12, nombre: 'Portal 1', tipoPuerta: { nombre: 'Portal' }, controlador: { company: { idCompany: 1 } } }
];

function latido(cambios: Partial<RobotStatusView['Status']> = {}, signal: 'OK' | 'NO_SIGNAL' = 'OK'): RobotStatusView {
  return {
    IdDevice: 39, DeviceName: 'RobotInventario01', RobotId: 'wiga-01', Timestamp: '', ReceivedAt: '', Signal: signal, SilentForS: 5,
    Status: { State: 'IDLE', Activity: 'IDLE', Mission: null, Chassis: null, ...cambios } as RobotStatusView['Status']
  };
}

function busqueda(cambios: Partial<RobotSearch> = {}): RobotSearch {
  return {
    SearchId: 'b-1',
    IdInventory: 'search:b-1',
    IdDevice: 39,
    IdZone: 26,
    ZoneName: 'ZonaPrueba1',
    Geofence: { Name: 'ZonaPrueba1', From: 'p18.1', To: 'p29.i' },
    MapId: 'mapa-1',
    MapVersion: 8,
    TramosDone: 0,
    TramosTotal: null,
    Status: 'Running',
    EndReason: null,
    StartedAt: '2026-11-12T15:00:00Z',
    EndedAt: null,
    Ack: null,
    Total: 2,
    Found: [],
    Missing: [
      { Code: 'MT9K2N', Epc: '4D54394B324E000000000000' },
      { Code: 'JPLSGF', Epc: '4A504C534746000000000000' }
    ],
    ...cambios
  };
}

const encontrada = {
  Code: 'MT9K2N', Epc: '4D54394B324E000000000000', AisleNumber: 20, AisleId: 'P20', Side: 'B', Tramo: 'INFERIOR',
  Segment: 6, RackId: 'B20-21-I06', RackSide: 'right', Readings: 9, MeanRssi: -53.7,
  FirstSeenAt: '2026-11-12T15:01:00Z', LastSeenAt: '2026-11-12T15:02:00Z', Confidence: 0.92, Status: 'Resolved' as const
};

class ApiFalsa {
  enviadas: { robot: number; mapa: string; zona: number; codigos: readonly string[] }[] = [];
  respuestas: RobotSearch[] = [];
  ordenes: string[] = [];
  estadoDelRobot: RobotStatusView | null = latido();
  falla: unknown = null;

  async iniciarBusqueda(robot: number, mapa: string, zona: number, codigos: readonly string[]): Promise<RobotSearch> {
    this.enviadas.push({ robot, mapa, zona, codigos });
    if (this.falla) throw this.falla;
    return busqueda();
  }

  async busqueda(): Promise<RobotSearch> {
    return this.respuestas.shift() ?? busqueda();
  }

  async recorridoDeBusqueda(): Promise<null> {
    return null;
  }

  async mapa(): Promise<WarehouseMap> {
    return { MapId: 'mapa-1', Version: 8, ShelvingUnits: [], Zones: [] } as unknown as WarehouseMap;
  }

  async estado(): Promise<RobotStatusView | null> {
    return this.estadoDelRobot;
  }

  async ordenDeBusqueda(_id: string, accion: string): Promise<RobotSearch> {
    this.ordenes.push(accion);
    return busqueda();
  }
}

describe('RobotSearchStore (sin inventario)', () => {
  let store: RobotSearchStore;
  let api: ApiFalsa;

  beforeEach(async () => {
    api = new ApiFalsa();
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        RobotSearchStore,
        { provide: RobotApiService, useValue: api },
        { provide: ZonesApiService, useValue: {
          planosDeCompania: async () => planos,
          planoVigente: async () => ({ MapId: 'mapa-1', Version: 8, ShelvingUnits: [], Zones: [] })
        } },
        { provide: InventoriesApiService, useValue: { dispositivos: async () => dispositivos } },
        { provide: CompanyStore, useValue: { companiaId: () => 1 } }
      ]
    });
    store = TestBed.inject(RobotSearchStore);
    await store.cargar();
    await Promise.resolve();
  });

  afterEach(() => store.ngOnDestroy());

  async function listo(): Promise<void> {
    store.elegirPlano('mapa-1');
    store.texto.set('MT9K2N\nJPLSGF');
    await store.elegirRobot(39);
  }

  it('solo ofrece los robots de la compañía y elige solo el único', async () => {
    expect(store.robots().map((r) => r.id)).toEqual([39]);
    await Promise.resolve();
    expect(store.robotId()).toBe(39);
  });

  it('al elegir un plano con una sola zona, la elige', () => {
    store.elegirPlano('mapa-1');
    expect(store.zonaId()).toBe(26);
    store.elegirPlano('mapa-2');
    expect(store.zonaId()).toBeNull();
  });

  it('busca con plano, zona y robot, sin inventario', async () => {
    await listo();
    expect(store.puedeBuscar()).toBeTrue();

    await store.buscar();

    expect(api.enviadas).toEqual([{ robot: 39, mapa: 'mapa-1', zona: 26, codigos: ['MT9K2N', 'JPLSGF'] }]);
    expect(store.enMarcha()).toBeTrue();
  });

  it('no deja buscar con el robot en parada de emergencia, y dice por qué', async () => {
    api.estadoDelRobot = latido({ State: 'ESTOP' });
    await listo();

    expect(store.puedeBuscar()).toBeFalse();
    expect(store.faltaParaBuscar()).toContain('parada de emergencia');
  });

  it('no deja buscar con una misión que el robot arrancó por su cuenta', async () => {
    api.estadoDelRobot = latido({ State: 'RUNNING', Mission: { RunId: 'suya', Status: 'RUNNING' } as never });
    await listo();
    expect(store.motivoDelRobot()).toContain('otra misión');
  });

  it('el avance del recorrido sale de los tramos, y las cajas de lo encontrado', async () => {
    await listo();
    await store.buscar();
    api.respuestas.push(busqueda({ TramosDone: 1, TramosTotal: 4, Found: [encontrada], Missing: [{ Code: 'JPLSGF', Epc: 'x' }] }));

    await store.refrescar();

    expect(store.avanceDelRecorrido()).toBe(25);
    expect(store.avanceDeCajas()).toBe(50);
    expect(store.tramosHechos()).toBe(1);
  });

  it('al terminar: tabla con lado Izquierda/Derecha, pasillo a secas y una marca por caja', async () => {
    await listo();
    await store.buscar();
    api.respuestas.push(busqueda({ Status: 'Done', EndReason: 'COMPLETED', Found: [encontrada], Missing: [{ Code: 'JPLSGF', Epc: 'x' }] }));

    await store.refrescar();

    expect(store.terminada()).toBeTrue();
    const [primera, segunda] = store.filas();
    expect(primera.numero).toBe(1);
    expect(primera.lado).toBe('Derecha');
    expect(primera.pasillo).toBe('20');
    expect(primera.tramo).toBe('Inferior');
    expect(primera.estado).toBe('Encontrada');
    expect(segunda.estado).toBe('No encontrada');
    expect(store.marcadores()).toEqual([{ rackId: 'B20-21-I06', side: 'right', etiqueta: '1', tono: 'alta', activo: false }]);
    expect(store.resumen()).toEqual({ encontradas: 1, ambiguas: 0, faltan: 1, total: 2 });
    expect(store.csv().split('\r\n')[1]).toContain(';Derecha;');
  });

  it('las órdenes van por el id de la búsqueda', async () => {
    await listo();
    await store.buscar();
    await store.pausar();
    expect(api.ordenes).toEqual(['pause']);
  });

  it('una búsqueda rechazada se enseña con su motivo', async () => {
    await listo();
    api.falla = new HttpErrorResponse({
      status: 409,
      error: { Message: 'El robot rechazó la búsqueda.', Reason: 'BATTERY_LOW', Search: busqueda({ Status: 'Rejected' }) }
    });

    await store.buscar();

    expect(store.envio().status).toBe('error');
    expect(store.busqueda()?.Status).toBe('Rejected');
  });
});

describe('formato de la búsqueda', () => {
  it('lado: left/right como Izquierda/Derecha', () => {
    expect(ladoTexto('left')).toBe('Izquierda');
    expect(ladoTexto('RIGHT')).toBe('Derecha');
    expect(ladoTexto(null)).toBe('—');
  });

  it('pasillo: el número a secas', () => {
    expect(pasilloTexto(20)).toBe('20');
    expect(pasilloTexto(null, 'P20')).toBe('20');
    expect(pasilloTexto(null, null)).toBe('—');
  });

  it('confianza: ambigua es baja; sin dato, media', () => {
    expect(nivelDeConfianza({ Confidence: 0.95, Status: 'Resolved' })).toBe('alta');
    expect(nivelDeConfianza({ Confidence: 0.7, Status: 'Resolved' })).toBe('media');
    expect(nivelDeConfianza({ Confidence: 0.6, Status: 'Ambiguous' })).toBe('baja');
    expect(nivelDeConfianza({ Confidence: null, Status: null })).toBe('media');
    expect(textoDeConfianza({ Confidence: 0.92, Status: 'Resolved' })).toBe('Alta · 92 %');
  });

  it('códigos: USDA o EPC', () => {
    expect(codigosDe('mt9k2n, JPLSGF\nmt9k2n')).toEqual(['MT9K2N', 'JPLSGF']);
    expect(esCodigoValido('HA-0DJ2')).toBeFalse();
  });

  it('robot libre: la misma regla que el backend', () => {
    expect(motivoParaNoSalir(null)).toContain('latido');
    expect(motivoParaNoSalir(latido({}, 'NO_SIGNAL'))).toContain('señal');
    expect(motivoParaNoSalir(latido({ State: 'CHARGING' }))).toContain('cargando');
    expect(motivoParaNoSalir(latido({ Mission: { RunId: 'r', Status: 'FINISHED' } as never }))).toBeNull();
    expect(motivoParaNoSalir(latido())).toBeNull();
  });
});
