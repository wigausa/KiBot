import { ChangeDetectionStrategy, Component, OnInit, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';

import { BoxSearch } from '../box-search/box-search';
import { RobotContextBar } from '../robot/robot-context-bar';
import { RobotContextStore } from '../robot/robot-context.store';

/**
 * Buscar: dónde quedó una caja según lo que el robot ya leyó en el último recorrido del inventario y
 * zona elegidos arriba (los mismos de Control).
 *
 * <p>Mandar al robot a buscarla es desde el 2026-11-12 su propio módulo, «Buscar con el robot»
 * (`/buscar-robot`), porque ya no depende de un inventario. Un resultado sin ubicación enlaza allí con
 * el plano, la zona y el código puestos.</p>
 */
@Component({
  selector: 'kibot-search',
  imports: [RobotContextBar, BoxSearch],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="pagina">
      <header class="pagina__cabecera">
        <div>
          <p class="pagina__antetitulo">Buscar</p>
          <h1>Buscar cajas</h1>
          <p class="pagina__nota">
            Elige el inventario y la zona, y escribe el código USDA impreso en la caja o su EPC. Se busca en lo que el
            robot ya leyó en esa zona; si no aparece, puedes mandarlo a buscarla.
          </p>
        </div>
      </header>

      <kibot-robot-context-bar [pedirZona]="true" />

      <kibot-box-search [embebido]="true" [inventarioId]="contexto.inventarioId()" [zonaId]="contexto.zonaId()" />
    </section>
  `
})
export class Search implements OnInit {
  protected readonly contexto = inject(RobotContextStore);
  private readonly ruta = inject(ActivatedRoute);

  ngOnInit(): void {
    void this.contexto.cargar().then(() => {
      // Un enlace con ?inv= (desde un resultado, o un marcador viejo) elige ese inventario.
      const inv = this.ruta.snapshot.queryParamMap.get('inv');
      if (inv && this.contexto.lista().some((i) => i._id === inv)) this.contexto.elegirInventario(inv);
    });
  }
}
