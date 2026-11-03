import { ChangeDetectionStrategy, Component, OnInit, computed, inject } from '@angular/core';
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
