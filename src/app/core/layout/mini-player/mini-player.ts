import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { RouterLink } from '@angular/router';

import { RobotApiService, falloDeOrden } from '../../../features/robot/robot-api.service';
import { RobotContextStore } from '../../../features/robot/robot-context.store';
import { RobotBatchView } from '../../../features/robot/robot.models';
import { KiBotConfirm } from '../../../shared/ui/kibot-confirm/kibot-confirm';

/**
 * El recorrido en curso, siempre a la vista (como el mini-reproductor del mockup): una barra abajo,
 * en cualquier pantalla, con el avance, la zona y las órdenes de siempre —pausar, reanudar, detener—
 * y un atajo a Control.
 *
 * <p>Sale solo con una tanda en marcha del robot elegido ({@link RobotContextStore}). En Control no
 * se pinta: ahí ya está todo eso en grande.</p>
 */
@Component({
  selector: 'kibot-mini-player',
  imports: [RouterLink, DecimalPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (contexto.enMarcha(); as tanda) {
      <section class="mini" aria-label="Recorrido en curso" aria-live="polite">
        <div class="mini__barra" role="progressbar" aria-valuemin="0" aria-valuemax="100"
             [attr.aria-valuenow]="contexto.avance() | number: '1.0-0'">
          <div class="mini__relleno" [style.width.%]="contexto.avance()"></div>
        </div>

        <div class="mini__cuerpo">
          <span class="mini__punto" [class.mini__punto--pausa]="contexto.enPausa()" aria-hidden="true"></span>
          <div class="mini__texto">
            <span class="mini__titulo">
              {{ contexto.enPausa() ? 'Recorrido en pausa' : 'Recorrido en curso' }}
              · {{ contexto.avance() | number: '1.0-0' }} %
            </span>
            <span class="mini__sub">
              {{ contexto.robot()?.Name ?? 'Robot' }}
              @if (contexto.zonaEnCurso(); as z) {
                · Zona {{ z.numero }} de {{ z.total }}: {{ z.nombre }}
              }
            </span>
            @if (error(); as e) {
              <span class="mini__error" role="alert">{{ e }}</span>
            }
          </div>

          <div class="mini__acciones">
            @if (contexto.enPausa()) {
              <button type="button" class="mini__boton mini__boton--principal" [disabled]="ocupado()"
                      (click)="ordenar(tanda, 'reanudar')">Reanudar</button>
            } @else {
              <button type="button" class="mini__boton mini__boton--principal" [disabled]="ocupado()"
                      (click)="ordenar(tanda, 'pausar')">Pausar</button>
            }
            <button type="button" class="mini__boton mini__boton--peligro" [disabled]="ocupado()"
                    (click)="ordenar(tanda, 'cancelar')">Detener</button>
            <a class="mini__ir" routerLink="/control">Ver control</a>
          </div>
        </div>
      </section>
    }
  `,
  styles: `
    .mini {
      position: relative;
      background: var(--kibot-rail);
      color: var(--kibot-on-rail);
      box-shadow: 0 -4px 24px rgb(3 3 11 / 20%);
    }

    .mini__barra {
      height: 4px;
      background: rgb(255 255 255 / 14%);
    }

    .mini__relleno {
      height: 100%;
      background: var(--kibot-accent);
      transition: width var(--kibot-motion-base) var(--kibot-ease-standard);
    }

    .mini__cuerpo {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: var(--kibot-spacing-3) var(--kibot-spacing-4);
      padding: var(--kibot-spacing-3) var(--kibot-spacing-6);
    }

    .mini__punto {
      flex: none;
      width: 0.75rem;
      height: 0.75rem;
      border-radius: var(--kibot-radius-full);
      background: var(--kibot-success);
      box-shadow: 0 0 0 4px rgb(58 182 116 / 25%);
    }

    .mini__punto--pausa {
      background: var(--kibot-warning);
      box-shadow: 0 0 0 4px rgb(253 183 18 / 25%);
    }

    .mini__texto {
      flex: 1 1 14rem;
      min-width: 0;
      display: flex;
      flex-direction: column;
    }

    .mini__titulo {
      font-weight: var(--kibot-font-weight-bold);
    }

    .mini__sub {
      font-size: var(--kibot-font-size-subtitle);
      color: var(--kibot-on-rail-muted);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .mini__error {
      font-size: var(--kibot-font-size-subtitle);
      color: var(--kibot-warning);
    }

    .mini__acciones {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: var(--kibot-spacing-2);
    }

    .mini__boton {
      min-height: 2.5rem;
      padding: var(--kibot-spacing-1) var(--kibot-spacing-5);
      border: var(--kibot-stroke-0) solid rgb(255 255 255 / 40%);
      border-radius: var(--kibot-radius-6);
      background: transparent;
      color: var(--kibot-on-rail);
      font: inherit;
      font-weight: var(--kibot-font-weight-bold);
      cursor: pointer;
    }

    .mini__boton--principal {
      border-color: var(--kibot-accent);
      background: var(--kibot-accent);
      color: var(--kibot-on-accent);
    }

    .mini__boton--principal:hover:not(:disabled) {
      background: var(--kibot-accent-hover);
      color: var(--kibot-on-brand);
    }

    .mini__boton--peligro:hover:not(:disabled) {
      border-color: var(--kibot-error);
      background: var(--kibot-error);
    }

    .mini__boton:disabled {
      opacity: 0.4;
      cursor: not-allowed;
    }

    .mini__boton:focus-visible,
    .mini__ir:focus-visible {
      outline: 2px solid var(--kibot-accent);
      outline-offset: 2px;
    }

    .mini__ir {
      padding: var(--kibot-spacing-2) var(--kibot-spacing-3);
      color: var(--kibot-on-rail);
      font-weight: var(--kibot-font-weight-bold);
      text-decoration: underline;
      text-underline-offset: 3px;
    }
  `
})
export class MiniPlayer {
  protected readonly contexto = inject(RobotContextStore);
  private readonly api = inject(RobotApiService);
  private readonly confirmar = inject(KiBotConfirm);

  protected readonly ocupado = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly robotNombre = computed(() => this.contexto.robot()?.Name ?? 'el robot');

  protected async ordenar(tanda: RobotBatchView, orden: 'pausar' | 'reanudar' | 'cancelar'): Promise<void> {
    const pregunta = PREGUNTAS[orden];
    if (!(await this.confirmar.preguntar(pregunta))) return;

    this.ocupado.set(true);
    this.error.set(null);
    try {
      const inv = tanda.IdInventory;
      const robot = tanda.IdDevice;
      if (orden === 'pausar') await this.api.pausar(inv, robot);
      else if (orden === 'reanudar') await this.api.reanudar(inv, robot);
      else await this.api.cancelar(inv, robot);
    } catch (e) {
      this.error.set(falloDeOrden(e).message);
    } finally {
      this.ocupado.set(false);
      await this.contexto.vigilar();
    }
  }
}

/** Las mismas preguntas que Control: una orden que para el robot siempre se confirma. */
const PREGUNTAS = {
  pausar: {
    titulo: '¿Pausar el recorrido?',
    mensaje: 'El robot se para donde esté; después se puede reanudar.',
    aceptar: 'Pausar'
  },
  reanudar: {
    titulo: '¿Reanudar el recorrido?',
    mensaje: 'El robot sigue desde donde se quedó.',
    aceptar: 'Reanudar'
  },
  cancelar: {
    titulo: '¿Detener el recorrido?',
    mensaje:
      'El robot se queda donde está (no vuelve al dock), se detiene la tanda y no se recorren las zonas que faltan.',
    aceptar: 'Detener',
    peligro: true
  }
} as const;
