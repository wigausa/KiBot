import { ChangeDetectionStrategy, Component, OnInit, computed, effect, inject, input, untracked } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';

import { KiBotButton } from '../../shared/ui/kibot-button/kibot-button';
import { KiBotErrorState } from '../../shared/ui/kibot-error-state/kibot-error-state';
import { KiBotLoadingIndicator } from '../../shared/ui/kibot-loading-indicator/kibot-loading-indicator';
import { rejillaDelMapa } from '../box-search/box-search';
import { textoDeEstado } from '../robot/robot.models';
import { PlanCanvas } from '../warehouse-map/plan-canvas/plan-canvas';
import { RobotTrackStore, VELOCIDADES, Velocidad } from './robot-track.store';

/**
 * Recorrido: por dónde va el robot sobre el plano, en vivo, y su repetición cuando termina. Como la
 * repetición del ingeniero, pero sobre NUESTRO plano y con lo que llega a la nube (los latidos).
 *
 * <p>Desde noviembre de 2026 vive dentro de Control (pestaña «Recorrido en el plano»): con
 * `embebido`, el inventario y el robot llegan por `input` y no hay selector ni título propios.</p>
 */
@Component({
  selector: 'kibot-robot-track',
  imports: [KiBotButton, KiBotErrorState, KiBotLoadingIndicator, PlanCanvas, DatePipe, DecimalPipe],
  providers: [RobotTrackStore],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './robot-track.html',
  styleUrl: './robot-track.scss'
})
export class RobotTrack implements OnInit {
  protected readonly store = inject(RobotTrackStore);
  protected readonly velocidades = VELOCIDADES;

  /** Embebido: lo elegido en Control. */
  readonly inventarioId = input<string | null>(null);
  readonly robotId = input<number | null>(null);
  /** Un recorrido concreto (el último de la zona elegida). Sin él, el abierto o el último del robot. */
  readonly runId = input<string | null>(null);
  readonly embebido = input(false);

  constructor() {
    // Embebido, lo que llega de fuera manda: al cambiar, se carga ese recorrido.
    effect(() => {
      const inv = this.inventarioId();
      const robot = this.robotId();
      const run = this.runId();
      const listo = this.store.inventarios().status === 'ready';
      if (!this.embebido() || !listo) return;
      untracked(() => void this.seguir(inv, robot, run));
    });
  }

  protected readonly rejilla = computed(() => {
    const m = this.store.mapa();
    return m.status === 'ready' ? rejillaDelMapa(m.value) : null;
  });

  /** Dónde está, en palabras: la dirección dentro de un tramo, o «transversal / corredor» fuera. */
  protected readonly donde = computed(() => {
    const p = this.store.actual();
    if (!p) return null;
    if (p.Aisle !== null && p.Tramo) return `Pasillo ${p.Aisle} · ${p.Tramo.toLowerCase()} · segmento ${p.Segment ?? '—'}`;
    if (p.Zone === 'DOCK') return 'En el dock';
    return 'Transversal o corredor';
  });

  ngOnInit(): void {
    void this.store.cargar();
  }

  private async seguir(inv: string | null, robot: number | null, run: string | null): Promise<void> {
    if (inv !== this.store.inventarioId() || robot !== this.store.robotId()) {
      // El recorrido pedido se fija ANTES de elegir: así la primera carga ya es la de la zona.
      this.store.runId.set(run);
      if (inv !== this.store.inventarioId()) await this.store.elegirInventario(inv);
      if (robot !== this.store.robotId()) await this.store.elegirRobot(robot);
    } else {
      await this.store.elegirRecorrido(run);
    }
  }

  protected alElegirInventario(evento: Event): void {
    const valor = (evento.target as HTMLSelectElement).value;
    void this.store.elegirInventario(valor === '' ? null : valor);
  }

  protected alElegirRobot(evento: Event): void {
    const valor = (evento.target as HTMLSelectElement).value;
    void this.store.elegirRobot(valor === '' ? null : Number(valor));
  }

  protected alMoverBarra(evento: Event): void {
    this.store.pausar();
    this.store.irA(Number((evento.target as HTMLInputElement).value));
  }

  protected alElegirVelocidad(evento: Event): void {
    this.store.velocidad.set(Number((evento.target as HTMLSelectElement).value) as Velocidad);
  }

  protected estado(codigo: string | null): string {
    return codigo ? textoDeEstado(codigo) : '—';
  }
}
