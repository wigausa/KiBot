---
name: kibot-new-screen
description: Crea el andamiaje de una pantalla/página nueva (componente de ruta) de Angular para KiBot, con la estructura estándar de layout, fondo, padding y navegación consistente con el resto de la app. Usa esta skill SIEMPRE que el usuario pida crear una pantalla nueva, una vista, un "screen", una ruta nueva, o describa una funcionalidad que implica una pantalla completa (ej. "hazme la pantalla de perfil", "necesito una vista de login", "crea la screen de checkout") — incluso si no lo pide explícitamente con la palabra "screen".
---

# KiBot New Screen

Genera el andamiaje estándar de una pantalla nueva para KiBot, asegurando que todas las
pantallas compartan la misma estructura base (fondo, padding, estados de carga/error) y estén
alineadas al design system. Ver `DESIGN.md` en la raíz del proyecto para el detalle de tokens.

## Estructura estándar

Toda pantalla nueva sigue este esqueleto — no te desvíes salvo pedido explícito:

```ts
// features/example/example.page.ts
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ExampleStore } from './example.store';

@Component({
  selector: 'app-example-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="example-page">
      @if (store.isLoading()) {
        <kibot-loading-indicator />
      } @else if (store.error(); as error) {
        <kibot-error-state [message]="error" (retry)="store.retry()" />
      } @else {
        <!-- contenido de la pantalla -->
      }
    </section>
  `,
  styleUrl: './example.page.scss',
})
export class ExamplePage {
  protected readonly store = inject(ExampleStore);
}
```

```scss
// example.page.scss
.example-page {
  min-height: 100%;
  background: var(--kibot-page); // NUNCA blanco/negro hardcodeado
  padding-inline: var(--kibot-spacing-7); // 32px — padding horizontal estándar de pantalla
  display: flex;
  flex-direction: column;
  gap: var(--kibot-spacing-6); // 24px entre secciones
}
```

```ts
// app.routes.ts — lazy loading obligatorio para rutas de feature
{
  path: 'example',
  loadComponent: () => import('./features/example/example.page').then((m) => m.ExamplePage),
}
```

## Reglas

1. **Fondo de pantalla:** siempre `var(--kibot-page)`, nunca blanco/negro hardcodeado.
2. **Padding horizontal de pantalla:** `var(--kibot-spacing-7)` (32px) por defecto, salvo que
   el contenido sea edge-to-edge (ej. carrusel de imágenes) — en ese caso el padding se aplica
   por sección, no a nivel raíz.
3. **Separación entre secciones grandes:** `var(--kibot-spacing-6)` (24px) o `spacing-8`/`-9`
   si son bloques muy grandes (headers, hero sections) — ver `DESIGN.md` sección 1 para elegir
   el salto correcto.
4. **Separación entre tarjetas dentro de una lista/sección:** `var(--kibot-spacing-3)` o
   `-4`.
5. **Superficie de tarjetas/paneles dentro de la pantalla:** `var(--kibot-surface)`, con
   `var(--kibot-radius-6)` o `-7` según el tamaño del bloque.
6. **Estados de carga y error:** usa siempre componentes de estado compartidos
   (`KiBotLoadingIndicator`, `KiBotErrorState` en `src/app/shared/components/`) en vez de un
   spinner o mensaje de error sueltos — si no existen aún, créalos como parte de la pantalla y
   sugiere moverlos a `shared/`.
7. **Lazy loading obligatorio:** toda ruta de feature se registra con `loadComponent` (o
   `loadChildren` si agrupa varias rutas), nunca importada eagerly en `app.routes.ts`.
8. **Componente de página:** standalone, `ChangeDetectionStrategy.OnPush`, estado vía un
   store/signal (no gestión manual de subscripciones RxJS sin `async` pipe).
9. Si la pantalla necesita botones, cards, inputs, etc., delega su creación al patrón de la
   skill `kibot-component` — no reinventes esos componentes dentro de la página.

## Antes de terminar

Verifica: fondo = `var(--kibot-page)`, padding horizontal = token de spacing (no número
suelto), ruta registrada con lazy loading, `OnPush` presente, y que no haya lógica de color
condicional a mano (`if (isDark)`) que debería resolverse solo con los tokens semánticos.
