import { ChangeDetectionStrategy, Component, OnInit, computed, inject, input } from '@angular/core';

import { KiBotErrorState } from '../../shared/ui/kibot-error-state/kibot-error-state';
import { KiBotSelect, KiBotSelectOpcion } from '../../shared/ui/kibot-select/kibot-select';
import { RobotContextStore } from './robot-context.store';

/**
 * «Qué inventario y qué robot»: la misma barra arriba de Control y Buscar. Lo elegido aquí vale para
 * toda la aplicación (ver {@link RobotContextStore}).
 */
@Component({
  selector: 'kibot-robot-context-bar',
  imports: [KiBotErrorState, KiBotSelect],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @switch (contexto.inventarios().status) {
      @case ('error') {
        @if (contexto.inventarios(); as e) {
          @if (e.status === 'error') {
            <kibot-error-state [message]="e.message" [details]="e.details" (retry)="contexto.cargar(true)" />
          }
        }
      }
      @default {
        <div class="barra-contexto">
          <div class="campo">
            <span class="campo__etiqueta">Inventario</span>
            <kibot-select
              etiqueta="Inventario"
              [placeholder]="contexto.inventarios().status === 'ready' ? 'Elige un inventario' : 'Cargando…'"
              vacio="No tienes inventarios."
              [opciones]="opcionesDeInventario()"
              [seleccionada]="contexto.inventarioId()"
              [deshabilitado]="contexto.inventarios().status !== 'ready'"
              (cambia)="contexto.elegirInventario($any($event))"
            />
          </div>

          @if (pedirRobot()) {
            <div class="campo">
              <span class="campo__etiqueta">Robot</span>
              <kibot-select
                etiqueta="Robot"
                [placeholder]="contexto.robots().length === 0 ? 'Sin robots' : 'Elige un robot'"
                [opciones]="opcionesDeRobot()"
                [seleccionada]="contexto.robotId()"
                [deshabilitado]="contexto.robots().length === 0"
                (cambia)="contexto.elegirRobot($any($event))"
              />
            </div>
          }

          @if (pedirZona()) {
            <div class="campo">
              <span class="campo__etiqueta">Zona</span>
              <kibot-select
                etiqueta="Zona"
                [placeholder]="contexto.zonas().length === 0 ? 'Sin zonas' : 'Elige una zona'"
                [opciones]="opcionesDeZona()"
                [seleccionada]="contexto.zonaId()"
                [deshabilitado]="contexto.zonas().length === 0"
                (cambia)="contexto.elegirZona($any($event))"
              />
            </div>
          }

          @if (contexto.inventario(); as inv) {
            <span class="insignia" [class.insignia--activa]="!inv.EndDate">
              {{ inv.EndDate ? 'Cerrado' : 'Abierto' }}
            </span>
          }
        </div>
        @if (aviso(); as texto) {
          <p class="aviso">{{ texto }}</p>
        }
      }
    }
  `,
  styles: `
    .barra-contexto {
      display: flex;
      flex-wrap: wrap;
      align-items: flex-end;
      gap: var(--kibot-spacing-4);
      padding: var(--kibot-spacing-4) var(--kibot-spacing-5);
      border: var(--kibot-stroke-0) solid var(--kibot-line);
      border-radius: var(--kibot-radius-7);
      background: var(--kibot-surface);
    }

    .campo {
      flex: 1 1 14rem;
    }

    .insignia {
      align-self: center;
      margin-top: var(--kibot-spacing-5);
    }

    .aviso {
      margin-top: var(--kibot-spacing-2);
      font-size: var(--kibot-font-size-subtitle);
    }
  `
})
export class RobotContextBar implements OnInit {
  protected readonly contexto = inject(RobotContextStore);

  /** Control solo recorre inventarios abiertos; Buscar también mira los cerrados. */
  readonly soloAbiertos = input(false);
  readonly pedirRobot = input(true);
  /** Buscar filtra por zona: entonces la zona también se elige aquí. */
  readonly pedirZona = input(false);

  protected readonly opcionesDeInventario = computed<KiBotSelectOpcion[]>(() => [
    ...this.contexto.abiertos().map((i) => ({ id: i._id, nombre: i.Name, grupo: 'Abiertos' })),
    ...(this.soloAbiertos()
      ? []
      : this.contexto.cerrados().map((i) => ({ id: i._id, nombre: i.Name, grupo: 'Cerrados (solo consulta)' })))
  ]);

  protected readonly opcionesDeRobot = computed<KiBotSelectOpcion[]>(() =>
    this.contexto.robots().map((r) => ({ id: r.IdDevice, nombre: r.Name }))
  );

  protected readonly opcionesDeZona = computed<KiBotSelectOpcion[]>(() =>
    this.contexto.zonas().map((z) => ({ id: z.IdZone, nombre: z.Name }))
  );

  protected readonly aviso = computed(() => {
    if (this.contexto.inventarios().status !== 'ready') return null;
    if (this.contexto.lista().length === 0) return 'No tienes inventarios. Créalo en Inventarios.';
    if (this.soloAbiertos() && this.contexto.abiertos().length === 0)
      return 'No hay inventarios abiertos. Crea uno en Inventarios para poder recorrer.';
    return null;
  });

  ngOnInit(): void {
    void this.contexto.cargar();
  }

}
