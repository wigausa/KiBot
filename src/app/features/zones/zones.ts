import { ChangeDetectionStrategy, Component, OnInit, computed, effect, inject, input, untracked } from '@angular/core';

import { CompanyPicker } from '../../core/company/company-picker';
import { CompanyStore } from '../../core/company/company.store';
import { KiBotButton } from '../../shared/ui/kibot-button/kibot-button';
import { KiBotErrorState } from '../../shared/ui/kibot-error-state/kibot-error-state';
import { KiBotLoadingIndicator } from '../../shared/ui/kibot-loading-indicator/kibot-loading-indicator';
import { KiBotSelect, KiBotSelectOpcion } from '../../shared/ui/kibot-select/kibot-select';
import { rejillaDelMapa } from '../box-search/box-search';
import { GeocercaElegida, PlanCanvas } from '../warehouse-map/plan-canvas/plan-canvas';
import { GEOCERCA_INVALIDA } from './geofence';
import { PestanaDeZonas, ZonesStore } from './zones.store';

/**
 * Zonas: las de la compañía —manuales o de la API del cliente, como en Witag— y sus geocercas en el
 * plano, por dos anclas de pasillo.
 *
 * <p>Desde noviembre de 2026 vive dentro de «Planos y zonas»: con `embebido`, la pestaña llega por
 * `pestana` y el título, el selector de compañía y las pestañas propias los pone el contenedor.</p>
 *
 * <p>Existe porque el cliente del robot no usa Witag: sin esto no tendría zonas ni dónde situarlas,
 * y sin zonas con geocerca no se puede crear un inventario del robot.</p>
 */
@Component({
  selector: 'kibot-zones',
  imports: [CompanyPicker, KiBotButton, KiBotErrorState, KiBotLoadingIndicator, KiBotSelect, PlanCanvas],
  providers: [ZonesStore],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './zones.html',
  styleUrl: './zones.scss'
})
export class Zones implements OnInit {
  protected readonly store = inject(ZonesStore);
  private readonly companias = inject(CompanyStore);

  protected readonly geocercaInvalida = GEOCERCA_INVALIDA;

  readonly embebido = input(false);
  readonly pestana = input<PestanaDeZonas | null>(null);

  protected readonly pestanas: readonly { id: PestanaDeZonas; nombre: string }[] = [
    { id: 'manuales', nombre: 'Zonas manuales' },
    { id: 'externa', nombre: 'API del cliente' },
    { id: 'geocercas', nombre: 'Geocercas' }
  ];

  protected readonly opcionesDePlano = computed<KiBotSelectOpcion[]>(() => {
    const l = this.store.planos();
    return l.status === 'ready' ? l.value.map((p) => ({ id: p.MapId, nombre: p.Name, detalle: `v${p.Version}` })) : [];
  });

  protected readonly opcionesDeZona = computed<KiBotSelectOpcion[]>(() => {
    const z = this.store.zonas();
    if (z.status !== 'ready') return [];
    // Las que ya están en el plano lo dicen: elegir una es mover su geocerca, no crear otra.
    const situadas = new Set(this.store.zonasPintadas().map((p) => p.idZone));
    return z.value.map((zona) => ({
      id: zona.ID,
      nombre: zona.NAME,
      detalle: this.store.enUso().has(zona.ID) && situadas.has(zona.ID)
        ? 'en uso · fija'
        : situadas.has(zona.ID)
          ? 'en el plano'
          : null
    }));
  });

  protected readonly rejilla = computed(() => {
    const m = this.store.mapa();
    return m.status === 'ready' ? rejillaDelMapa(m.value) : null;
  });

  /** Con API externa configurada, las zonas son las del cliente y las manuales no se usan. */
  protected readonly usaExterna = computed(() => {
    const e = this.store.externa();
    return e.status === 'ready' && e.value !== null;
  });

  constructor() {
    // Cambiar de compañía —aquí o en otra pantalla— recarga todo lo de esta.
    effect(() => {
      this.companias.companiaId();
      untracked(() => void this.store.cargar());
    });

    // Embebido, la pestaña la elige el contenedor.
    effect(() => {
      const p = this.pestana();
      if (p !== null) untracked(() => this.store.pestana.set(p));
    });
  }

  ngOnInit(): void {
    void this.companias.cargar();
  }

  protected valor(evento: Event): string {
    return (evento.target as HTMLInputElement | HTMLSelectElement).value;
  }

  protected alElegirPlano(evento: Event): void {
    const v = this.valor(evento);
    void this.store.elegirPlano(v === '' ? null : v);
  }

  protected alElegirZona(evento: Event): void {
    const v = this.valor(evento);
    this.store.elegirZona(v === '' ? null : Number(v));
  }

  /** Las anclas que se van eligiendo en el plano: en vivo mientras se arrastra de una a otra. */
  protected alCambiarGeocerca(geocerca: GeocercaElegida): void {
    this.store.desde.set(geocerca.desde);
    this.store.hasta.set(geocerca.hasta);
  }

  protected borrarAnclas(): void {
    this.store.desde.set(null);
    this.store.hasta.set(null);
  }
}
