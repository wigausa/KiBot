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
 * Panel lateral (a la derecha, como el mockup): crear o editar algo sin perder de vista la lista.
 *
 * <p>Se cierra con la ✕, con Esc o tocando el fondo. Al abrir pone el foco dentro y lo encierra
 * (Tab no se escapa a la página de detrás); al cerrar lo devuelve a donde estaba. El pie
 * (`[drawer-pie]`) queda fijo abajo con las acciones.</p>
 */
@Component({
  selector: 'kibot-drawer',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '(document:keydown.escape)': 'alEscape()' },
  template: `
    @if (abierto()) {
      <div class="fondo" (click)="cerrar.emit()" aria-hidden="true"></div>
      <aside
        #panel
        class="panel"
        [class.panel--ancho]="ancho()"
        role="dialog"
        aria-modal="true"
        [attr.aria-label]="titulo()"
        (keydown.tab)="encerrar($event, false)"
        (keydown.shift.tab)="encerrar($event, true)"
      >
        <header class="panel__cabecera">
          <div>
            <h2 class="panel__titulo">{{ titulo() }}</h2>
            @if (subtitulo()) {
              <p class="panel__subtitulo">{{ subtitulo() }}</p>
            }
          </div>
          <button type="button" class="panel__cerrar" aria-label="Cerrar" (click)="cerrar.emit()">✕</button>
        </header>
        <div class="panel__cuerpo">
          <ng-content />
        </div>
        <footer class="panel__pie">
          <ng-content select="[drawer-pie]" />
        </footer>
      </aside>
    }
  `,
  styles: `
    .fondo {
      position: fixed;
      inset: 0;
      z-index: 40;
      background: rgb(3 3 11 / 45%);
      animation: aparecer var(--kibot-motion-base) var(--kibot-ease-standard);
    }

    .panel {
      position: fixed;
      inset-block: 0;
      inset-inline-end: 0;
      z-index: 41;
      width: min(30rem, 100vw);
      display: flex;
      flex-direction: column;
      background: var(--kibot-surface);
      color: var(--kibot-fg);
      border-start-start-radius: var(--kibot-radius-7);
      border-end-start-radius: var(--kibot-radius-7);
      box-shadow: -8px 0 32px rgb(3 3 11 / 18%);
      animation: entrar var(--kibot-motion-base) var(--kibot-ease-standard);
    }

    .panel--ancho {
      width: min(48rem, 100vw);
    }

    .panel__cabecera {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: var(--kibot-spacing-4);
      padding: var(--kibot-spacing-6);
      border-bottom: var(--kibot-stroke-0) solid var(--kibot-line);
    }

    .panel__titulo {
      margin: 0;
      font-size: var(--kibot-font-size-heading4);
      font-weight: var(--kibot-font-weight-bold);
    }

    .panel__subtitulo {
      margin: var(--kibot-spacing-1) 0 0;
      font-size: var(--kibot-font-size-subtitle);
      color: var(--kibot-fg-muted);
    }

    .panel__cerrar {
      flex: none;
      width: 2.75rem;
      height: 2.75rem;
      border: none;
      border-radius: var(--kibot-radius-full);
      background: var(--kibot-surface-variant);
      color: var(--kibot-fg);
      font-size: var(--kibot-font-size-body);
      cursor: pointer;
    }

    .panel__cerrar:focus-visible {
      outline: 2px solid var(--kibot-accent);
      outline-offset: 2px;
    }

    .panel__cuerpo {
      flex: 1;
      min-width: 0;
      overflow-x: hidden;
      overflow-y: auto;
      padding: var(--kibot-spacing-6);
      display: flex;
      flex-direction: column;
      gap: var(--kibot-spacing-5);
    }

    .panel__pie {
      display: flex;
      flex-wrap: wrap;
      justify-content: flex-end;
      gap: var(--kibot-spacing-3);
      padding: var(--kibot-spacing-4) var(--kibot-spacing-6);
      border-top: var(--kibot-stroke-0) solid var(--kibot-line);
    }

    .panel__pie:empty {
      display: none;
    }

    @keyframes aparecer {
      from {
        opacity: 0;
      }
    }

    @keyframes entrar {
      from {
        transform: translateX(2rem);
        opacity: 0;
      }
    }
  `
})
export class KiBotDrawer {
  readonly abierto = input(false);
  readonly titulo = input.required<string>();
  readonly subtitulo = input<string | null>(null);
  /** Para un detalle con tablas: más ancho que el de un formulario. */
  readonly ancho = input(false);
  readonly cerrar = output<void>();

  private readonly panel = viewChild<ElementRef<HTMLElement>>('panel');
  private enfocadoAntes: HTMLElement | null = null;

  constructor() {
    // Al abrir: recordar dónde estaba el foco y llevarlo al panel. Al cerrar: devolverlo.
    effect(() => {
      const abierto = this.abierto();
      const panel = this.panel();
      untracked(() => {
        if (abierto && panel) {
          this.enfocadoAntes = document.activeElement as HTMLElement | null;
          queueMicrotask(() => this.primero(panel.nativeElement)?.focus());
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

  /** Tab en el último salta al primero y Mayús+Tab en el primero al último: el foco no se escapa. */
  protected encerrar(evento: Event, haciaAtras: boolean): void {
    const panel = this.panel()?.nativeElement;
    if (!panel) return;
    const lista = [...panel.querySelectorAll<HTMLElement>(ENFOCABLES)];
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

  private primero(panel: HTMLElement): HTMLElement | null {
    // El primer campo del cuerpo, no la ✕: así se puede escribir enseguida.
    return (
      panel.querySelector<HTMLElement>(`.panel__cuerpo :is(${ENFOCABLES})`) ??
      panel.querySelector<HTMLElement>(ENFOCABLES)
    );
  }
}
