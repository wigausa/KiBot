import { ChangeDetectionStrategy, Component, OnInit, computed, inject } from '@angular/core';
import { DatePipe } from '@angular/common';
import { ActivatedRoute } from '@angular/router';

import { KiBotButton } from '../../shared/ui/kibot-button/kibot-button';
import { KiBotErrorState } from '../../shared/ui/kibot-error-state/kibot-error-state';
import { KiBotLoadingIndicator } from '../../shared/ui/kibot-loading-indicator/kibot-loading-indicator';
import { rejillaDelMapa } from '../box-search/box-search';
import { RobotSearchFound, textoDeBusqueda, textoDeFinDeZona } from '../robot/robot.models';
import { PlanCanvas } from '../warehouse-map/plan-canvas/plan-canvas';
import { RobotSearchStore } from './robot-search.store';

/**
 * Buscar con el robot: mandarlo a buscar unas cajas concretas en una zona y ver en vivo cuáles
 * encuentra. No toca el inventario.
 */
@Component({
  selector: 'kibot-robot-search',
  imports: [KiBotButton, KiBotErrorState, KiBotLoadingIndicator, PlanCanvas, DatePipe],
  providers: [RobotSearchStore],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './robot-search.html',
  styleUrl: './robot-search.scss'
})
export class RobotSearchPage implements OnInit {
  protected readonly store = inject(RobotSearchStore);
  private readonly ruta = inject(ActivatedRoute);

  protected readonly rejilla = computed(() => {
    const m = this.store.mapa();
    return m.status === 'ready' ? rejillaDelMapa(m.value) : null;
  });

  protected readonly textoDeEstado = textoDeBusqueda;

  async ngOnInit(): Promise<void> {
    await this.store.cargar();
    const q = this.ruta.snapshot.queryParamMap;
    this.store.prellenar(q.get('inv'), q.get('code'));
  }

  protected alElegirInventario(evento: Event): void {
    const valor = (evento.target as HTMLSelectElement).value;
    this.store.elegirInventario(valor === '' ? null : valor);
  }

  protected alElegirRobot(evento: Event): void {
    const valor = (evento.target as HTMLSelectElement).value;
    this.store.robotId.set(valor === '' ? null : Number(valor));
  }

  protected alElegirZona(evento: Event): void {
    const valor = (evento.target as HTMLSelectElement).value;
    this.store.zonaId.set(valor === '' ? null : Number(valor));
  }

  protected alEscribir(evento: Event): void {
    this.store.texto.set((evento.target as HTMLTextAreaElement).value);
  }

  protected alBuscar(evento: Event): void {
    evento.preventDefault();
    void this.store.buscar();
  }

  protected confirmar(pregunta: string, accion: () => Promise<void>): void {
    if (window.confirm(pregunta)) void accion();
  }

  /** «Pasillo 28 · lado B · inferior · segmento 6». */
  protected donde(f: RobotSearchFound): string {
    const partes = [
      f.AisleNumber !== null ? `Pasillo ${f.AisleNumber}` : null,
      f.Side ? `lado ${f.Side}` : null,
      f.Tramo ? f.Tramo.toLowerCase() : null,
      f.Segment !== null ? `segmento ${f.Segment}` : null
    ];
    return partes.filter((p) => p !== null).join(' · ') || 'Vista, sin poder situarla';
  }

  protected fin(motivo: string | null): string {
    return motivo ? textoDeFinDeZona(motivo) : '';
  }
}
