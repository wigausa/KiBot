import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { WitagLogo, WitagLogoTone } from '../witag-logo/witag-logo';

/**
 * Spinner de marca: tres arcos concéntricos girando a distinta velocidad y
 * sentido, con el ícono de Witag al centro.
 *
 * Es el puerto del `WitagLoader` / `CustomLoader` de WitagAndroid
 * (presentation/components/WitagUi.kt): mismos radios (0.98 / 0.68 / 0.38 del
 * diámetro), mismo barrido de 260°, mismo grosor (7.5% del diámetro) y las
 * mismas relaciones de velocidad sobre `--widex-motion-pulse`.
 */
@Component({
  selector: 'widex-loader',
  imports: [WitagLogo],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    role: 'status',
    '[attr.aria-label]': 'label() ?? "Cargando"',
    '[style.--widex-loader-size.px]': 'size()'
  },
  template: `
    <div class="loader">
      <svg class="loader__arcs" viewBox="0 0 108 108" fill="none" aria-hidden="true">
        <circle class="arc arc--outer" cx="54" cy="54" r="49" />
        <circle class="arc arc--middle" cx="54" cy="54" r="34" />
        <circle class="arc arc--inner" cx="54" cy="54" r="19" />
      </svg>

      @if (showMark()) {
        <witag-logo
          class="loader__mark"
          variant="icon"
          [width]="markWidth()"
          [tone]="markTone()"
          [priority]="true"
          alt=""
        />
      }
    </div>

    @if (label(); as text) {
      <p class="loader__label">{{ text }}</p>
    }
  `,
  styles: `
    :host {
      display: inline-flex;
      flex-direction: column;
      align-items: center;
      gap: var(--widex-spacing-4);
    }

    .loader {
      position: relative;
      display: grid;
      place-items: center;
      width: var(--widex-loader-size, 96px);
      height: var(--widex-loader-size, 96px);
    }

    .loader__arcs {
      width: 100%;
      height: 100%;
    }

    .arc {
      fill: none;
      stroke-width: 7.5;
      stroke-linecap: round;
      transform-origin: 50% 50%;
      /* Barrido de 260°: dash = 260/360 de la circunferencia. */
      animation-timing-function: var(--widex-ease-linear);
      animation-iteration-count: infinite;
    }

    .arc--outer {
      stroke: var(--widex-brand-ink);
      stroke-dasharray: 222.4 85.5;
      animation-name: widex-spin;
      animation-duration: var(--widex-motion-pulse);
    }

    .arc--middle {
      stroke: var(--widex-brand-magenta);
      stroke-dasharray: 154.3 59.3;
      animation-name: widex-spin-reverse;
      animation-duration: calc(var(--widex-motion-pulse) * 0.72);
    }

    .arc--inner {
      stroke: var(--widex-brand-aqua);
      stroke-dasharray: 86.2 33.2;
      animation-name: widex-spin;
      animation-duration: calc(var(--widex-motion-pulse) * 0.45);
    }

    .loader__mark {
      position: absolute;
      display: block;
    }

    .loader__label {
      margin: 0;
      font-size: var(--widex-font-size-subtitle);
      font-weight: var(--widex-font-weight-regular);
      line-height: 1.4;
      color: var(--widex-fg-muted);
    }

    @keyframes widex-spin {
      from {
        transform: rotate(0deg);
      }
      to {
        transform: rotate(360deg);
      }
    }

    @keyframes widex-spin-reverse {
      from {
        transform: rotate(360deg);
      }
      to {
        transform: rotate(0deg);
      }
    }

    @media (prefers-reduced-motion: reduce) {
      .arc {
        animation-duration: calc(var(--widex-motion-pulse) * 4);
      }
    }
  `
})
export class WidexLoader {
  /** Diámetro del spinner en px. */
  readonly size = input(96);
  readonly showMark = input(true);
  readonly label = input<string | null>(null);
  /** `on-brand` cuando el spinner va sobre el gradiente de marca. */
  readonly markTone = input<WitagLogoTone>('auto');

  /** El ícono central ocupa el 30% del spinner, igual que `CustomLoader`. */
  protected readonly markWidth = computed(() => Math.round(this.size() * 0.3));
}
