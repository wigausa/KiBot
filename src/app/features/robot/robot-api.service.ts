import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { ApiFailure, apiFailure } from '../../core/http/api-error';
import { API_BASE_URL } from '../../core/http/api.config';
import { WarehouseMap } from '../warehouse-map/warehouse-map.models';
import {
  BoxSearchResult,
  BoxSearchStatus,
  RobotBatchView,
  RobotInventory,
  RobotProgress,
  RobotSearch,
  RobotStatusView,
  RobotTrack,
  textoDeRechazo
} from './robot.models';

/** Un fallo de una orden al robot, con el motivo en código para quien tenga que decidir por él. */
export interface FalloDeOrden extends ApiFailure {
  /** `BATTERY_LOW`, `BATCH_RUNNING`, `GEOFENCE_INVALID`… Nulo si el fallo no trae motivo. */
  readonly reason: string | null;
}

/**
 * Lee el fallo de una orden. Las órdenes contestan <c>{ Reason, Detail, Message }</c> (409 si el
 * robot la rechaza, 400 si una zona no tiene geocerca válida): el motivo se enseña en palabras y el
 * detalle debajo, porque «Zona 4: .1–.S» dice qué arreglar. Sin motivo (502/504, la red), el
 * `Message` o lo que saque `apiFailure`.
 */
export function falloDeOrden(error: unknown): FalloDeOrden {
  const cuerpo = error instanceof HttpErrorResponse ? (error.error as unknown) : null;
  if (cuerpo !== null && typeof cuerpo === 'object' && !Array.isArray(cuerpo)) {
    const registro = cuerpo as Record<string, unknown>;
    const reason = typeof registro['Reason'] === 'string' && registro['Reason'] !== '' ? registro['Reason'] : null;
    const detail = typeof registro['Detail'] === 'string' && registro['Detail'].trim() !== '' ? registro['Detail'] : null;
    const mensaje = typeof registro['Message'] === 'string' && registro['Message'].trim() !== '' ? registro['Message'] : null;

    if (reason !== null) return { reason, message: textoDeRechazo(reason), details: detail ? [detail] : [] };
    if (mensaje !== null) return { reason: null, message: mensaje, details: detail ? [detail] : [] };
  }
  return { reason: null, ...apiFailure(error) };
}

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

  /** La tanda en marcha del robot, o la última. `null` si nunca tuvo ninguna (el backend responde 404). */
  async tanda(idInventory: string, idDevice: number): Promise<RobotBatchView | null> {
    try {
      return await firstValueFrom(this.http.get<RobotBatchView>(this.rutaDeTanda(idInventory, idDevice)));
    } catch (error) {
      if (error instanceof HttpErrorResponse && error.status === 404) return null;
      throw error;
    }
  }

  /**
   * Empieza una tanda: las zonas en el orden en que se recorren. La nube manda el `START` de la
   * primera y encadena las demás sola. Un rechazo del robot llega como 409 (ver `falloDeOrden`).
   */
  iniciarTanda(idInventory: string, idDevice: number, zones: readonly number[]): Promise<RobotBatchView> {
    return firstValueFrom(
      this.http.post<RobotBatchView>(this.rutaDeTanda(idInventory, idDevice), { Zones: [...zones] })
    );
  }

  /** Pausa la zona en curso. De la pausa se sale reanudando, cancelando o volviendo al dock. */
  pausar(idInventory: string, idDevice: number): Promise<RobotBatchView> {
    return this.orden(idInventory, idDevice, 'pause');
  }

  /** Sigue la zona pausada donde se quedó (RESUME). Si no está en pausa, el robot contesta NOT_PAUSED. */
  reanudar(idInventory: string, idDevice: number): Promise<RobotBatchView> {
    return this.orden(idInventory, idDevice, 'resume');
  }

  /** Cancela la zona en curso y con ella la tanda: el robot se queda donde está y no se encadena la siguiente. */
  cancelar(idInventory: string, idDevice: number): Promise<RobotBatchView> {
    return this.orden(idInventory, idDevice, 'cancel');
  }

  /** Lo manda al dock (RTH). También detiene la tanda. */
  volverAlDock(idInventory: string, idDevice: number): Promise<RobotBatchView> {
    return this.orden(idInventory, idDevice, 'rth');
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

  /** El último latido de cada robot. Los que nunca latieron no vienen. */
  estados(idDevices: readonly number[]): Promise<RobotStatusView[]> {
    return firstValueFrom(
      this.http.get<RobotStatusView[]>(`${this.baseUrl}/robot/status`, {
        params: { devices: idDevices.join(',') }
      })
    );
  }

  /** El último latido de un robot con sus cambios recientes, o `null` si nunca latió (404). */
  async estado(idDevice: number): Promise<RobotStatusView | null> {
    try {
      return await firstValueFrom(
        this.http.get<RobotStatusView>(`${this.baseUrl}/robot/${idDevice}/status`)
      );
    } catch (error) {
      if (error instanceof HttpErrorResponse && error.status === 404) return null;
      throw error;
    }
  }

  /**
   * Manda al robot a buscar unas cajas (USDA o EPC) en una zona. El rechazo (409/400) trae
   * `{ Reason, Detail, Search }`: se lee con `falloDeOrden`.
   */
  iniciarBusqueda(idInventory: string, idDevice: number, zona: number, codigos: readonly string[]): Promise<RobotSearch> {
    return firstValueFrom(
      this.http.post<RobotSearch>(`${this.baseUrl}/inventory/${idInventory}/robot/${idDevice}/search`, {
        Zone: zona,
        Codes: codigos
      })
    );
  }

  /** Cómo va una búsqueda: lo encontrado (en vivo mientras corre) y lo que falta. */
  busqueda(idInventory: string, searchId: string): Promise<RobotSearch> {
    return firstValueFrom(
      this.http.get<RobotSearch>(`${this.baseUrl}/inventory/${idInventory}/robot/search/${searchId}`)
    );
  }

  /**
   * Por dónde va (o fue) el robot en el plano del inventario. Sin `runId`, el recorrido abierto o el
   * último; con `since` (ISO), solo los puntos posteriores, para ir sumando en vivo.
   */
  recorrido(idInventory: string, idDevice: number, runId?: string | null, since?: string | null): Promise<RobotTrack> {
    const params: Record<string, string> = {};
    if (runId) params['runId'] = runId;
    if (since) params['since'] = since;
    return firstValueFrom(
      this.http.get<RobotTrack>(`${this.baseUrl}/inventory/${idInventory}/robot/${idDevice}/track`, { params })
    );
  }

  private orden(idInventory: string, idDevice: number, accion: 'pause' | 'resume' | 'cancel' | 'rth'): Promise<RobotBatchView> {
    return firstValueFrom(
      this.http.post<RobotBatchView>(`${this.baseUrl}/inventory/${idInventory}/robot/${idDevice}/${accion}`, {})
    );
  }

  private rutaDeTanda(idInventory: string, idDevice: number): string {
    return `${this.baseUrl}/inventory/${idInventory}/robot/${idDevice}/batch`;
  }
}
