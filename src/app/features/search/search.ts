import { ChangeDetectionStrategy, Component, OnInit, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { map } from 'rxjs';

import { KiBotTab, KiBotTabs } from '../../shared/ui/kibot-tabs/kibot-tabs';
import { BoxSearch } from '../box-search/box-search';
import { RobotContextBar } from '../robot/robot-context-bar';
import { RobotContextStore } from '../robot/robot-context.store';
import { RobotSearchPage } from '../robot-search/robot-search';

type PestanaDeBuscar = 'guardado' | 'robot';

const PESTANAS: readonly KiBotTab[] = [
  { id: 'guardado', label: 'En el último recorrido' },
  { id: 'robot', label: 'Mandar al robot' }
];

/**
 * Buscar cajas: un solo módulo para las dos maneras de encontrar una caja.
 *
 * <ol>
 *   <li><b>En el último recorrido</b>: dónde quedó según lo que el robot ya leyó. Es lo primero que
 *       se mira, y sirve también con inventarios cerrados.</li>
 *   <li><b>Mandar al robot</b>: si no está, o no se pudo decidir, el robot va a buscarla a una zona.
 *       Solo en inventarios abiertos. Desde un resultado sin ubicación, el enlace «Mandar al robot a
 *       buscarla» pasa aquí con el código ya puesto.</li>
 * </ol>
 *
 * <p>El inventario y el robot son los elegidos arriba (los mismos de Control). La pestaña va en
 * `?tab=` y el código en `?code=`, así que «Buscar con el robot» de antes sigue funcionando.</p>
 */
@Component({
  selector: 'kibot-search',
  imports: [KiBotTabs, RobotContextBar, BoxSearch, RobotSearchPage],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="pagina">
      <header class="pagina__cabecera">
        <div>
          <p class="pagina__antetitulo">Buscar</p>
          <h1>Buscar cajas</h1>
          <p class="pagina__nota">
            Elige el inventario y la zona, y escribe el código USDA impreso en la caja o su EPC. Primero se busca en
            lo que el robot ya leyó en esa zona; si no aparece, puedes mandarlo a buscarla.
          </p>
        </div>
      </header>

      <kibot-robot-context-bar [pedirZona]="true" />

      <kibot-tabs label="Formas de buscar" [tabs]="pestanas" [activa]="tab()" (cambia)="irA($event)" />

      @if (tab() === 'robot') {
        <kibot-robot-search
          [embebido]="true"
          [inventarioId]="contexto.inventarioId()"
          [robotId]="contexto.robotId()"
          [zonaId]="contexto.zonaId()"
        />
      } @else {
        <kibot-box-search [embebido]="true" [inventarioId]="contexto.inventarioId()" [zonaId]="contexto.zonaId()" />
      }
    </section>
  `
})
export class Search implements OnInit {
  protected readonly contexto = inject(RobotContextStore);
  private readonly router = inject(Router);
  private readonly ruta = inject(ActivatedRoute);

  protected readonly pestanas = PESTANAS;

  protected readonly tab = toSignal(
    this.ruta.queryParamMap.pipe(map((p) => pestanaDe(p.get('tab')))),
    { initialValue: pestanaDe(this.ruta.snapshot.queryParamMap.get('tab')) }
  );

  ngOnInit(): void {
    void this.contexto.cargar().then(() => {
      // Un enlace con ?inv= (desde un resultado, o un marcador viejo) elige ese inventario.
      const inv = this.ruta.snapshot.queryParamMap.get('inv');
      if (inv && this.contexto.lista().some((i) => i._id === inv)) this.contexto.elegirInventario(inv);
    });
  }

  protected irA(tab: string): void {
    void this.router.navigate([], {
      relativeTo: this.ruta,
      queryParams: { tab: tab === 'guardado' ? null : tab },
      queryParamsHandling: 'merge',
      replaceUrl: true
    });
  }
}

function pestanaDe(valor: string | null): PestanaDeBuscar {
  return valor === 'robot' ? 'robot' : 'guardado';
}
