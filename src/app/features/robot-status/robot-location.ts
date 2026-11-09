import { ChangeDetectionStrategy, Component, OnInit, computed, inject, input } from '@angular/core';
import { DatePipe } from '@angular/common';

import { KiBotErrorState } from '../../shared/ui/kibot-error-state/kibot-error-state';
import { KiBotLoadingIndicator } from '../../shared/ui/kibot-loading-indicator/kibot-loading-indicator';
import { haceCuanto, textoDeEstado, ubicacionDe } from '../robot/robot.models';
import { RobotStatusStore } from './robot-status.store';

/**
 * Ubicación en tiempo real: dónde está cada robot según su último latido. Desde noviembre de 2026
 * vive dentro de Control (pestaña «Ubicación»), con `robotId` y `embebido`: solo ese robot y sin
 * cabecera propia.
 *
 * <p>Por <b>dirección</b> (pasillo, tramo, segmento), no por <c>x</c>/<c>y</c>: esas son del mapa
 * del robot (Reeman) y no cuadran con nuestro plano. Fuera de un pasillo, el corredor o el dock.</p>
 */
@Component({
  selector: 'kibot-robot-location',
  imports: [KiBotErrorState, KiBotLoadingIndicator, DatePipe],
  providers: [RobotStatusStore],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './robot-location.html',
  styleUrl: './robot-status.scss'
})
export class RobotLocation implements OnInit {
  protected readonly store = inject(RobotStatusStore);

  /** Solo este robot (el elegido en Control). Sin él, todos los de tus inventarios. */
  readonly robotId = input<number | null>(null);
  /** Dentro de otra pantalla: sin título propio. */
  readonly embebido = input(false);

  protected readonly filas = computed(() => {
    const solo = this.robotId();
    const filas = this.store.filas();
    return solo === null ? filas : filas.filter((f) => f.IdDevice === solo);
  });

  protected readonly ubicacionDe = ubicacionDe;
  protected readonly textoDeEstado = textoDeEstado;
  protected readonly haceCuanto = haceCuanto;

  ngOnInit(): void {
    void this.store.cargar();
  }
}
