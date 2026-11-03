import { HttpErrorResponse } from '@angular/common/http';
import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { RobotApiService } from '../robot/robot-api.service';
import { RobotInventory, RobotSearch, codigosDe, esCodigoValido } from '../robot/robot.models';
import { WarehouseMap } from '../warehouse-map/warehouse-map.models';
import { RobotSearchStore } from './robot-search.store';

const inventarios: RobotInventory[] = [
  {
    _id: 'inv-1',
    Name: 'Inventario7Kpruebas2',
    EndDate: null,
    MapId: 'mapa-1',
    MapVersion: 3,
    Zones: [{ IdZone: 26, Name: 'ZonaPrueba1' }],
    Devices: [{ Type: 'Robot', Name: 'RobotInventario01', IdDevice: 39, IdZone: 26, Zone: 'ZonaPrueba1' }]
  },
  { _id: 'cerrado', Name: 'Viejo', EndDate: '2026-10-01T00:00:00Z' }
];

function busqueda(cambios: Partial<RobotSearch> = {}): RobotSearch {
  return {
    SearchId: 'b-1',
    IdInventory: 'inv-1',
    IdDevice: 39,
    IdZone: 26,
    ZoneName: 'ZonaPrueba1',
    Geofence: { Name: 'ZonaPrueba1', From: 'p18.1', To: 'p29.i' },
    Status: 'Running',
    EndReason: null,
    StartedAt: '2026-10-30T15:00:00Z',
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
  Code: 'MT9K2N', Epc: '4D54394B324E000000000000', AisleNumber: 28, AisleId: 'P28', Side: 'B', Tramo: 'INFERIOR',
  Segment: 6, RackId: 'B27-28-I06', RackSide: 'right', Readings: 2, MeanRssi: -53.7,
  FirstSeenAt: '2026-10-30T15:01:00Z', LastSeenAt: '2026-10-30T15:01:00Z'
};

class ApiFalsa {
  enviadas: { zona: number; codigos: readonly string[] }[] = [];
  respuestas: RobotSearch[] = [];
  falla: unknown = null;
  pausas = 0;

  async inventarios(): Promise<RobotInventory[]> {
    return inventarios;
  }

  async iniciarBusqueda(_inv: string, _robot: number, zona: number, codigos: readonly string[]): Promise<RobotSearch> {
    this.enviadas.push({ zona, codigos });
    if (this.falla) throw this.falla;
    return busqueda();
  }

  async busqueda(): Promise<RobotSearch> {
    return this.respuestas.shift() ?? busqueda();
  }

  async recorrido(): Promise<null> {
    return null;
  }

  async mapa(): Promise<WarehouseMap> {
    return { MapId: 'mapa-1', Version: 3 } as WarehouseMap;
  }

  async pausar(): Promise<unknown> {
    this.pausas++;
    return {};
  }
}

describe('códigos de una búsqueda', () => {
  it('separa por líneas, comas o espacios, en mayúsculas y sin repetir', () => {
    expect(codigosDe('mt9k2n\nJPLSGF, mt9k2n ;4D54394B324E000000000000')).toEqual([
      'MT9K2N',
      'JPLSGF',
      '4D54394B324E000000000000'
    ]);
  });

  it('un USDA o un EPC valen; un guion no', () => {
    expect(esCodigoValido('MT9K2N')).toBeTrue();
    expect(esCodigoValido('4D54394B324E000000000000')).toBeTrue();
    expect(esCodigoValido('HA-0DJ2')).toBeFalse();
  });
});

describe('RobotSearchStore', () => {
  let api: ApiFalsa;
  let store: RobotSearchStore;

  beforeEach(async () => {
    api = new ApiFalsa();
    TestBed.configureTestingModule({
      providers: [provideZonelessChangeDetection(), RobotSearchStore, { provide: RobotApiService, useValue: api }]
    });
    store = TestBed.inject(RobotSearchStore);
    await store.cargar();
  });

  afterEach(() => store.ngOnDestroy());

  it('solo ofrece inventarios abiertos y, con un robot y una zona, los elige solos', () => {
    expect(store.abiertos().map((i) => i._id)).toEqual(['inv-1']);

    store.elegirInventario('inv-1');

    expect(store.robotId()).toBe(39);
    expect(store.zonaId()).toBe(26);
  });

  it('viniendo de Buscar caja, deja el inventario y el código puestos', () => {
    store.prellenar('inv-1', 'mt9k2n');

    expect(store.inventarioId()).toBe('inv-1');
    expect(store.texto()).toBe('MT9K2N');
    expect(store.puedeBuscar()).toBeTrue();
  });

  it('no deja buscar con un código que no se entiende', () => {
    store.elegirInventario('inv-1');
    store.texto.set('MT9K2N\nHA-0DJ2');

    expect(store.invalidos()).toEqual(['HA-0DJ2']);
    expect(store.puedeBuscar()).toBeFalse();
  });

  it('manda la zona y los códigos, y sigue la búsqueda hasta que termina', async () => {
    store.elegirInventario('inv-1');
    store.texto.set('MT9K2N, JPLSGF');

    await store.buscar();

    expect(api.enviadas).toEqual([{ zona: 26, codigos: ['MT9K2N', 'JPLSGF'] }]);
    expect(store.enMarcha()).toBeTrue();

    api.respuestas = [busqueda({ Found: [encontrada], Missing: [{ Code: 'JPLSGF', Epc: '4A504C534746000000000000' }] })];
    await store.refrescar();
    expect(store.busqueda()!.Found.length).toBe(1);
    expect(store.resaltadas()).toEqual([{ rackId: 'B27-28-I06', side: 'right' }]);

    api.respuestas = [busqueda({ Status: 'Done', EndReason: 'COMPLETED', Found: [encontrada] })];
    await store.refrescar();
    expect(store.enMarcha()).toBeFalse();
  });

  it('si el robot la rechaza, enseña el motivo y la búsqueda rechazada', async () => {
    store.elegirInventario('inv-1');
    store.texto.set('MT9K2N');
    api.falla = new HttpErrorResponse({
      status: 409,
      error: { Message: 'El robot rechazó la búsqueda.', Reason: 'BATTERY_LOW', Search: busqueda({ Status: 'Rejected' }) }
    });

    await store.buscar();

    const envio = store.envio();
    expect(envio.status).toBe('error');
    if (envio.status === 'error') expect(envio.reason).toBe('BATTERY_LOW');
    expect(store.busqueda()!.Status).toBe('Rejected');
  });

  it('pausar solo se manda con una búsqueda en marcha', async () => {
    store.elegirInventario('inv-1');
    await store.pausar();
    expect(api.pausas).toBe(0);

    store.texto.set('MT9K2N');
    await store.buscar();
    await store.pausar();
    expect(api.pausas).toBe(1);
  });
});
