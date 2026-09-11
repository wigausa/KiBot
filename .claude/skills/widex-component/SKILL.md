---
name: widex-component
description: Genera componentes Angular standalone (botones, cards, inputs, chips, badges, list items, dialogs, etc.) para WiDex usando exclusivamente los tokens del design system (src/styles/tokens/*.scss). Usa esta skill SIEMPRE que el usuario pida crear, escribir o modificar un componente, botón, card, input, chip, badge, item de lista o cualquier elemento de UI reutilizable — incluso si no menciona "WiDex" o "design system" explícitamente. También aplica cuando se pide "estiliza este componente" o "hazlo consistente con el resto de la app".
---

# WiDex Component

Genera componentes Angular que son visualmente consistentes con el resto de WiDex, usando
siempre los tokens definidos en `src/styles/tokens/` (ver `DESIGN.md` en la raíz del proyecto
para el detalle completo de cada token).

## Reglas no negociables

1. **Cero valores hardcodeados.** Nunca un hex (`#...`), `16px`, `1.125rem` sueltos en el SCSS
   de un componente de feature. Todo debe venir de:
   - Colores → `var(--widex-page|surface|surface-variant|line|fg|accent|error|success|warning)`
     (tokens semánticos) — nunca `var(--widex-color-*)` crudo directo en un componente.
   - Espaciado → `var(--widex-spacing-0)` … `var(--widex-spacing-10)`
   - Radios → `var(--widex-radius-*)`
   - Grosor de borde → `var(--widex-stroke-0)` … `var(--widex-stroke-3)`
   - Tipografía → mixins `@include widex-heading1`, `@include widex-body-regular`, etc. de
     `src/styles/tokens/_typography.scss`
2. **El componente debe funcionar en modo claro y oscuro sin código condicional.** Si necesitas
   un `@if` de tema o leer `ThemeService.resolvedTheme()` dentro de un componente de UI, es
   señal de que estás usando un color crudo en vez de un token semántico — corrígelo. Los
   tokens semánticos ya resuelven el tema solos vía `[data-theme]` en `<html>`.
3. **Botones:** radio siempre `var(--widex-radius-6)` (12px), borde outline siempre
   `var(--widex-stroke-0)` (1px solid). Tamaños:
   - Small → padding vertical `var(--widex-spacing-1)` (4px), horizontal
     `var(--widex-spacing-5)` (20px)
   - Medium → vertical `var(--widex-spacing-2)` (8px), horizontal `var(--widex-spacing-6)`
     (24px)
   - Large → vertical `var(--widex-spacing-3)` (12px), horizontal `var(--widex-spacing-7)`
     (32px)
   - El texto es **1.125rem/18px en los tres tamaños** — no lo escales, solo cambia el
     padding.
   - Variantes de color: Base / 400 / 200 de la paleta correspondiente (Primary, Secondary,
     etc.), vía `--widex-color-<paleta>-<variante>`.
4. **Angular idiomático (obligatorio, viene de `.claude/CLAUDE.md`):**
   - Standalone (sin `standalone: true` explícito, es el default), sin NgModules.
   - `input()` / `output()` en vez de decoradores `@Input`/`@Output`.
   - `changeDetection: ChangeDetectionStrategy.OnPush` siempre.
   - Estado derivado con `computed()`, nunca lógica compleja en el template.
   - Prohibido `ngClass`/`ngStyle` → usar `[class]`/`[style]` bindings.
   - Prohibido `@HostBinding`/`@HostListener` → usar el objeto `host` del decorador.
   - Signals para estado local; nunca `mutate`, usar `update()`/`set()`.
5. **Nombrado:** prefijo `Widex` para componentes de sistema de diseño reutilizables
   (`WidexButton`, `WidexCard`, `WidexChip`), ubicados en `src/app/shared/components/`; sin
   prefijo para componentes específicos de una pantalla que solo componen los anteriores.

## Ejemplo de referencia (botón)

```ts
import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';

export type WidexButtonVariant = 'fill' | 'outline';
export type WidexButtonSize = 'small' | 'medium' | 'large';
export type WidexButtonPalette = 'primary' | 'secondary' | 'tertiary';

@Component({
  selector: 'widex-button',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[class]': 'hostClass()',
  },
  template: `
    <button
      type="button"
      class="widex-button"
      [class]="'widex-button--' + variant() + ' widex-button--' + size()"
      [style.--widex-button-color]="paletteColor()"
      (click)="pressed.emit()"
    >
      <ng-content />
    </button>
  `,
  styleUrl: './widex-button.scss',
})
export class WidexButtonComponent {
  readonly variant = input<WidexButtonVariant>('fill');
  readonly size = input<WidexButtonSize>('medium');
  readonly palette = input<WidexButtonPalette>('primary');
  readonly pressed = output<void>();

  protected readonly hostClass = computed(() => `widex-button-host widex-button-host--${this.size()}`);
  protected readonly paletteColor = computed(() => `var(--widex-color-${this.palette()}-base)`);
}
```

```scss
// widex-button.scss
.widex-button {
  border-radius: var(--widex-radius-6);
  border: var(--widex-stroke-0) solid var(--widex-button-color);
  font-size: var(--widex-font-size-caption);
  font-family: var(--widex-font-family);

  &--fill {
    background: var(--widex-button-color);
    color: var(--widex-color-neutral-white);
  }

  &--outline {
    background: transparent;
    color: var(--widex-button-color);
  }

  &--small {
    padding: var(--widex-spacing-1) var(--widex-spacing-5);
  }

  &--medium {
    padding: var(--widex-spacing-2) var(--widex-spacing-6);
  }

  &--large {
    padding: var(--widex-spacing-3) var(--widex-spacing-7);
  }
}
```

Usa este patrón (variables CSS derivadas de tokens, no números mágicos, `input()`/`output()`,
`OnPush`) como plantilla para cualquier componente nuevo que se pida.

## Antes de terminar

Revisa el componente generado contra la regla 1: busca cualquier número (`px`, `rem`) o color
hex/`rgb(` que se haya colado sin pasar por un token. Si encuentras alguno, corrígelo antes de
entregar el código. Revisa también que no haya `ngClass`/`ngStyle` ni falte
`ChangeDetectionStrategy.OnPush`.
