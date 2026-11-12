import { ChangeDetectionStrategy, Component, OnDestroy, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { DatePipe } from '@angular/common';

import { apiFailure } from '../../core/http/api-error';
import { KiBotErrorState } from '../../shared/ui/kibot-error-state/kibot-error-state';
import { KiBotLoadingIndicator } from '../../shared/ui/kibot-loading-indicator/kibot-loading-indicator';
import { rejillaDelMapa } from '../box-search/box-search';
import { RobotApiService } from '../robot/robot-api.service';
import { RobotPosition, textoDeEstado, tramoTexto } from '../robot/robot.models';
import { PlanCanvas, RobotEnElPlano, zonasPintadasDe } from '../warehouse-map/plan-canvas/plan-canvas';
import { WarehouseMap } from '../warehouse-map/warehouse-map.models';
import { Async } from '../warehouse-map/warehouse-map.store';

/** Cada cuánto se pregunta dónde está. El latido llega cada 2 s en marcha y cada 30 s parado. */
export const REFRESCO_POSICION_MS = 5000;

/**
 * El robot sobre el plano del inventario, ahora: su último latido llevado a nuestro plano. Sirve
 * también sin recorrido (Control › General › Ubicación).
 *
 * <p>La posición la calcula el backend: por su x/y con la transformación de su mapa al nuestro, o, si
 * no la hay, en el centro del segmento en el que dice estar (entonces sin rumbo).</p>
 */
@Component({
  selector: 'kibot-robot-position-map',
  imports: [KiBotErrorState, KiBotLoadingIndicator, PlanCanvas, DatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @switch (posicion().status) {
      @case ('loading') {
        <kibot-loading-indicator [size]="32" label="Buscando al robot" />
      }
      @case ('error') {
        @if (posicion(); as e) {
          @if (e.status === 'error') {
            <kibot-error-state [message]="e.message" [details]="e.details" (retry)="refrescar()" />
          }
        }
      }
      @case ('ready') {
        @if (posicion(); as p) {
          @if (p.status === 'ready') {
            @if (p.value; as pos) {
              <p class="pie" aria-live="polite">
                <span class="insignia" [class.insignia--ok]="pos.Signal === 'OK'" [class.insignia--aviso]="pos.Signal !== 'OK'">
                  {{ pos.Signal === 'OK' ? 'Con señal' : 'Sin señal' }}
                </span>
                {{ donde(pos) }} · {{ textoDeEstado(pos.State) }}
                <span class="dato">· último latido {{ pos.ReceivedAt | date: 'HH:mm:ss' }}</span>
                @if (pos.Method === 'address') {
                  <span class="dato">· situado en el centro de su segmento (aproximado)</span>
                }
              </p>
              @if (pos.X === null) {
                <p class="aviso">{{ pos.Reason ?? 'No se pudo situar al robot en el plano.' }}</p>
              }
            } @else {
              <p class="aviso">Este robot todavía no ha mandado ningún latido.</p>
            }
          }
        }
      }
    }

    @if (mapa(); as m) {
      @if (m.status === 'ready' && rejilla(); as rejilla) {
        <div class="plano">
          <plan-canvas
            [map]="m.value"
            [rejilla]="rejilla"
            [editable]="false"
            [zonas]="zonas()"
            [robot]="robot()"
          />
        </div>
      }
    }
  `,
  styles: `
    :host {
      display: flex;
      flex-direction: column;
      gap: var(--kibot-spacing-3);
    }

    .pie {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: var(--kibot-spacing-2);
      margin: 0;
      font-size: var(--kibot-font-size-body);
      color: var(--kibot-fg);
    }

    .dato {
      font-size: var(--kibot-font-size-subtitle);
      color: var(--kibot-fg-muted);
    }

    .aviso {
      margin: 0;
      font-size: var(--kibot-font-size-subtitle);
      color: var(--kibot-warning-text);
    }
  `
})
export class RobotPositionMap implements OnDestroy {
  private readonly api = inject(RobotApiService);

  readonly inventarioId = input.required<string>();
  readonly robotId = input.required<number>();

  protected readonly posicion = signal<Async<RobotPosition | null>>({ status: 'idle' });
  protected readonly mapa = signal<Async<WarehouseMap>>({ status: 'idle' });
  private temporizador: ReturnType<typeof setInterval> | null = null;

  protected readonly textoDeEstado = textoDeEstado;

  protected readonly rejilla = computed(() => {
    const m = this.mapa();
    return m.status === 'ready' ? rejillaDelMapa(m.value) : null;
  });

  protected readonly zonas = computed(() => {
    const m = this.mapa();
    return m.status === 'ready' ? zonasPintadasDe(m.value) : [];
  });

  protected readonly robot = computed<RobotEnElPlano | null>(() => {
    const p = this.posicion();
    if (p.status !== 'ready' || !p.value || p.value.X === null || p.value.Y === null) return null;
    return { x: p.value.X, y: p.value.Y, heading: p.value.Heading };
  });

  constructor() {
    effect(() => {
      this.inventarioId();
      this.robotId();
      untracked(() => this.empezar());
    });
  }

  /** «Pasillo 26 · tramo superior · segmento 4», «En el corredor» o «En el dock». */
  protected donde(p: RobotPosition): string {
    if (p.Zone === 'DOCK') return 'En el dock';
    if (p.Zone === 'CORRIDOR') return 'En el corredor';
    const partes = [
      p.Aisle !== null ? `Pasillo ${p.Aisle}` : null,
      p.Tramo ? `tramo ${tramoTexto(p.Tramo).toLowerCase()}` : null,
      p.Segment !== null ? `segmento ${p.Segment}` : null
    ].filter((x) => x !== null);
    return partes.length > 0 ? partes.join(' · ') : 'Sin posición';
  }

  async refrescar(): Promise<void> {
    const inv = this.inventarioId();
    const robot = this.robotId();
    if (this.posicion().status === 'idle') this.posicion.set({ status: 'loading' });
    try {
      const pos = await this.api.posicion(inv, robot);
      if (inv !== this.inventarioId() || robot !== this.robotId()) return;
      this.posicion.set({ status: 'ready', value: pos });
      if (pos) void this.cargarMapa(pos.MapId, pos.MapVersion);
    } catch (error) {
      // Un refresco fallido con algo ya en pantalla no lo borra: el siguiente lo vuelve a intentar.
      if (this.posicion().status !== 'ready') this.posicion.set({ status: 'error', ...apiFailure(error) });
    }
  }

  ngOnDestroy(): void {
    this.parar();
  }

  private empezar(): void {
    this.parar();
    this.posicion.set({ status: 'idle' });
    void this.refrescar();
    this.temporizador = setInterval(() => void this.refrescar(), REFRESCO_POSICION_MS);
  }

  private parar(): void {
    if (this.temporizador !== null) clearInterval(this.temporizador);
    this.temporizador = null;
  }

  private async cargarMapa(mapId: string, version: number): Promise<void> {
    const actual = this.mapa();
    if (actual.status === 'loading') return;
    if (actual.status === 'ready' && actual.value.MapId === mapId && actual.value.Version === version) return;
    this.mapa.set({ status: 'loading' });
    try {
      this.mapa.set({ status: 'ready', value: await this.api.mapa(mapId, version) });
    } catch (error) {
      this.mapa.set({ status: 'error', ...apiFailure(error) });
    }
  }
}
