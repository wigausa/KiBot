import { ChangeDetectionStrategy, Component, OnInit, computed, inject } from '@angular/core';
import { DatePipe, PercentPipe } from '@angular/common';

import { KiBotButton } from '../../shared/ui/kibot-button/kibot-button';
import { KiBotErrorState } from '../../shared/ui/kibot-error-state/kibot-error-state';
import { KiBotLoadingIndicator } from '../../shared/ui/kibot-loading-indicator/kibot-loading-indicator';
import { PlanCanvas, RejillaDelPlano } from '../warehouse-map/plan-canvas/plan-canvas';
import { WarehouseMap } from '../warehouse-map/warehouse-map.models';
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
 */
@Component({
  selector: 'kibot-box-search',
  imports: [KiBotButton, KiBotErrorState, KiBotLoadingIndicator, PlanCanvas, DatePipe, PercentPipe],
  providers: [BoxSearchStore],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './box-search.html',
  styleUrl: './box-search.scss'
})
export class BoxSearch implements OnInit {
  protected readonly store = inject(BoxSearchStore);

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
    void this.store.buscar();
  }

  /** "inferior" en vez de "INFERIOR": se lee mejor en una frase. */
  protected minusculas(texto: string | null): string {
    return (texto ?? '').toLowerCase();
  }
}
