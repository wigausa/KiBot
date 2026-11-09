import { ChangeDetectionStrategy, Component, OnInit, computed, effect, inject, signal, untracked } from '@angular/core';
import { DatePipe } from '@angular/common';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { map } from 'rxjs';

import { CompanyPicker } from '../../core/company/company-picker';
import { CompanyStore } from '../../core/company/company.store';
import { apiFailure } from '../../core/http/api-error';
import { KiBotButton } from '../../shared/ui/kibot-button/kibot-button';
import { KiBotErrorState } from '../../shared/ui/kibot-error-state/kibot-error-state';
import { KiBotLoadingIndicator } from '../../shared/ui/kibot-loading-indicator/kibot-loading-indicator';
import { KiBotModal } from '../../shared/ui/kibot-modal/kibot-modal';
import { KiBotTab, KiBotTabs } from '../../shared/ui/kibot-tabs/kibot-tabs';
import { rejillaDelMapa } from '../box-search/box-search';
import { RobotApiService } from '../robot/robot-api.service';
import { CaraResaltada, PlanCanvas, ZonaPintada, zonasPintadasDe } from '../warehouse-map/plan-canvas/plan-canvas';
import { WarehouseMap as Plano } from '../warehouse-map/warehouse-map.models';
import { Async } from '../warehouse-map/warehouse-map.store';
import { WarehouseMap } from '../warehouse-map/warehouse-map';
import { Zones } from '../zones/zones';
import { ZonesApiService } from '../zones/zones-api.service';
import { MapSummary } from '../zones/zones.models';
import { PestanaDeZonas } from '../zones/zones.store';

type PestanaDePlanos = 'planos' | 'zonas' | 'cliente' | 'geocercas';

const PESTANAS: readonly KiBotTab[] = [
  { id: 'planos', label: 'Planos' },
  { id: 'zonas', label: 'Zonas' },
  { id: 'geocercas', label: 'Geocercas' },
  { id: 'cliente', label: 'API del cliente' }
];

/** De la pestaña de aquí a la de la pantalla de Zonas. */
const PESTANA_DE_ZONAS: Record<Exclude<PestanaDePlanos, 'planos'>, PestanaDeZonas> = {
  zonas: 'manuales',
  cliente: 'externa',
  geocercas: 'geocercas'
};

/**
 * Planos y zonas: todo lo que se prepara ANTES de crear un inventario, en un solo módulo.
 *
 * <ol>
 *   <li><b>Planos</b>: los planos de la compañía y el editor para dibujar uno nuevo.</li>
 *   <li><b>Zonas</b>: las zonas manuales de la compañía.</li>
 *   <li><b>Geocercas</b>: dónde está cada zona en el plano (dos anclas de pasillo). Sin geocerca, una
 *       zona no entra en un inventario del robot.</li>
 *   <li><b>API del cliente</b>: si el cliente da sus zonas por API, en vez de las manuales.</li>
 * </ol>
 *
 * <p>La compañía se elige una vez, arriba. La pestaña va en `?tab=`; las rutas viejas `/zonas` y
 * `/mapa` llegan aquí.</p>
 */
@Component({
  selector: 'kibot-maps-zones',
  imports: [
    CompanyPicker,
    KiBotButton,
    KiBotErrorState,
    KiBotLoadingIndicator,
    KiBotModal,
    KiBotTabs,
    PlanCanvas,
    WarehouseMap,
    Zones,
    DatePipe
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './maps-zones.html',
  styleUrl: './maps-zones.scss'
})
export class MapsZones implements OnInit {
  protected readonly companias = inject(CompanyStore);
  private readonly zonasApi = inject(ZonesApiService);
  private readonly robotApi = inject(RobotApiService);
  private readonly router = inject(Router);
  private readonly ruta = inject(ActivatedRoute);

  protected readonly pestanas = PESTANAS;
  protected readonly tab = toSignal(
    this.ruta.queryParamMap.pipe(map((p) => pestanaDe(p.get('tab')))),
    { initialValue: pestanaDe(this.ruta.snapshot.queryParamMap.get('tab')) }
  );

  protected readonly pestanaDeZonas = computed<PestanaDeZonas | null>(() => {
    const t = this.tab();
    return t === 'planos' ? null : PESTANA_DE_ZONAS[t];
  });

  protected readonly planos = signal<Async<MapSummary[]>>({ status: 'idle' });
  /** Con planos ya hechos el editor queda plegado: lo habitual es mirar, no dibujar. */
  protected readonly dibujando = signal(false);

  // --- La ventana con un plano ---------------------------------------------------------------
  protected readonly planoAbierto = signal<MapSummary | null>(null);
  protected readonly planoCargado = signal<Async<Plano>>({ status: 'idle' });
  /** La zona cuyas estanterías se resaltan en el plano. */
  protected readonly zonaResaltada = signal<number | null>(null);

  protected readonly rejilla = computed(() => {
    const p = this.planoCargado();
    return p.status === 'ready' ? rejillaDelMapa(p.value) : null;
  });

  /** Las zonas con geocerca, cada una con su color (el mismo que en Geocercas). */
  protected readonly zonasPintadas = computed<ZonaPintada[]>(() => {
    const p = this.planoCargado();
    return p.status === 'ready' ? zonasPintadasDe(p.value) : [];
  });

  /** Las caras de las estanterías cuyo centro cae dentro de la geocerca de la zona elegida. */
  protected readonly caras = computed<readonly CaraResaltada[]>(() => {
    const p = this.planoCargado();
    const id = this.zonaResaltada();
    if (p.status !== 'ready' || id === null) return [];
    const zona = (p.value.Zones ?? []).find((z) => z.IdZone === id);
    if (!zona || zona.Points.length < 2) return [];
    const xs = zona.Points.map((q) => q.X);
    const ys = zona.Points.map((q) => q.Y);
    const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
    return p.value.ShelvingUnits
      .filter((r) => r.CenterX >= x0 && r.CenterX <= x1 && r.CenterY >= y0 && r.CenterY <= y1)
      .flatMap((r) => r.Faces.map((f) => ({ rackId: r.RackId, side: f.Side })));
  });

  protected async abrirPlano(plano: MapSummary): Promise<void> {
    this.planoAbierto.set(plano);
    this.zonaResaltada.set(null);
    this.planoCargado.set({ status: 'loading' });
    try {
      const mapa = await this.robotApi.mapa(plano.MapId, plano.Version);
      if (this.planoAbierto()?.MapId === plano.MapId) this.planoCargado.set({ status: 'ready', value: mapa });
    } catch (error) {
      this.planoCargado.set({ status: 'error', ...apiFailure(error) });
    }
  }

  protected cerrarPlano(): void {
    this.planoAbierto.set(null);
    this.planoCargado.set({ status: 'idle' });
  }

  protected alternarZona(id: number): void {
    this.zonaResaltada.update((actual) => (actual === id ? null : id));
  }

  constructor() {
    effect(() => {
      const id = this.companias.companiaId();
      untracked(() => void this.cargarPlanos(id));
    });
  }

  ngOnInit(): void {
    void this.companias.cargar();
  }

  protected irA(tab: string): void {
    void this.router.navigate([], {
      relativeTo: this.ruta,
      queryParams: { tab: tab === 'planos' ? null : tab },
      queryParamsHandling: 'merge',
      replaceUrl: true
    });
  }

  protected async cargarPlanos(companyId: number | null = this.companias.companiaId()): Promise<void> {
    if (companyId === null) {
      this.planos.set({ status: 'idle' });
      return;
    }
    this.planos.set({ status: 'loading' });
    try {
      const lista = await this.zonasApi.planosDeCompania(companyId);
      if (companyId !== this.companias.companiaId()) return;
      this.planos.set({ status: 'ready', value: lista });
      this.dibujando.set(lista.length === 0);
    } catch (error) {
      this.planos.set({ status: 'error', ...apiFailure(error) });
    }
  }
}

function pestanaDe(valor: string | null): PestanaDePlanos {
  return valor === 'zonas' || valor === 'cliente' || valor === 'geocercas' ? valor : 'planos';
}
