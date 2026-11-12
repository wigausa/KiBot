import { ChangeDetectionStrategy, Component, OnInit, computed, effect, inject, input, untracked } from '@angular/core';
import { DatePipe, PercentPipe } from '@angular/common';
import { RouterLink } from '@angular/router';

import { KiBotButton } from '../../shared/ui/kibot-button/kibot-button';
import { KiBotErrorState } from '../../shared/ui/kibot-error-state/kibot-error-state';
import { KiBotLoadingIndicator } from '../../shared/ui/kibot-loading-indicator/kibot-loading-indicator';
import { PlanCanvas, RejillaDelPlano } from '../warehouse-map/plan-canvas/plan-canvas';
import { WarehouseMap } from '../warehouse-map/warehouse-map.models';
import { ladoTexto } from '../robot/robot.models';
import { BoxSearchStore } from './box-search.store';

/**
 * Lo que mide la rejilla de un plano ya guardado. En el editor sale del plano que se escribe; aquí
 * solo hay el mapa, y basta con sus segmentos para que el marco del lienzo quede bien encuadrado.
 */
export function rejillaDelMapa(mapa: WarehouseMap): RejillaDelPlano {
  const caras = mapa.ShelvingUnits.flatMap((u) => u.Faces);
  const tramo = (t: string) =>
    Math.max(0, ...caras.filter((c) => c.Tramo?.toUpperCase() === t).map((c) => c.Segment ?? 0));

  return {
    inferior: tramo('INFERIOR'),
    superior: tramo('SUPERIOR'),
    largoSegmento: mapa.ShelvingUnits[0]?.Length ?? 1,
    hueco: 0
  };
}

/**
 * Buscar caja (B12): por el USDA impreso o por el EPC, y solo con el recorrido terminado.
 *
 * <p>Desde noviembre de 2026 es la pestaña «En el último recorrido» de Buscar: con `embebido`, el
 * inventario llega por `input` (el elegido arriba) y no hay selector ni título propios.</p>
 */
@Component({
  selector: 'kibot-box-search',
  imports: [KiBotButton, KiBotErrorState, KiBotLoadingIndicator, PlanCanvas, DatePipe, PercentPipe, RouterLink],
  providers: [BoxSearchStore],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './box-search.html',
  styleUrl: './box-search.scss'
})
export class BoxSearch implements OnInit {
  protected readonly store = inject(BoxSearchStore);

  /** El lado como lo dice el operador: Izquierda o Derecha. */
  protected readonly lado = ladoTexto;

  readonly inventarioId = input<string | null>(null);
  /** Embebido: la zona elegida arriba. La búsqueda va filtrada por ella. */
  readonly zonaId = input<number | null>(null);
  readonly embebido = input(false);

  constructor() {
    effect(() => {
      const inv = this.inventarioId();
      const listo = this.store.inventarios().status === 'ready';
      if (!this.embebido() || !listo) return;
      untracked(() => {
        if (inv !== this.store.inventarioId()) void this.store.elegirInventario(inv);
      });
    });

    effect(() => {
      const zona = this.zonaId();
      untracked(() => {
        if (zona === this.store.zonaId()) return;
        this.store.zonaId.set(zona);
        // Un resultado de otra zona ya no vale: se vuelve a buscar con la nueva.
        if (this.store.resultado().status === 'ready') void this.store.buscar();
      });
    });
  }

  protected readonly rejilla = computed(() => {
    const m = this.store.mapa();
    return m.status === 'ready' ? rejillaDelMapa(m.value) : null;
  });

  ngOnInit(): void {
    void this.store.cargar();
  }

  protected alElegirInventario(evento: Event): void {
    const valor = (evento.target as HTMLSelectElement).value;
    void this.store.elegirInventario(valor === '' ? null : valor);
  }

  protected alEscribir(evento: Event): void {
    this.store.codigo.set((evento.target as HTMLInputElement).value);
  }

  protected alBuscar(evento: Event): void {
    evento.preventDefault();
    if (this.embebido() && this.store.zonaId() === null) return;
    void this.store.buscar();
  }

  /** "inferior" en vez de "INFERIOR": se lee mejor en una frase. */
  protected minusculas(texto: string | null): string {
    return (texto ?? '').toLowerCase();
  }
}
