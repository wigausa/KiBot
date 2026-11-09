import { ChangeDetectionStrategy, Component, OnInit, computed, inject } from '@angular/core';

import { KiBotErrorState } from '../../shared/ui/kibot-error-state/kibot-error-state';
import { KiBotOpcionId } from '../../shared/ui/kibot-multiselect/kibot-multiselect';
import { KiBotSelect, KiBotSelectOpcion } from '../../shared/ui/kibot-select/kibot-select';
import { CompanyStore } from './company.store';

/**
 * El selector de compañía de las pantallas que dependen de ella (Inventarios, Planos y zonas). Las
 * pantallas siguen a CompanyStore.companiaId y recargan lo suyo cuando cambia.
 */
@Component({
  selector: 'kibot-company-picker',
  imports: [KiBotErrorState, KiBotSelect],
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
        <div class="campo">
          <span class="campo__etiqueta">Compañía</span>
          <kibot-select
            etiqueta="Compañía"
            [placeholder]="store.companias().status === 'ready' ? 'Elige una compañía' : 'Cargando compañías…'"
            [opciones]="opciones()"
            [seleccionada]="store.companiaId()"
            [deshabilitado]="store.companias().status !== 'ready'"
            (cambia)="alElegir($event)"
          />
        </div>
      }
    }
  `,
  styles: `
    .campo {
      max-width: 24rem;
    }
  `
})
export class CompanyPicker implements OnInit {
  protected readonly store = inject(CompanyStore);

  protected readonly opciones = computed<KiBotSelectOpcion[]>(() => {
    const lista = this.store.companias();
    return lista.status === 'ready' ? lista.value.map((c) => ({ id: c.idCompany, nombre: c.name })) : [];
  });

  ngOnInit(): void {
    void this.store.cargar();
  }

  protected alElegir(id: KiBotOpcionId | null): void {
    this.store.elegir(id === null ? null : Number(id));
  }
}
