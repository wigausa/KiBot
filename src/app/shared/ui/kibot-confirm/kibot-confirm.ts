import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  Injectable,
  effect,
  inject,
  signal,
  untracked,
  viewChild
} from '@angular/core';

export interface Pregunta {
  readonly titulo: string;
  readonly mensaje: string;
  /** El texto del botón que acepta: «Pausar», «Cerrar inventario»… nunca un «Aceptar» genérico. */
  readonly aceptar: string;
  readonly cancelar?: string;
  /** Pinta el botón de aceptar como destructivo. */
  readonly peligro?: boolean;
}

interface PreguntaEnCurso extends Pregunta {
  readonly responder: (si: boolean) => void;
}

/**
 * Las confirmaciones de KiBot, en vez del `confirm()` del navegador (que en la pantalla del robot
 * sale con la URL arriba y sin el estilo de la aplicación).
 *
 * <pre>if (await confirmar.preguntar({ titulo: 'Pausar', mensaje: '…', aceptar: 'Pausar' })) …</pre>
 *
 * El diálogo lo pinta {@link KiBotConfirmHost}, una sola vez, en la shell.
 */
@Injectable({ providedIn: 'root' })
export class KiBotConfirm {
  private readonly _actual = signal<PreguntaEnCurso | null>(null);
  readonly actual = this._actual.asReadonly();

  preguntar(pregunta: Pregunta): Promise<boolean> {
    // Si había otra abierta, cuenta como «no»: nunca quedan dos promesas colgando.
    this._actual()?.responder(false);
    return new Promise<boolean>((resolve) => {
      this._actual.set({
        ...pregunta,
        responder: (si) => {
          this._actual.set(null);
          resolve(si);
        }
      });
    });
  }
}

@Component({
  selector: 'kibot-confirm-host',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '(document:keydown.escape)': 'responder(false)' },
  template: `
    @if (confirmar.actual(); as p) {
      <div class="fondo" (click)="responder(false)" aria-hidden="true"></div>
      <div
        class="dialogo"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="kibot-confirm-titulo"
        [attr.aria-describedby]="p.mensaje ? 'kibot-confirm-mensaje' : null"
      >
        <h2 id="kibot-confirm-titulo">{{ p.titulo }}</h2>
        @if (p.mensaje) {
          <p id="kibot-confirm-mensaje">{{ p.mensaje }}</p>
        }
        <div class="acciones">
          <button #cancelar type="button" class="boton boton--contorno" (click)="responder(false)">
            {{ p.cancelar ?? 'Volver' }}
          </button>
          <button
            type="button"
            class="boton"
            [class.boton--peligro]="p.peligro"
            (click)="responder(true)"
          >
            {{ p.aceptar }}
          </button>
        </div>
      </div>
    }
  `,
  styles: `
    .fondo {
      position: fixed;
      inset: 0;
      z-index: 60;
      background: rgb(3 3 11 / 50%);
    }

    .dialogo {
      position: fixed;
      z-index: 61;
      inset-inline: var(--kibot-spacing-4);
      top: 50%;
      transform: translateY(-50%);
      margin-inline: auto;
      max-width: 28rem;
      padding: var(--kibot-spacing-6);
      border-radius: var(--kibot-radius-7);
      background: var(--kibot-surface);
      color: var(--kibot-fg);
      box-shadow: 0 16px 48px rgb(3 3 11 / 25%);
      display: flex;
      flex-direction: column;
      gap: var(--kibot-spacing-3);
    }

    h2 {
      margin: 0;
      font-size: var(--kibot-font-size-heading4);
      font-weight: var(--kibot-font-weight-bold);
    }

    p {
      margin: 0;
      line-height: 1.5;
      color: var(--kibot-fg-muted);
    }

    .acciones {
      display: flex;
      flex-wrap: wrap;
      justify-content: flex-end;
      gap: var(--kibot-spacing-3);
      margin-top: var(--kibot-spacing-3);
    }

    .boton {
      min-height: 2.75rem;
      padding: var(--kibot-spacing-2) var(--kibot-spacing-6);
      border: var(--kibot-stroke-0) solid var(--kibot-accent);
      border-radius: var(--kibot-radius-6);
      background: var(--kibot-accent);
      color: var(--kibot-on-accent);
      font: inherit;
      font-weight: var(--kibot-font-weight-bold);
      cursor: pointer;
    }

    .boton:hover {
      background: var(--kibot-accent-hover);
      border-color: var(--kibot-accent-hover);
      color: var(--kibot-on-brand);
    }

    .boton--contorno {
      background: transparent;
      color: var(--kibot-accent-strong);
    }

    .boton--peligro {
      background: var(--kibot-error-strong);
      border-color: var(--kibot-error-strong);
      color: var(--kibot-on-brand);
    }

    .boton--peligro:hover {
      background: var(--kibot-error);
      border-color: var(--kibot-error);
    }

    .boton:focus-visible {
      outline: 2px solid var(--kibot-accent);
      outline-offset: 2px;
    }
  `
})
export class KiBotConfirmHost {
  protected readonly confirmar = inject(KiBotConfirm);
  private readonly cancelar = viewChild<ElementRef<HTMLButtonElement>>('cancelar');

  constructor() {
    // El foco va a «Volver»: aceptar una orden que para el robot nunca debe ser un Enter de paso.
    effect(() => {
      const boton = this.cancelar();
      untracked(() => boton && queueMicrotask(() => boton.nativeElement.focus()));
    });
  }

  protected responder(si: boolean): void {
    this.confirmar.actual()?.responder(si);
  }
}
