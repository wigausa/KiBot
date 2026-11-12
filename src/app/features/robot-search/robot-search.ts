import { ChangeDetectionStrategy, Component, OnInit, computed, effect, inject, untracked } from '@angular/core';
import { DatePipe } from '@angular/common';
import { ActivatedRoute } from '@angular/router';

import { CompanyPicker } from '../../core/company/company-picker';
import { CompanyStore } from '../../core/company/company.store';
import { KiBotButton } from '../../shared/ui/kibot-button/kibot-button';
import { KiBotConfirm } from '../../shared/ui/kibot-confirm/kibot-confirm';
import { KiBotErrorState } from '../../shared/ui/kibot-error-state/kibot-error-state';
import { KiBotIcon } from '../../shared/ui/kibot-icon/kibot-icon';
import { KiBotLoadingIndicator } from '../../shared/ui/kibot-loading-indicator/kibot-loading-indicator';
import { KiBotSelect, KiBotSelectOpcion } from '../../shared/ui/kibot-select/kibot-select';
import { rejillaDelMapa } from '../box-search/box-search';
import { textoDeFinDeZona } from '../robot/robot.models';
import { PlanCanvas } from '../warehouse-map/plan-canvas/plan-canvas';
import { RobotSearchStore } from './robot-search.store';

/**
 * Buscar con el robot: mandarlo a buscar unas cajas concretas en una zona de un plano y ver en vivo
 * cuáles encuentra. <b>No pertenece a ningún inventario</b> ni toca ninguno.
 *
 * <p>Plano → zona → robot → códigos. Mientras busca: el avance del recorrido de la zona y de las
 * cajas, y el robot en el plano. Al terminar: el plano con una marca numerada por caja y la tabla.</p>
 */
@Component({
  selector: 'kibot-robot-search',
  imports: [CompanyPicker, KiBotButton, KiBotErrorState, KiBotIcon, KiBotLoadingIndicator, KiBotSelect, PlanCanvas, DatePipe],
  providers: [RobotSearchStore],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './robot-search.html',
  styleUrl: './robot-search.scss'
})
export class RobotSearchPage implements OnInit {
  protected readonly store = inject(RobotSearchStore);
  private readonly ruta = inject(ActivatedRoute);
  private readonly confirmador = inject(KiBotConfirm);
  private readonly compania = inject(CompanyStore);
  private iniciado = false;

  constructor() {
    // Los planos son de la compañía elegida, que puede llegar o cambiar con la pantalla abierta.
    effect(() => {
      this.compania.companiaId();
      untracked(() => {
        if (this.iniciado) void this.store.alCambiarDeCompania();
      });
    });
  }

  protected readonly rejilla = computed(() => {
    const m = this.store.mapa();
    return m.status === 'ready' ? rejillaDelMapa(m.value) : null;
  });

  protected readonly opcionesDePlano = computed<KiBotSelectOpcion[]>(() => {
    const p = this.store.planos();
    return p.status === 'ready' ? p.value.map((m) => ({ id: m.MapId, nombre: m.Name, detalle: `v${m.Version}` })) : [];
  });

  protected readonly opcionesDeZona = computed<KiBotSelectOpcion[]>(() =>
    this.store.zonas().map((z) => ({ id: z.IdZone, nombre: z.Name }))
  );

  protected readonly opcionesDeRobot = computed<KiBotSelectOpcion[]>(() =>
    this.store.robots().map((r) => ({ id: r.id, nombre: r.nombre }))
  );

  async ngOnInit(): Promise<void> {
    await this.store.cargar();
    this.iniciado = true;
    const q = this.ruta.snapshot.queryParamMap;
    const zona = Number(q.get('zone'));
    this.store.prellenar(q.get('map'), Number.isFinite(zona) && zona > 0 ? zona : null, q.get('code'));
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

  protected elegirFila(numero: number | null): void {
    if (numero === null) return;
    this.store.elegida.set(this.store.elegida() === numero ? null : numero);
  }

  protected alPulsarMarca(etiqueta: string): void {
    const n = Number(etiqueta);
    this.store.elegida.set(Number.isFinite(n) ? n : null);
    document.getElementById(`fila-${etiqueta}`)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }

  protected descargarCsv(): void {
    const b = this.store.busqueda();
    const blob = new Blob(['﻿' + this.store.csv()], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `busqueda-${(b?.ZoneName ?? 'robot').replace(/\s+/g, '-').toLowerCase()}-${(b?.StartedAt ?? '').slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  protected fin(motivo: string | null): string {
    return motivo ? textoDeFinDeZona(motivo) : '';
  }
}
