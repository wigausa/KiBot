import {
  ChangeDetectionStrategy,
  Component,
  OnDestroy,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  untracked
} from '@angular/core';
import { DatePipe, DecimalPipe, PercentPipe } from '@angular/common';

import { apiFailure } from '../../core/http/api-error';
import { KiBotButton } from '../../shared/ui/kibot-button/kibot-button';
import { KiBotErrorState } from '../../shared/ui/kibot-error-state/kibot-error-state';
import { KiBotLoadingIndicator } from '../../shared/ui/kibot-loading-indicator/kibot-loading-indicator';
import { RobotApiService } from '../robot/robot-api.service';
import {
  RobotBatchView,
  RobotOccupancy,
  RobotProgress,
  avanceDe,
  textoDeEstadoDeZona,
  textoDeFinDeZona
} from '../robot/robot.models';
import { Async } from '../warehouse-map/warehouse-map.store';
import { Inventory } from './inventories.models';

/** Cada cuánto se refresca el detalle de un inventario abierto mientras se mira. */
export const REFRESCO_DETALLE_MS = 5000;

interface Datos {
  progreso: RobotProgress;
  ocupacion: RobotOccupancy | null;
  tanda: RobotBatchView | null;
}

/**
 * Lo importante del recorrido de un inventario, para el panel de Inventarios: si está abierto, lo que
 * va hasta ahora (y se refresca); si está cerrado, lo que se obtuvo.
 *
 * <ul>
 *   <li><b>Avance</b>: lecturas, tramos y caras (`progress`).</li>
 *   <li><b>Por zona</b>: cajas y caras recorridas de cada zona (`occupancy`, por la zona de cada cara).</li>
 *   <li><b>Resultado</b>: lo calculado del último recorrido (`occupancy.Run`).</li>
 *   <li><b>Última tanda</b>: sus zonas y cómo terminó cada una (`batch`).</li>
 * </ul>
 */
@Component({
  selector: 'kibot-inventory-detail',
  imports: [KiBotButton, KiBotErrorState, KiBotLoadingIndicator, DatePipe, DecimalPipe, PercentPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (inventario(); as inv) {
      <div class="cabecera">
        <span class="insignia" [class.insignia--activa]="!inv.EndDate && !enMarcha()" [class.insignia--info]="enMarcha()">
          {{ inv.EndDate ? 'Cerrado' : enMarcha() ? 'Recorriendo ahora' : 'Abierto' }}
        </span>
        <dl class="ficha">
          <div><dt>Robot</dt><dd>{{ robots() }}</dd></div>
          <div><dt>Plano</dt><dd>Versión {{ inv.MapVersion ?? '—' }}</dd></div>
          <div><dt>Desde</dt><dd>{{ inv.StartDate | date: 'short' }}</dd></div>
          <div><dt>{{ inv.EndDate ? 'Hasta' : 'Estado' }}</dt><dd>{{ inv.EndDate ? (inv.EndDate | date: 'short') : 'En curso' }}</dd></div>
        </dl>
      </div>

      @switch (datos().status) {
        @case ('loading') {
          <kibot-loading-indicator [size]="40" label="Cargando el recorrido" />
        }
        @case ('error') {
          @if (datos(); as e) {
            @if (e.status === 'error') {
              <kibot-error-state [message]="e.message" [details]="e.details" (retry)="cargar()" />
            }
          }
        }
        @case ('ready') {
          @if (datos(); as d) {
            @if (d.status === 'ready') {
              <!-- Avance -->
              <section class="bloque">
                <h3>{{ inv.EndDate ? 'Lo que se recorrió' : 'Avance hasta ahora' }}</h3>
                <div class="avance">
                  <span class="avance__pct">{{ avance() | number: '1.0-0' }} %</span>
                  <div class="barra barra--grande" role="progressbar" aria-valuemin="0" aria-valuemax="100"
                       [attr.aria-valuenow]="avance() | number: '1.0-0'" aria-label="Avance del recorrido">
                    <div class="barra__relleno" [style.width.%]="avance()"></div>
                  </div>
                </div>
                <dl class="cifras">
                  <div><dt>Lecturas</dt><dd>{{ d.value.progreso.Readings | number }}</dd></div>
                  <div><dt>Última lectura</dt><dd>{{ d.value.progreso.LastReadAt ? (d.value.progreso.LastReadAt | date: 'short') : '—' }}</dd></div>
                  <div><dt>Tramos</dt><dd>{{ d.value.progreso.TramosTotal ? (d.value.progreso.TramosDone ?? 0) + ' de ' + d.value.progreso.TramosTotal : '—' }}</dd></div>
                  <div><dt>Caras recorridas</dt><dd>{{ d.value.progreso.CoveredSides }} de {{ d.value.progreso.TotalSides }}</dd></div>
                </dl>
              </section>

              <!-- Resultado -->
              <section class="bloque">
                <h3>Resultado</h3>
                @if (d.value.ocupacion?.Run; as run) {
                  <dl class="cifras">
                    <div><dt>Cajas ubicadas</dt><dd>{{ cajasUbicadas() | number }}</dd></div>
                    <div><dt>Cajas leídas (último cálculo)</dt><dd>{{ run.Epcs | number }}</dd></div>
                    <div><dt>Con zona</dt><dd>{{ run.EpcsWithZone | number }}</dd></div>
                    <div><dt>Ambiguas</dt><dd>{{ run.Ambiguous | number }}</dd></div>
                    <div><dt>Caras sobre capacidad</dt><dd>{{ run.OverCapacitySides | number }}</dd></div>
                  </dl>
                  <p class="dato">
                    {{ run.Complete ? 'Recorrido completo' : 'Recorrido parcial' }} ·
                    {{ run.CoveredSides }} de {{ run.TotalSides }} caras ·
                    calculado {{ run.ConsolidatedAt ? (run.ConsolidatedAt | date: 'short') : '—' }}
                  </p>
                } @else {
                  <p class="aviso">
                    {{ inv.EndDate ? 'Este inventario no llegó a tener un recorrido calculado.' : 'Todavía no hay resultado: se calcula cuando el robot termina un recorrido.' }}
                  </p>
                }
              </section>

              <!-- Por zona -->
              @if (porZona().length > 0) {
                <section class="bloque">
                  <h3>Por zona</h3>
                  <table class="tabla">
                    <thead>
                      <tr><th>Zona</th><th>Cajas</th><th>Caras recorridas</th><th>Ocupación</th><th>Avisos</th></tr>
                    </thead>
                    <tbody>
                      @for (z of porZona(); track z.id) {
                        <tr>
                          <td>{{ z.nombre }}</td>
                          <td>{{ z.cajas | number }}</td>
                          <td>{{ z.recorridas }} de {{ z.caras }}</td>
                          <td>{{ z.ocupacion === null ? '—' : (z.ocupacion | percent: '1.0-0') }}</td>
                          <td>{{ z.anomalias > 0 ? z.anomalias + ' caras raras' : '—' }}</td>
                        </tr>
                      }
                    </tbody>
                  </table>
                </section>
              }

              <!-- Última tanda -->
              @if (d.value.tanda; as t) {
                <section class="bloque">
                  <h3>Última tanda <span class="dato">· {{ t.StartedAt | date: 'short' }}</span></h3>
                  <ol class="tanda">
                    @for (z of t.Zones; track z.IdZone; let i = $index) {
                      <li [class.tanda--actual]="t.Status === 'Running' && i === t.Current">
                        <span>{{ z.Name }}</span>
                        <span class="dato">
                          {{ textoDeEstadoDeZona(z.State) }}{{ z.EndReason && z.EndReason !== 'COMPLETED' ? ' · ' + textoDeFinDeZona(z.EndReason) : '' }}
                        </span>
                      </li>
                    }
                  </ol>
                  @if (t.Status === 'Stopped') {
                    <p class="aviso aviso--error">Se detuvo: {{ textoDeFinDeZona(t.StopReason) }}.</p>
                  }
                </section>
              }
            }
          }
        }
      }

      <div class="acciones">
        <kibot-button size="small" (pressed)="verEnControl.emit(inv)">Ver en Control</kibot-button>
        <kibot-button size="small" variant="outline" tone="secondary" (pressed)="buscar.emit(inv)">Buscar cajas</kibot-button>
        @if (!inv.EndDate) {
          <kibot-button size="small" variant="outline" (pressed)="editar.emit(inv)">Editar</kibot-button>
          <kibot-button size="small" variant="outline" tone="error" (pressed)="cerrar.emit(inv)">Cerrar inventario</kibot-button>
        }
      </div>
    }
  `,
  styles: `
    :host {
      display: flex;
      flex-direction: column;
      gap: var(--kibot-spacing-5);
    }

    .cabecera {
      display: flex;
      flex-direction: column;
      gap: var(--kibot-spacing-3);
    }

    .insignia {
      align-self: flex-start;
    }

    .ficha {
      margin: 0;
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(9rem, 1fr));
      gap: var(--kibot-spacing-3);

      dt {
        font-size: var(--kibot-font-size-subtitle);
        color: var(--kibot-fg-muted);
      }

      dd {
        margin: 0;
        font-weight: var(--kibot-font-weight-bold);
      }
    }

    .bloque {
      display: flex;
      flex-direction: column;
      gap: var(--kibot-spacing-3);
      padding-top: var(--kibot-spacing-4);
      border-top: var(--kibot-stroke-0) solid var(--kibot-line);

      h3 {
        margin: 0;
        font-size: var(--kibot-font-size-caption);
        font-weight: var(--kibot-font-weight-bold);
      }
    }

    .avance {
      display: flex;
      align-items: center;
      gap: var(--kibot-spacing-4);

      .barra {
        flex: 1;
      }
    }

    .avance__pct {
      font-size: var(--kibot-font-size-heading3);
      font-weight: var(--kibot-font-weight-bold);
    }

    .barra--grande {
      height: 0.875rem;
    }

    .tabla {
      width: 100%;
      border-collapse: collapse;
      font-size: var(--kibot-font-size-subtitle);

      th,
      td {
        padding: var(--kibot-spacing-2) var(--kibot-spacing-3);
        text-align: left;
        border-bottom: var(--kibot-stroke-0) solid var(--kibot-line);
      }

      th {
        color: var(--kibot-fg-muted);
        font-weight: var(--kibot-font-weight-bold);
      }
    }

    .tanda {
      margin: 0;
      padding-left: var(--kibot-spacing-5);
      display: flex;
      flex-direction: column;
      gap: var(--kibot-spacing-2);

      li {
        display: flex;
        flex-wrap: wrap;
        justify-content: space-between;
        gap: var(--kibot-spacing-2);
      }
    }

    .tanda--actual {
      font-weight: var(--kibot-font-weight-bold);
    }
  `
})
export class InventoryDetail implements OnDestroy {
  private readonly api = inject(RobotApiService);

  readonly inventario = input<Inventory | null>(null);
  readonly verEnControl = output<Inventory>();
  readonly buscar = output<Inventory>();
  readonly editar = output<Inventory>();
  readonly cerrar = output<Inventory>();

  protected readonly datos = signal<Async<Datos>>({ status: 'idle' });
  private temporizador: ReturnType<typeof setInterval> | null = null;

  protected readonly textoDeEstadoDeZona = textoDeEstadoDeZona;
  protected readonly textoDeFinDeZona = textoDeFinDeZona;

  private readonly robot = computed(
    () => (this.inventario()?.Devices ?? []).find((d) => d.Type?.toLowerCase() === 'robot')?.IdDevice ?? null
  );

  protected readonly robots = computed(() => {
    const nombres = (this.inventario()?.Devices ?? [])
      .filter((d) => d.Type?.toLowerCase() === 'robot')
      .map((d) => d.Name);
    return [...new Set(nombres)].join(', ') || '—';
  });

  protected readonly enMarcha = computed(() => {
    const d = this.datos();
    return d.status === 'ready' && d.value.tanda?.Status === 'Running';
  });

  protected readonly avance = computed(() => {
    const d = this.datos();
    return d.status === 'ready' ? avanceDe(d.value.progreso) : 0;
  });

  /** Las cajas que quedaron en alguna cara: la suma de la ocupación, como en «Por zona». */
  protected readonly cajasUbicadas = computed(() => {
    const d = this.datos();
    return d.status === 'ready' && d.value.ocupacion ? d.value.ocupacion.Racks.reduce((a, r) => a + r.Boxes, 0) : 0;
  });

  /** Las caras de la ocupación agrupadas por la zona del inventario. */
  protected readonly porZona = computed(() => {
    const d = this.datos();
    const inv = this.inventario();
    if (d.status !== 'ready' || !d.value.ocupacion || !inv) return [];
    return (inv.Zones ?? []).map((z) => {
      const caras = d.value.ocupacion!.Racks.filter((r) => r.IdZone === z.IdZone);
      const capacidad = caras.reduce((a, c) => a + c.Capacity, 0);
      const cajas = caras.reduce((a, c) => a + c.Boxes, 0);
      return {
        id: z.IdZone,
        nombre: z.Name,
        caras: caras.length,
        recorridas: caras.filter((c) => c.Covered).length,
        cajas,
        ocupacion: capacidad > 0 ? cajas / capacidad : null,
        anomalias: caras.filter((c) => c.Anomaly).length
      };
    });
  });

  constructor() {
    effect(() => {
      const inv = this.inventario();
      untracked(() => {
        this.parar();
        if (inv === null) {
          this.datos.set({ status: 'idle' });
          return;
        }
        void this.cargar();
        // Abierto: lo que va hasta ahora, al día mientras se mira. Cerrado: ya no cambia.
        if (!inv.EndDate) this.temporizador = setInterval(() => void this.cargar(true), REFRESCO_DETALLE_MS);
      });
    });
  }

  async cargar(enSilencio = false): Promise<void> {
    const inv = this.inventario();
    if (inv === null) return;
    if (!enSilencio) this.datos.set({ status: 'loading' });
    const robot = this.robot();
    try {
      const [progreso, ocupacion, tandaDelRobot] = await Promise.all([
        this.api.progreso(inv._id),
        this.api.ocupacion(inv._id).catch(() => null),
        robot === null ? Promise.resolve(null) : this.api.tanda(inv._id, robot).catch(() => null)
      ]);
      // Cerrado, el inventario ya no lista su robot: se toma el del último recorrido calculado.
      const otroRobot = robot === null ? ocupacion?.Run?.IdDevice ?? null : null;
      const tanda = tandaDelRobot ?? (otroRobot === null ? null : await this.api.tanda(inv._id, otroRobot).catch(() => null));
      if (this.inventario()?._id !== inv._id) return; // respuesta tardía de otro inventario
      this.datos.set({ status: 'ready', value: { progreso, ocupacion, tanda } });
    } catch (error) {
      // Un refresco que falla no borra lo que ya se ve.
      if (!enSilencio) this.datos.set({ status: 'error', ...apiFailure(error) });
    }
  }

  ngOnDestroy(): void {
    this.parar();
  }

  private parar(): void {
    if (this.temporizador !== null) {
      clearInterval(this.temporizador);
      this.temporizador = null;
    }
  }
}
