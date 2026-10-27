import { ChangeDetectionStrategy, Component, OnInit, inject } from '@angular/core';

import { KiBotErrorState } from '../../shared/ui/kibot-error-state/kibot-error-state';
import { CompanyStore } from './company.store';

/**
 * El selector de compañía de las pantallas que dependen de ella (Zonas, Inventarios). Las pantallas
 * siguen a CompanyStore.companiaId y recargan lo suyo cuando cambia.
 */
@Component({
  selector: 'kibot-company-picker',
  imports: [KiBotErrorState],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @switch (store.companias().status) {
      @case ('error') {
        @if (store.companias(); as e) {
          @if (e.status === 'error') {
            <kibot-error-state [message]="e.message" [details]="e.details" (retry)="store.cargar()" />
          }
        }
      }
      @default {
        <label class="campo">
          <span class="campo__etiqueta">Compañía</span>
          <select class="campo__control" (change)="alElegir($event)" [disabled]="store.companias().status !== 'ready'">
            <option value="" [selected]="store.companiaId() === null">
              {{ store.companias().status === 'ready' ? 'Elige una compañía' : 'Cargando compañías…' }}
            </option>
            @if (store.companias(); as lista) {
              @if (lista.status === 'ready') {
                @for (c of lista.value; track c.idCompany) {
                  <option [value]="c.idCompany" [selected]="c.idCompany === store.companiaId()">{{ c.name }}</option>
                }
              }
            }
          </select>
        </label>
      }
    }
  `,
  styles: `
    .campo {
      display: flex;
      flex-direction: column;
      gap: var(--kibot-spacing-2);
      max-width: 24rem;
    }

    .campo__etiqueta {
      font-size: var(--kibot-font-size-subtitle);
      font-weight: var(--kibot-font-weight-bold);
      color: var(--kibot-fg-muted);
    }

    .campo__control {
      padding: var(--kibot-spacing-2) var(--kibot-spacing-3);
      border: var(--kibot-stroke-0) solid var(--kibot-line);
      border-radius: var(--kibot-radius-6);
      background: var(--kibot-surface);
      color: var(--kibot-fg);
      font: inherit;
      font-size: var(--kibot-font-size-body);

      &:focus-visible {
        outline: var(--kibot-stroke-0) solid var(--kibot-accent-strong);
        outline-offset: var(--kibot-spacing-0);
      }
    }
  `
})
export class CompanyPicker implements OnInit {
  protected readonly store = inject(CompanyStore);

  ngOnInit(): void {
    void this.store.cargar();
  }

  protected alElegir(evento: Event): void {
    const valor = (evento.target as HTMLSelectElement).value;
    const id = valor === '' ? null : Number(valor);
    this.store.elegir(id);
  }
}
