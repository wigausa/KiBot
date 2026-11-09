import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { API_BASE_URL } from '../../core/http/api.config';
import { CreateInventoryRequest, Device, EditInventoryRequest, Inventory } from './inventories.models';

/**
 * Crear, listar y cerrar inventarios. Los caminos son los de Witag; el único cambio de backend fue
 * dejar que un robot esté en varias zonas del mismo inventario.
 */
@Injectable({ providedIn: 'root' })
export class InventoriesApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  /** Abiertos y cerrados, de los que tiene acceso quien mira. */
  inventarios(): Promise<Inventory[]> {
    return firstValueFrom(
      this.http.get<Inventory[]>(`${this.baseUrl}/GetInventories`, { params: { includeClosed: true } })
    );
  }

  crear(inventario: CreateInventoryRequest): Promise<Inventory> {
    return firstValueFrom(this.http.post<Inventory>(`${this.baseUrl}/CreateInventory`, inventario));
  }

  /**
   * Cambia solo el nombre y las zonas de un inventario abierto (`PATCH inventory/{id}`). El plano y
   * los robots no cambian: el backend pone los robots del inventario en cada zona nueva.
   */
  editar(id: string, cambios: EditInventoryRequest): Promise<Inventory> {
    return firstValueFrom(this.http.patch<Inventory>(`${this.baseUrl}/inventory/${id}`, cambios));
  }

  cerrar(id: string): Promise<unknown> {
    return firstValueFrom(this.http.put(`${this.baseUrl}/CloseInventory/${id}`, {}));
  }

  /** Todos los dispositivos visibles; la pantalla se queda con los robots de la compañía. */
  dispositivos(): Promise<Device[]> {
    return firstValueFrom(this.http.get<Device[]>(`${this.baseUrl}/puerta`, { params: { permisos: 1 } }));
  }
}
