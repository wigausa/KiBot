import { provideZonelessChangeDetection, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { CompanyStore } from '../../core/company/company.store';
import { ZonesApiService } from '../zones/zones-api.service';
import { MapSummary } from '../zones/zones.models';
import { InventoriesApiService } from './inventories-api.service';
import { CreateInventoryRequest, Device, Inventory } from './inventories.models';
import { InventoriesStore } from './inventories.store';

function plano(id: string, zonas: { IdZone: number; Name: string }[]): MapSummary {
  return { MapId: id, Name: id, CompanyId: 1, Version: 2, CreatedAt: '', Racks: 10, Aisles: 3, Zones: zonas };
}

function dispositivo(id: number, tipo: string, compania: number): Device {
  return { idPuerta: id, nombre: `D${id}`, tipoPuerta: { nombre: tipo }, controlador: { company: { idCompany: compania } } };
}

class ApiFalsa {
  creados: CreateInventoryRequest[] = [];
  cerrados: string[] = [];
  lista: Inventory[] = [
    {
      _id: 'abierto',
      Name: 'Octubre',
      StartDate: '2026-10-01T08:00:00Z',
      EndDate: null,
      MapId: 'ocupado',
      Zones: [{ IdZone: 30, Name: 'Patio', CompanyId: 1 }],
      Devices: [{ IdDevice: 41, Name: 'D41', Type: 'Robot' }]
    },
    { _id: 'ajeno', Name: 'De otra', StartDate: '', EndDate: null, Zones: [{ IdZone: 99, Name: 'X', CompanyId: 2 }] }
  ];

  async inventarios(): Promise<Inventory[]> {
    return this.lista;
  }
  async crear(i: CreateInventoryRequest): Promise<Inventory> {
    this.creados.push(i);
    return { _id: 'nuevo', Name: i.Name, StartDate: '', EndDate: null };
  }
  async cerrar(id: string): Promise<unknown> {
    this.cerrados.push(id);
    return {};
  }
  async dispositivos(): Promise<Device[]> {
    return [
      dispositivo(40, 'Robot', 1),
      dispositivo(41, 'Robot', 1),
      dispositivo(42, 'Portal Inventario', 1),
      dispositivo(43, 'Robot', 2)
    ];
  }
}

class ZonasFalsa {
  async planosDeCompania(): Promise<MapSummary[]> {
    return [
      plano('libre', [
        { IdZone: 10, Name: 'Cocina' },
        { IdZone: 20, Name: 'Sala' }
      ]),
      plano('ocupado', [{ IdZone: 30, Name: 'Patio' }])
    ];
  }
}

describe('InventoriesStore', () => {
  let store: InventoriesStore;
  let api: ApiFalsa;

  beforeEach(async () => {
    api = new ApiFalsa();
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        InventoriesStore,
        { provide: InventoriesApiService, useValue: api },
        { provide: ZonesApiService, useValue: new ZonasFalsa() },
        { provide: CompanyStore, useValue: { companiaId: signal<number | null>(1) } }
      ]
    });
    store = TestBed.inject(InventoriesStore);
    await store.cargar();
  });

  it('solo ofrece robots de la compañía, y el ocupado con su motivo', () => {
    expect(store.robotsElegibles()).toEqual([
      { id: 40, nombre: 'D40', ocupadoPor: null },
      { id: 41, nombre: 'D41', ocupadoPor: 'Octubre' }
    ]);
  });

  it('un plano que ya está en un inventario abierto no se puede elegir', () => {
    expect(store.planosElegibles().map((p) => [p.id, p.ocupadoPor])).toEqual([
      ['libre', null],
      ['ocupado', 'Octubre']
    ]);
  });

  it('lista solo los inventarios de la compañía', () => {
    expect(store.abiertos().map((i) => i._id)).toEqual(['abierto']);
  });

  it('crea el inventario con cada robot en cada zona elegida', async () => {
    store.nombre.set('  Noviembre ');
    store.elegirPlano('libre');
    store.alternarZona(10);
    store.alternarZona(20);
    store.alternarRobot(40);

    expect(store.puedeCrear()).toBeTrue();
    await store.crear();

    expect(api.creados).toEqual([
      {
        Name: 'Noviembre',
        MapId: 'libre',
        Zones: [
          { IdZone: 10, Name: 'Cocina', Devices: [40] },
          { IdZone: 20, Name: 'Sala', Devices: [40] }
        ]
      }
    ]);
    expect(store.nombre()).toBe('');
    expect(store.creacion().status).toBe('ready');
  });

  it('cambiar de plano olvida las zonas del anterior', () => {
    store.elegirPlano('libre');
    store.alternarZona(10);

    store.elegirPlano('ocupado');

    expect(store.zonasMarcadas().size).toBe(0);
  });

  it('cerrar pide confirmación antes de llamar al backend', async () => {
    const inventario = store.abiertos()[0];

    await store.cerrar(inventario);
    expect(api.cerrados).toEqual([]);
    expect(store.confirmandoCierre()).toBe('abierto');

    await store.cerrar(inventario);
    expect(api.cerrados).toEqual(['abierto']);
  });
});
