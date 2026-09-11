---
name: widex-design-audit
description: Audita archivos o carpetas de código Angular existentes en WiDex para detectar violaciones al design system (colores hex hardcodeados, valores px/rem sueltos que no corresponden a un token, radios de esquina fuera de la escala oficial, tamaños de fuente no listados en la tipografía, uso de ngClass/ngStyle). Usa esta skill SIEMPRE que el usuario pida "revisa", "audita", "chequea consistencia", "encuentra hardcoded values", o quiera saber si un archivo/PR/carpeta sigue el design system — incluso si solo dice "revisa este archivo" sin mencionar "design system" explícitamente, siempre que el contexto sea código de UI. Para auditorías grandes (carpeta completa o repo entero) prefiere delegar al subagente design-system-guardian en vez de hacerlo inline.
---

# WiDex Design Audit

Detecta violaciones al design system de WiDex en código Angular ya escrito. Referencia
completa de tokens válidos en `DESIGN.md` (raíz del proyecto).

## Cuándo hacerlo inline vs. delegar

- **1-2 archivos, revisión rápida durante la conversación** → hazlo tú mismo, inline, con los
  patrones de esta skill.
- **Carpeta completa, feature entero, o un PR/diff grande** → delega al subagente
  `design-system-guardian`, que corre en paralelo y devuelve un reporte consolidado sin gastar
  el contexto de la conversación principal.

## Qué buscar (patrones de violación)

1. **Colores hardcodeados:** cualquier hex (`#fff`, `#E190FF`) o `rgb()`/`rgba()` fuera de
   `src/styles/tokens/`. Grep útil: `#[0-9a-fA-F]{3,8}\b` en `.scss`/`.html`/estilos inline de
   `.ts`.
2. **Spacing/padding suelto:** cualquier `px`/`rem` literal en `padding`, `margin`, `gap`,
   `width`, `height`, etc. que no venga de `var(--widex-spacing-*)`. Los únicos valores
   "legítimos" fuera de tokens son tamaños de ícono estándar (16/20/24px) — señálalos igual
   mencionando que están exentos.
3. **Radios fuera de escala:** cualquier `border-radius: Npx` con N que no sea
   0/2/4/6/8/10/12/16/999. Sugiere el token `var(--widex-radius-*)` más cercano.
4. **Tipografía suelta:** `font-size: Npx`/`Nrem` inline en vez de los mixins
   `widex-heading*`/`widex-body*`/`widex-caption*`/`widex-subtitle*` de `_typography.scss`.
   Los tamaños válidos son únicamente 14/16/18/20/24/28/34 px (0.875/1/1.125/1.25/1.5/1.75/2.125
   rem).
5. **Bordes:** `border: Npx` con N fuera de 1/2/4/6 (`var(--widex-stroke-*)`).
6. **`ngClass`/`ngStyle`:** prohibidos por `.claude/CLAUDE.md` — cualquier ocurrencia en un
   template es violación de severidad alta, sin importar si además toca colores/spacing.
7. **Lógica de tema manual:** `if (isDark)`, `document.documentElement.matches(...)`, o
   condicionales de color en TypeScript fuera de `core/theme/theme.service.ts` — casi siempre
   indica que se debería estar usando un token semántico (`var(--widex-*)`) en vez de
   ramificar manualmente.
8. **Falta de `OnPush`:** componentes (`@Component`) sin
   `changeDetection: ChangeDetectionStrategy.OnPush` — no es un token de diseño pero es una
   regla no negociable del proyecto, repórtalo igual.

## Formato del reporte

Para cada violación encontrada, reporta:

```
[archivo:línea] Tipo: <color hardcodeado | spacing suelto | radio fuera de escala | ngClass/ngStyle | ...>
  Encontrado:  #7B2CBF
  Sugerencia:  ¿Es esto --widex-color-primary-400 (#AE5DCC) o un color nuevo no documentado?
  Severidad:   alta (color no existe en la paleta / ngClass-ngStyle) / media (existe pero debería ser token) / baja (caso límite documentado, ej. ícono estándar)
```

No autocorrijas silenciosamente — muestra el reporte primero. Si el usuario pide corregirlo,
recién ahí aplica los cambios reemplazando por el token correspondiente.

## Nota sobre colores "casi coincidentes"

Si encuentras un hex que no está exactamente en la paleta pero se le parece mucho (ej.
`#E191FF` vs. `--widex-color-primary-base` `#E190FF`), repórtalo como probable error de tipeo
al copiar el valor a mano, no como "color nuevo válido".
