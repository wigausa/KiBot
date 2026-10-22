import { Injectable, computed, inject, signal } from '@angular/core';

import { apiFailure } from '../../core/http/api-error';
import { PlanPreview, PlanSaveResult, WarehousePlan } from './warehouse-map.models';
import { WarehouseMapService } from './warehouse-map.service';

/**
 * Una operación que va y vuelve.
 *
 * <p>Unión discriminada y no tres booleanos sueltos: así «cargando y con error a la vez» no se puede
 * ni escribir.</p>
 */
export type Async<T> =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'error'; message: string; details: readonly string[] }
  | { status: 'ready'; value: T };

const OCIOSO = { status: 'idle' } as const;

/**
 * El estado de la pantalla del plano.
 *
 * <p><b>No es singleton.</b> Se provee en el componente de ruta: si viviera en el inyector raíz, un
 * plano a medio escribir sobreviviría a salir de la pantalla y volver, y aparecería texto de otra
 * sesión de trabajo sin que nadie lo pidiera.</p>
 */
@Injectable()
export class WarehouseMapStore {
  private readonly api = inject(WarehouseMapService);

  /** El plano tal como se está escribiendo. Es la fuente de verdad de los dos modos. */
  readonly texto = signal('');

  private readonly _preview = signal<Async<PlanPreview>>(OCIOSO);
  private readonly _guardado = signal<Async<PlanSaveResult>>(OCIOSO);

  readonly preview = this._preview.asReadonly();
  readonly guardado = this._guardado.asReadonly();

  /**
   * Descarta respuestas que llegan tarde.
   *
   * <p>Si alguien previsualiza dos veces seguidas y la primera tarda más que la segunda, sin esto
   * la pantalla acabaría enseñando el resultado del plano viejo sobre el texto nuevo.</p>
   */
  private peticion = 0;

  readonly cargando = computed(() => this._preview().status === 'loading');
  readonly guardando = computed(() => this._guardado().status === 'loading');

  /** El mapa ya expandido, que es lo que dibuja el lienzo. */
  readonly mapa = computed(() => {
    const estado = this._preview();
    return estado.status === 'ready' ? estado.value.Map : null;
  });

  readonly resumen = computed(() => {
    const estado = this._preview();
    return estado.status === 'ready' ? estado.value.Resumen : null;
  });

  /** Lo que hay que arreglar en el plano. No es un fallo: es el contenido de la pantalla. */
  readonly erroresDelPlano = computed(() => {
    const estado = this._preview();
    return estado.status === 'ready' ? estado.value.Errors : [];
  });

  /** Lo que conviene mirar, pero no impide guardar. */
  readonly avisos = computed(() => {
    const estado = this._preview();
    return estado.status === 'ready' ? estado.value.Warnings : [];
  });

  /**
   * <b>La regla de la pantalla.</b> Solo se guarda un plano que se haya previsualizado y haya salido
   * válido: ni a ciegas, ni con errores, ni después de tocar el texto.
   */
  readonly puedeGuardar = computed(() => {
    const estado = this._preview();
    return estado.status === 'ready' && estado.value.Valid && !this.guardando();
  });

  /** Edita el plano. Invalida la previsualización: lo que hay en pantalla ya no es de este texto. */
  escribir(texto: string): void {
    this.texto.set(texto);
    if (this._preview().status !== 'idle') this._preview.set(OCIOSO);
    if (this._guardado().status !== 'idle') this._guardado.set(OCIOSO);
  }

  /** Cambia el plano desde el lienzo, y vuelve a previsualizar para redibujar. */
  async aplicar(plan: WarehousePlan): Promise<void> {
    this.escribir(JSON.stringify(plan, null, 2));
    await this.previsualizar();
  }

  async previsualizar(): Promise<void> {
    const plan = this.leer();
    if (plan === null) return;

    const mio = ++this.peticion;
    this._preview.set({ status: 'loading' });

    try {
      const respuesta = await this.api.previewPlan(plan);
      if (mio === this.peticion) this._preview.set({ status: 'ready', value: respuesta });
    } catch (error) {
      if (mio === this.peticion) this._preview.set(this.fallo(error));
    }
  }

  async guardar(mapId?: string): Promise<void> {
    const plan = this.leer();
    if (plan === null || !this.puedeGuardar()) return;

    this._guardado.set({ status: 'loading' });

    try {
      const respuesta = mapId
        ? await this.api.saveVersionFromPlan(mapId, plan)
        : await this.api.createFromPlan(plan);
      this._guardado.set({ status: 'ready', value: respuesta });
    } catch (error) {
      this._guardado.set(this.fallo(error));
    }
  }

  /**
   * Interpreta el texto. Un JSON mal escrito se contesta <b>sin ir a la red</b>: el error es local
   * y la respuesta es inmediata.
   */
  private leer(): WarehousePlan | null {
    try {
      const plan = JSON.parse(this.texto()) as WarehousePlan;
      if (plan === null || typeof plan !== 'object') throw new Error('El plano tiene que ser un objeto.');
      return plan;
    } catch (error) {
      this._preview.set({
        status: 'error',
        message: `El texto no es JSON válido: ${error instanceof Error ? error.message : ''}`.trim(),
        details: []
      });
      return null;
    }
  }

  private fallo(error: unknown): Async<never> {
    const { message, details } = apiFailure(error);
    return { status: 'error', message, details };
  }
}
