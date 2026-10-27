import { ChangeDetectionStrategy, Component, OnInit, effect, inject, untracked } from '@angular/core';
import { DatePipe } from '@angular/common';

import { CompanyPicker } from '../../core/company/company-picker';
import { CompanyStore } from '../../core/company/company.store';
import { KiBotButton } from '../../shared/ui/kibot-button/kibot-button';
import { KiBotErrorState } from '../../shared/ui/kibot-error-state/kibot-error-state';
import { KiBotLoadingIndicator } from '../../shared/ui/kibot-loading-indicator/kibot-loading-indicator';
import { InventoriesStore } from './inventories.store';

/**
 * Inventarios del robot: crear uno con su plano, sus zonas y sus robots, y cerrarlo. El recorrido
 * del robot dentro de un inventario se controla desde Control.
 */
@Component({
  selector: 'kibot-inventories',
  imports: [CompanyPicker, KiBotButton, KiBotErrorState, KiBotLoadingIndicator, DatePipe],
  providers: [InventoriesStore],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './inventories.html',
  styleUrl: './inventories.scss'
})
export class Inventories implements OnInit {
  protected readonly store = inject(InventoriesStore);
  private readonly companias = inject(CompanyStore);

  constructor() {
    effect(() => {
      this.companias.companiaId();
      untracked(() => void this.store.cargar());
    });
  }

  ngOnInit(): void {
    void this.companias.cargar();
  }

  protected cuantos(n: number, uno: string, varios: string): string {
    return `${n} ${n === 1 ? uno : varios}`;
  }

  protected valor(evento: Event): string {
    return (evento.target as HTMLInputElement | HTMLSelectElement).value;
  }

  protected alElegirPlano(evento: Event): void {
    const v = this.valor(evento);
    this.store.elegirPlano(v === '' ? null : v);
  }
}
