import { ChangeDetectionStrategy, Component, OnInit, computed, effect, inject, input, untracked } from '@angular/core';
import { DatePipe } from '@angular/common';
import { ActivatedRoute } from '@angular/router';

import { KiBotButton } from '../../shared/ui/kibot-button/kibot-button';
import { KiBotConfirm } from '../../shared/ui/kibot-confirm/kibot-confirm';
import { KiBotErrorState } from '../../shared/ui/kibot-error-state/kibot-error-state';
import { KiBotLoadingIndicator } from '../../shared/ui/kibot-loading-indicator/kibot-loading-indicator';
import { rejillaDelMapa } from '../box-search/box-search';
import { RobotSearchFound, textoDeBusqueda, textoDeFinDeZona } from '../robot/robot.models';
import { PlanCanvas } from '../warehouse-map/plan-canvas/plan-canvas';
import { RobotSearchStore } from './robot-search.store';

/**
 * Buscar con el robot: mandarlo a buscar unas cajas concretas en una zona y ver en vivo cuáles
 * encuentra. No toca el inventario.
 *
 * <p>Desde noviembre de 2026 es la pestaña «Con el robot» de Buscar: con `embebido`, el inventario y
 * el robot llegan por `input` (los elegidos arriba). La zona y las cajas se eligen aquí.</p>
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
  private readonly confirmador = inject(KiBotConfirm);

  readonly inventarioId = input<string | null>(null);
  readonly robotId = input<number | null>(null);
  /** Embebido: la zona elegida arriba (el robot busca en una sola zona). */
  readonly zonaId = input<number | null>(null);
  readonly embebido = input(false);

  constructor() {
    effect(() => {
      const inv = this.inventarioId();
      const robot = this.robotId();
      const listo = this.store.inventarios().status === 'ready';
      if (!this.embebido() || !listo) return;
      untracked(() => {
        if (this.store.enMarcha()) return; // con una búsqueda andando no se cambia de inventario
        const abierto = this.store.abiertos().some((i) => i._id === inv) ? inv : null;
        if (abierto !== this.store.inventarioId()) this.store.elegirInventario(abierto);
        if (robot !== null && this.store.robots().some((r) => r.IdDevice === robot)) this.store.robotId.set(robot);
      });
    });

    effect(() => {
      const zona = this.zonaId();
      const listo = this.store.inventarios().status === 'ready';
      const inv = this.store.inventarioId();
      if (!this.embebido() || !listo || inv === null) return;
      untracked(() => {
        if (this.store.enMarcha()) return;
        const valida = this.store.zonas().some((z) => z.IdZone === zona) ? zona : null;
        if (valida !== this.store.zonaId()) this.store.zonaId.set(valida);
      });
    });
  }

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

  protected async confirmar(pregunta: string, accion: () => Promise<void>, aceptar = 'Sí', peligro = false): Promise<void> {
    if (await this.confirmador.preguntar({ titulo: pregunta, mensaje: '', aceptar, peligro })) await accion();
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
