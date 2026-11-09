import { ChangeDetectionStrategy, Component, ElementRef, input, output, viewChildren } from '@angular/core';

export interface KiBotTab {
  readonly id: string;
  readonly label: string;
  /** Un número o texto corto al lado (p. ej. cuántos hay). */
  readonly badge?: string | number | null;
}

/**
 * Pestañas de una pantalla. Solo pinta y avisa: quién decide cuál está activa es la pantalla (que
 * suele guardarla en `?tab=` para que el enlace y el «atrás» del navegador la conserven).
 *
 * <p>Accesibles: `tablist`/`tab`, y las flechas, Inicio y Fin mueven entre pestañas.</p>
 */
@Component({
  selector: 'kibot-tabs',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="tabs" role="tablist" [attr.aria-label]="label()">
      @for (tab of tabs(); track tab.id; let i = $index) {
        <button
          #boton
          type="button"
          role="tab"
          class="tab"
          [class.tab--activa]="tab.id === activa()"
          [attr.aria-selected]="tab.id === activa()"
          [attr.tabindex]="tab.id === activa() ? 0 : -1"
          (click)="cambia.emit(tab.id)"
          (keydown)="alTeclear($event, i)"
        >
          {{ tab.label }}
          @if (tab.badge !== null && tab.badge !== undefined && tab.badge !== '') {
            <span class="tab__badge">{{ tab.badge }}</span>
          }
        </button>
      }
    </div>
  `,
  styles: `
    .tabs {
      display: flex;
      gap: var(--kibot-spacing-1);
      padding: var(--kibot-spacing-1);
      border-radius: var(--kibot-radius-6);
      background: var(--kibot-surface);
      border: var(--kibot-stroke-0) solid var(--kibot-line);
      overflow-x: auto;
      scrollbar-width: none;
    }

    .tab {
      flex: 1 0 auto;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: var(--kibot-spacing-2);
      min-height: 2.75rem;
      padding: var(--kibot-spacing-2) var(--kibot-spacing-5);
      border: none;
      border-radius: var(--kibot-radius-4);
      background: transparent;
      color: var(--kibot-fg-muted);
      font: inherit;
      font-size: var(--kibot-font-size-body);
      font-weight: var(--kibot-font-weight-bold);
      white-space: nowrap;
      cursor: pointer;
      transition:
        background var(--kibot-motion-fast) var(--kibot-ease-standard),
        color var(--kibot-motion-fast) var(--kibot-ease-standard);
    }

    .tab:hover:not(.tab--activa) {
      background: var(--kibot-surface-variant);
      color: var(--kibot-fg);
    }

    .tab--activa {
      background: var(--kibot-accent-wash);
      color: var(--kibot-accent-strong);
    }

    .tab:focus-visible {
      outline: 2px solid var(--kibot-accent);
      outline-offset: 1px;
    }

    .tab__badge {
      min-width: 1.5rem;
      padding: 0 var(--kibot-spacing-2);
      border-radius: var(--kibot-radius-full);
      background: var(--kibot-surface-variant);
      color: var(--kibot-fg);
      font-size: var(--kibot-font-size-subtitle);
    }
  `
})
export class KiBotTabs {
  readonly tabs = input.required<readonly KiBotTab[]>();
  readonly activa = input.required<string>();
  /** Para lectores de pantalla: de qué son estas pestañas. */
  readonly label = input('Secciones');
  readonly cambia = output<string>();

  private readonly botones = viewChildren<ElementRef<HTMLButtonElement>>('boton');

  protected alTeclear(evento: KeyboardEvent, i: number): void {
    const total = this.tabs().length;
    const destino =
      evento.key === 'ArrowRight' ? (i + 1) % total
      : evento.key === 'ArrowLeft' ? (i - 1 + total) % total
      : evento.key === 'Home' ? 0
      : evento.key === 'End' ? total - 1
      : null;
    if (destino === null) return;
    evento.preventDefault();
    this.cambia.emit(this.tabs()[destino].id);
    this.botones()[destino]?.nativeElement.focus();
  }
}
