import { ChangeDetectionStrategy, Component, OnInit, computed, inject } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';

import { KiBotButton } from '../../shared/ui/kibot-button/kibot-button';
import { KiBotErrorState } from '../../shared/ui/kibot-error-state/kibot-error-state';
import { KiBotLoadingIndicator } from '../../shared/ui/kibot-loading-indicator/kibot-loading-indicator';
import { RobotControlStore } from './robot-control.store';

/**
 * Control del recorrido (B12): el encargado elige inventario, robot y zonas, inicia, ve cómo va y,
 * si hace falta, lo cierra.
 *
 * <p>No decide nada: la pantalla enseña lo que dice el store, y el store lo que dice el backend.</p>
 */
@Component({
  selector: 'kibot-robot-control',
  imports: [KiBotButton, KiBotErrorState, KiBotLoadingIndicator, DatePipe, DecimalPipe],
  providers: [RobotControlStore],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './robot-control.html',
  styleUrl: './robot-control.scss'
})
export class RobotControl implements OnInit {
  protected readonly store = inject(RobotControlStore);

  /** Caras recorridas sobre el total, para la barra de avance. */
  protected readonly avance = computed(() => {
    const p = this.store.progreso();
    return p && p.TotalSides > 0 ? Math.min(100, (p.CoveredSides / p.TotalSides) * 100) : 0;
  });

  ngOnInit(): void {
    void this.store.cargar();
  }

  protected alElegirInventario(evento: Event): void {
    const valor = (evento.target as HTMLSelectElement).value;
    this.store.elegirInventario(valor === '' ? null : valor);
  }

  protected alElegirRobot(evento: Event): void {
    const valor = (evento.target as HTMLSelectElement).value;
    void this.store.elegirRobot(valor === '' ? null : Number(valor));
  }
}
