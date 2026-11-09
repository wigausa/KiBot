import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  effect,
  input,
  output,
  untracked,
  viewChild
} from '@angular/core';

const ENFOCABLES =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Una ventana centrada y grande, para mirar algo sin salir de la pantalla (p. ej. un plano).
 *
 * <p>Se cierra con la ✕, con Esc o tocando el fondo. Encierra el foco mientras está abierta y lo
 * devuelve al cerrar, como `kibot-drawer`.</p>
 */
@Component({
  selector: 'kibot-modal',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '(document:keydown.escape)': 'alEscape()' },
  template: `
    @if (abierto()) {
      <div class="fondo" (click)="cerrar.emit()" aria-hidden="true"></div>
      <div
        #ventana
        class="ventana"
        role="dialog"
        aria-modal="true"
        [attr.aria-label]="titulo()"
        (keydown.tab)="encerrar($event, false)"
        (keydown.shift.tab)="encerrar($event, true)"
      >
        <header class="ventana__cabecera">
          <div>
            <h2 class="ventana__titulo">{{ titulo() }}</h2>
            @if (subtitulo()) {
              <p class="ventana__subtitulo">{{ subtitulo() }}</p>
            }
          </div>
          <button type="button" class="ventana__cerrar" aria-label="Cerrar" (click)="cerrar.emit()">✕</button>
        </header>
        <div class="ventana__cuerpo">
          <ng-content />
        </div>
      </div>
    }
  `,
  styles: `
    .fondo {
      position: fixed;
      inset: 0;
      z-index: 50;
      background: rgb(3 3 11 / 55%);
      animation: aparecer var(--kibot-motion-base) var(--kibot-ease-standard);
    }

    .ventana {
      position: fixed;
      z-index: 51;
      inset: var(--kibot-spacing-6);
      margin: auto;
      max-width: 80rem;
      max-height: calc(100dvh - 2 * var(--kibot-spacing-6));
      display: flex;
      flex-direction: column;
      border-radius: var(--kibot-radius-7);
      background: var(--kibot-surface);
      color: var(--kibot-fg);
      box-shadow: 0 24px 64px rgb(3 3 11 / 30%);
      animation: entrar var(--kibot-motion-base) var(--kibot-ease-standard);

      @media (max-width: 40rem) {
        inset: var(--kibot-spacing-2);
        max-height: calc(100dvh - 2 * var(--kibot-spacing-2));
      }
    }

    .ventana__cabecera {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: var(--kibot-spacing-4);
      padding: var(--kibot-spacing-5) var(--kibot-spacing-6);
      border-bottom: var(--kibot-stroke-0) solid var(--kibot-line);
    }

    .ventana__titulo {
      margin: 0;
      font-size: var(--kibot-font-size-heading4);
      font-weight: var(--kibot-font-weight-bold);
    }

    .ventana__subtitulo {
      margin: var(--kibot-spacing-1) 0 0;
      font-size: var(--kibot-font-size-subtitle);
      color: var(--kibot-fg-muted);
    }

    .ventana__cerrar {
      flex: none;
      width: 2.75rem;
      height: 2.75rem;
      border: none;
      border-radius: var(--kibot-radius-full);
      background: var(--kibot-surface-variant);
      color: var(--kibot-fg);
      font: inherit;
      cursor: pointer;
    }

    .ventana__cerrar:focus-visible {
      outline: 2px solid var(--kibot-accent);
      outline-offset: 2px;
    }

    .ventana__cuerpo {
      flex: 1;
      min-height: 0;
      overflow: auto;
      padding: var(--kibot-spacing-5) var(--kibot-spacing-6) var(--kibot-spacing-6);
      display: flex;
      flex-direction: column;
      gap: var(--kibot-spacing-4);
    }

    @keyframes aparecer {
      from {
        opacity: 0;
      }
    }

    @keyframes entrar {
      from {
        transform: scale(0.97);
        opacity: 0;
      }
    }
  `
})
export class KiBotModal {
  readonly abierto = input(false);
  readonly titulo = input.required<string>();
  readonly subtitulo = input<string | null>(null);
  readonly cerrar = output<void>();

  private readonly ventana = viewChild<ElementRef<HTMLElement>>('ventana');
  private enfocadoAntes: HTMLElement | null = null;

  constructor() {
    effect(() => {
      const abierto = this.abierto();
      const ventana = this.ventana();
      untracked(() => {
        if (abierto && ventana) {
          this.enfocadoAntes = document.activeElement as HTMLElement | null;
          queueMicrotask(() => ventana.nativeElement.querySelector<HTMLElement>('.ventana__cerrar')?.focus());
        } else if (!abierto && this.enfocadoAntes) {
          this.enfocadoAntes.focus?.();
          this.enfocadoAntes = null;
        }
      });
    });
  }

  protected alEscape(): void {
    if (this.abierto()) this.cerrar.emit();
  }

  protected encerrar(evento: Event, haciaAtras: boolean): void {
    const ventana = this.ventana()?.nativeElement;
    if (!ventana) return;
    const lista = [...ventana.querySelectorAll<HTMLElement>(ENFOCABLES)];
    if (lista.length === 0) return;
    const [primero, ultimo] = [lista[0], lista[lista.length - 1]];
    if (haciaAtras && document.activeElement === primero) {
      evento.preventDefault();
      ultimo.focus();
    } else if (!haciaAtras && document.activeElement === ultimo) {
      evento.preventDefault();
      primero.focus();
    }
  }
}
