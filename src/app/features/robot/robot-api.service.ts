import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { API_BASE_URL } from '../../core/http/api.config';
import { WarehouseMap } from '../warehouse-map/warehouse-map.models';
import {
  BoxSearchResult,
  BoxSearchStatus,
  RobotInventory,
  RobotProgress,
  RobotRun
} from './robot.models';

/**
 * Los caminos del robot que usan las pantallas de Control y Buscar (B12).
 *
 * <p>Promesas y sin `catchError`, como `WarehouseMapService`: el fallo sube tal cual y lo cuenta el
 * store, que es quien sabe qué enseñar.</p>
 */
@Injectable({ providedIn: 'root' })
export class RobotApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  /** Los inventarios abiertos a los que tiene acceso quien mira. */
  inventarios(): Promise<RobotInventory[]> {
    return firstValueFrom(this.http.get<RobotInventory[]>(`${this.baseUrl}/GetInventories`));
  }

  /** El recorrido abierto de un robot, o `null` si no tiene ninguno (el backend responde 404). */
  async recorridoAbierto(idInventory: string, idDevice: number): Promise<RobotRun | null> {
    try {
      return await firstValueFrom(this.http.get<RobotRun>(this.ruta(idInventory, idDevice)));
    } catch (error) {
      if (error instanceof HttpErrorResponse && error.status === 404) return null;
      throw error;
    }
  }

  /**
   * Abre el recorrido con las zonas que va a cubrir. Al abrirse, WiscanAPIs le avisa a GHT con
   * `robot.run.started` (B9): no hace falta nada más desde aquí.
   */
  abrir(idInventory: string, idDevice: number, zones: readonly number[]): Promise<RobotRun> {
    return firstValueFrom(
      this.http.post<RobotRun>(this.ruta(idInventory, idDevice), { Zones: [...zones] })
    );
  }

  /** Cierra el recorrido. Sin motivo queda `ABORTED`: lo paró una persona. */
  cerrar(idInventory: string, idDevice: number): Promise<RobotRun> {
    return firstValueFrom(this.http.post<RobotRun>(`${this.ruta(idInventory, idDevice)}/close`, {}));
  }

  progreso(idInventory: string): Promise<RobotProgress> {
    return firstValueFrom(
      this.http.get<RobotProgress>(`${this.baseUrl}/inventory/${idInventory}/robot/progress`)
    );
  }

  /** Si ya se puede buscar una caja en el inventario. */
  estadoDeBusqueda(idInventory: string): Promise<BoxSearchStatus> {
    return firstValueFrom(
      this.http.get<BoxSearchStatus>(`${this.baseUrl}/inventory/${idInventory}/robot/box-search`)
    );
  }

  /** Busca una caja por su USDA o su EPC. Con el recorrido sin terminar, el backend responde 409. */
  buscarCaja(idInventory: string, codigo: string): Promise<BoxSearchResult> {
    return firstValueFrom(
      this.http.get<BoxSearchResult>(
        `${this.baseUrl}/inventory/${idInventory}/robot/box/${encodeURIComponent(codigo.trim())}`
      )
    );
  }

  /** El plano que congeló el inventario, para señalar en él dónde está la caja. */
  mapa(mapId: string, version: number): Promise<WarehouseMap> {
    return firstValueFrom(
      this.http.get<WarehouseMap>(`${this.baseUrl}/warehouseMap/${mapId}/version/${version}`)
    );
  }

  private ruta(idInventory: string, idDevice: number): string {
    return `${this.baseUrl}/inventory/${idInventory}/robot/${idDevice}/run`;
  }
}
