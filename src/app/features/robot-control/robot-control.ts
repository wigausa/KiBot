import { ChangeDetectionStrategy, Component, OnInit, computed, inject } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';

import { KiBotButton } from '../../shared/ui/kibot-button/kibot-button';
import { KiBotErrorState } from '../../shared/ui/kibot-error-state/kibot-error-state';
import { KiBotLoadingIndicator } from '../../shared/ui/kibot-loading-indicator/kibot-loading-indicator';
import { avanceDe, textoDeEstadoDeZona, textoDeFinDeZona, textoDeRechazo } from '../robot/robot.models';
import { RobotControlStore } from './robot-control.store';

/**
 * Control del recorrido (B12): el encargado elige inventario, robot y zonas en orden, inicia la
 * tanda, ve cómo va y, si hace falta, la pausa, la reanuda, la cancela o manda el robot al dock.
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

  /** Tramos de la ruta hechos (o caras recorridas, sin ruta), para la barra de avance. */
  protected readonly avance = computed(() => avanceDe(this.store.progreso()));

  protected readonly textoDeRechazo = textoDeRechazo;
  protected readonly textoDeFinDeZona = textoDeFinDeZona;
  protected readonly textoDeEstadoDeZona = textoDeEstadoDeZona;

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

  // Las órdenes paran un robot en mitad de un pasillo: se confirman. No hay diálogo propio en
  // shared/ui, así que vale el nativo.

  protected pausar(): void {
    if (confirm('¿Pausar el recorrido? El robot se para donde esté; después se puede reanudar.')) {
      void this.store.pausar();
    }
  }

  protected reanudar(): void {
    if (confirm('¿Reanudar el recorrido? El robot sigue desde donde se quedó.')) {
      void this.store.reanudar();
    }
  }

  protected cancelar(): void {
    if (
      confirm(
        '¿Cancelar el recorrido? El robot se queda donde está (no vuelve al dock), se detiene la tanda y no se recorren las zonas que faltan.'
      )
    ) {
      void this.store.cancelar();
    }
  }

  protected volverAlDock(): void {
    if (confirm('¿Mandar el robot al dock? Se detiene la tanda y no se recorren las zonas que faltan.')) {
      void this.store.volverAlDock();
    }
  }
}
