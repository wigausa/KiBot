import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { API_BASE_URL } from '../http/api.config';
import { apiFailure } from '../http/api-error';
import { Async } from '../../features/warehouse-map/warehouse-map.store';

/** Una compañía, tal como la devuelve `GET companies` (camelCase: ese endpoint es de los viejos). */
export interface Company {
  idCompany: number;
  name: string;
}

const CLAVE = 'kibot.compania';

/**
 * La compañía con la que se trabaja.
 *
 * <p><b>Existe porque KiBot la necesita y nadie más se la da.</b> Las zonas, los planos y los robots
 * son de una compañía; en Witag se elige en cada formulario. Aquí se elige una vez, arriba, y vale
 * para Zonas e Inventarios. Cuando KiBot tenga login (B2C), saldrá del usuario.</p>
 *
 * <p>Se recuerda en el navegador por comodidad, y nada más: si no se puede leer, se vuelve a elegir.</p>
 */
@Injectable({ providedIn: 'root' })
export class CompanyStore {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  private readonly _companias = signal<Async<Company[]>>({ status: 'idle' });
  readonly companias = this._companias.asReadonly();

  readonly companiaId = signal<number | null>(CompanyStore.recordada());

  readonly compania = computed(() => {
    const lista = this._companias();
    return lista.status === 'ready' ? lista.value.find((c) => c.idCompany === this.companiaId()) ?? null : null;
  });

  /** Carga la lista una vez; las pantallas la piden al entrar y no hace falta repetirlo. */
  async cargar(): Promise<void> {
    const actual = this._companias().status;
    if (actual === 'ready' || actual === 'loading') return;

    this._companias.set({ status: 'loading' });
    try {
      const lista = await firstValueFrom(
        this.http.get<Company[]>(`${this.baseUrl}/companies`, { params: { permisos: 1 } })
      );
      const ordenada = [...lista].sort((a, b) => a.name.localeCompare(b.name));
      this._companias.set({ status: 'ready', value: ordenada });

      // Una recordada que ya no está en la lista no vale; con una sola, no hay nada que elegir.
      if (!ordenada.some((c) => c.idCompany === this.companiaId())) {
        this.elegir(ordenada.length === 1 ? ordenada[0].idCompany : null);
      }
    } catch (error) {
      this._companias.set({ status: 'error', ...apiFailure(error) });
    }
  }

  elegir(id: number | null): void {
    this.companiaId.set(id);
    try {
      if (id === null) localStorage.removeItem(CLAVE);
      else localStorage.setItem(CLAVE, String(id));
    } catch {
      // Sin almacenamiento (navegación privada, bloqueado): se elige otra vez la próxima.
    }
  }

  private static recordada(): number | null {
    try {
      const valor = Number(localStorage.getItem(CLAVE));
      return Number.isInteger(valor) && valor > 0 ? valor : null;
    } catch {
      return null;
    }
  }
}
