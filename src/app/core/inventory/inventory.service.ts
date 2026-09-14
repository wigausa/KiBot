import { Injectable, computed, signal } from '@angular/core';

export interface InventoryZone {
  readonly id: string;
  readonly label: string;
}

export interface Inventory {
  readonly id: string;
  readonly name: string;
  readonly zones: readonly InventoryZone[];
}

/**
 * WiDex opera dentro de un único inventario (bodega) por despliegue: no hay
 * selector de inventario en la UI (el robot ya sabe en cuál está). Las zonas
 * que se pueden elegir para el recorrido SIEMPRE salen de este inventario —
 * ninguna pantalla debe mantener su propia lista suelta de zonas.
 *
 * Dato local hasta que exista un backend de inventarios; el resto de la app
 * consume `currentInventory()`/`zones()`, nunca duplica estos valores (así
 * "Bodega 7000" vive en un solo lugar en vez de repetirse en el sidebar y en
 * cada módulo que necesite zonas).
 */
const CURRENT_INVENTORY: Inventory = {
  id: 'bodega-7000',
  name: 'Bodega 7000',
  zones: [
    { id: 'cooler-1', label: 'Cooler #1' },
    { id: 'cooler-2', label: 'Cooler #2' },
    { id: 'cooler-3', label: 'Cooler #3' },
    { id: 'charging-station', label: 'Est. de carga' },
    { id: 'zone-e', label: 'Zona E' },
    { id: 'zone-f', label: 'Zona F' }
  ]
};

@Injectable({ providedIn: 'root' })
export class InventoryService {
  private readonly inventory = signal<Inventory>(CURRENT_INVENTORY);

  readonly currentInventory = this.inventory.asReadonly();
  readonly zones = computed(() => this.inventory().zones);
}
