# DESIGN.md — Witag Design System (WiDex / Web)

> **Propósito de este archivo:** es la fuente de verdad para que cualquier asistente de IA
> (Claude Code, Cursor, Copilot, etc.) genere UI consistente para WiDex. Contiene todos los
> tokens de diseño en formato estructurado, listos para mapear a CSS custom properties / SCSS
> / Angular.
>
> **Origen:** este documento es la contraparte web del mismo sistema de diseño Witag ya
> implementado en la app Android (`Color.kt`, `Theme.kt`, `Shape.kt`, `Type.kt`). Los valores
> crudos (HEX, spacing, radius, tipografía) son **idénticos** entre ambas plataformas — WiDex
> reusa la misma paleta de marca, solo cambia el mecanismo de implementación (CSS custom
> properties en vez de `Color`/`TextStyle` de Compose).
>
> **Plataforma objetivo:** Angular 20 (standalone, signals, zoneless). Este doc es agnóstico
> de framework en sus tablas de tokens, pero incluye al final el mapeo directo a SCSS/Angular.

---

## 0. Reglas para la IA

1. Nunca inventar colores, tamaños o radios fuera de esta tabla. Si falta un token, usar el
   más cercano y señalarlo.
2. Los **tokens semánticos** (`page`, `surface`, `surfaceVariant`, `line`, `fg`, `accent`) son
   los que deben usarse en pantallas/componentes — nunca los HEX crudos de la paleta ni las
   variables `--widex-color-*`, salvo para construir esos tokens semánticos en
   `src/styles/tokens/_semantic.scss`.
3. Modo claro y modo oscuro se implementan con el mismo mecanismo: `[data-theme="light"]` /
   `[data-theme="dark"]` en `<html>` (ver `ThemeService`), más `prefers-color-scheme` como
   default cuando no hay preferencia explícita. Nunca ramificar colores con `if` en TypeScript.
4. Radios, spacing y stroke siempre deben tomarse de la escala fija (`var(--widex-spacing-*)`,
   `var(--widex-radius-*)`, `var(--widex-stroke-*)`) — nunca valores arbitrarios como `13px`.
5. Hay una inconsistencia conocida en el archivo fuente del PDF de diseño original (ver
   sección 4, nota de Primary). Usar el valor corregido, no el literal del PDF.
6. Nunca usar `ngClass` ni `ngStyle` (prohibido también por las reglas generales del proyecto
   en `.claude/CLAUDE.md`) — usar bindings de `class`/`style` con las variables de este
   documento.

---

## 1. Spacing scale

Escala base 4/8 con dos pasos extra pequeños. Usar SIEMPRE `var(--widex-spacing-N)` para
`padding`, `margin`, `gap`, etc.

| Token | px | Variable CSS |
|---|---|---|
| `spacing.0` | 2 | `--widex-spacing-0` |
| `spacing.1` | 4 | `--widex-spacing-1` |
| `spacing.2` | 8 | `--widex-spacing-2` |
| `spacing.3` | 12 | `--widex-spacing-3` |
| `spacing.4` | 16 | `--widex-spacing-4` |
| `spacing.5` | 20 | `--widex-spacing-5` |
| `spacing.6` | 24 | `--widex-spacing-6` |
| `spacing.7` | 32 | `--widex-spacing-7` |
| `spacing.8` | 40 | `--widex-spacing-8` |
| `spacing.9` | 48 | `--widex-spacing-9` |
| `spacing.10` | 56 | `--widex-spacing-10` |

## 2. Radius scale

| Token | px | Variable CSS | Uso sugerido |
|---|---|---|---|
| `radius.none` | 0 | `--widex-radius-none` | rectángulos duros |
| `radius.1` | 2 | `--widex-radius-1` | chips pequeños |
| `radius.2` | 4 | `--widex-radius-2` | inputs densos |
| `radius.3` | 6 | `--widex-radius-3` | badges |
| `radius.4` | 8 | `--widex-radius-4` | cards pequeñas |
| `radius.5` | 10 | `--widex-radius-5` | inputs |
| `radius.6` | 12 | `--widex-radius-6` | **botones (default)**, cards |
| `radius.7` | 16 | `--widex-radius-7` | cards grandes, modales/sheets |
| `radius.full` | 999 | `--widex-radius-full` | pills, avatares, FAB |

## 3. Stroke (grosor de borde)

| Token | px | Variable CSS |
|---|---|---|
| `stroke.0` | 1 (default para outline) | `--widex-stroke-0` |
| `stroke.1` | 2 | `--widex-stroke-1` |
| `stroke.2` | 4 | `--widex-stroke-2` |
| `stroke.3` | 6 | `--widex-stroke-3` |

---

## 4. Paleta de color (cruda — solo para construir tokens semánticos/componentes)

### Primary (Magenta/Violeta)

| Variante | HEX | Variable CSS |
|---|---|---|
| Base | `#E190FF` | `--widex-color-primary-base` |
| 50 (alpha) | `#D974FF` @ 50% opacidad *(ver nota)* | `--widex-color-primary-alpha-50` |
| 100 | `#E8ACFF` | `--widex-color-primary-100` |
| 200 | `#D974FF` | `--widex-color-primary-200` |
| 400 | `#AE5DCC` | `--widex-color-primary-400` |
| 500 | `#824699` | `--widex-color-primary-500` |

> **Nota de corrección:** el PDF original trae el swatch "50" con HEX `#E190FF80` pero RGBa
> `217,116,255 @ 50%`, que en realidad corresponde a `#D974FF` al 50%. Es una inconsistencia
> del archivo original (idéntica en Android y aquí). **Usar `#D974FF` al 50% de opacidad**
> como `primary.alpha50`.

### Secondary (Azul)

| Variante | HEX | Variable CSS |
|---|---|---|
| Base | `#29ABE2` | `--widex-color-secondary-base` |
| 50 | `#7FCDEE` | `--widex-color-secondary-50` |
| 100 | `#54BCE8` | `--widex-color-secondary-100` |
| 200 | `#29ABE2` | `--widex-color-secondary-200` |
| 400 | `#2189B5` | `--widex-color-secondary-400` |
| 500 | `#196788` | `--widex-color-secondary-500` |

### Tertiary (Índigo oscuro)

| Variante | HEX | Variable CSS |
|---|---|---|
| Base | `#1B1451` | `--widex-color-tertiary-base` |
| 50 | `#3D30A0` | `--widex-color-tertiary-50` |
| 100 | `#2B2277` | `--widex-color-tertiary-100` |
| 200 | `#1B1451` | `--widex-color-tertiary-200` |
| 400 | `#140E40` | `--widex-color-tertiary-400` |
| 500 | `#0E0A34` | `--widex-color-tertiary-500` |

### Neutral

| Variante | HEX | Variable CSS |
|---|---|---|
| White | `#FFFFFF` | `--widex-color-neutral-white` |
| 100 | `#F2F2F2` | `--widex-color-neutral-100` |
| 200 | `#E3E3E3` | `--widex-color-neutral-200` |
| 300 | `#CECECE` | `--widex-color-neutral-300` |
| 400 | `#B3B3B3` | `--widex-color-neutral-400` |
| 500 | `#03030B` | `--widex-color-neutral-500` |

### Error

| Variante | HEX | Variable CSS |
|---|---|---|
| Base | `#E21E1E` | `--widex-color-error-base` |
| 100 | `#E84B4B` | `--widex-color-error-100` |
| 200 | `#B51818` | `--widex-color-error-200` |

### Success

| Variante | HEX | Variable CSS |
|---|---|---|
| Base | `#3AB674` | `--widex-color-success-base` |
| 100 | `#61C590` | `--widex-color-success-100` |
| 200 | `#236D46` | `--widex-color-success-200` |

### Warning

| Variante | HEX | Variable CSS |
|---|---|---|
| Base | `#FDB712` | `--widex-color-warning-base` |
| 100 | `#FDC541` | `--widex-color-warning-100` |
| 200 | `#996B00` | `--widex-color-warning-200` |

---

## 5. Tipografía

No se especifica una tipografía de marca en el archivo fuente (sin `font family` declarada) →
**usar el stack de sistema** (`var(--widex-font-family)`) hasta que Wiga defina una tipografía
propia. Si existe una fuente de marca, agregarla **únicamente** en
`src/styles/tokens/_typography.scss` (`--widex-font-family`) — todo el resto del sistema la
hereda automáticamente.

| Estilo | Weight | Size | Mixin SCSS | Uso sugerido |
|---|---|---|---|---|
| `Heading1` | 700 | 34 (2.125rem) | `widex-heading1` | título de pantalla / hero |
| `Heading2` | 700 | 28 (1.75rem) | `widex-heading2` | título de sección |
| `Heading3` | 700 | 24 (1.5rem) | `widex-heading3` | subtítulo de sección |
| `Heading4` | 700 | 20 (1.25rem) | `widex-heading4` | título de card |
| `CaptionBold` | 700 | 18 (1.125rem) | `widex-caption-bold` | énfasis en captions |
| `CaptionRegular` | 400 | 18 (1.125rem) | `widex-caption-regular` | caption estándar |
| `CaptionLight` | 300 | 18 (1.125rem) | `widex-caption-light` | caption secundaria |
| `BodyBold` | 700 | 16 (1rem) | `widex-body-bold` | texto de cuerpo con énfasis |
| `BodyRegular` | 400 | 16 (1rem) | `widex-body-regular` | **texto de cuerpo default** |
| `BodyLight` | 300 | 16 (1rem) | `widex-body-light` | texto de cuerpo secundario |
| `SubtitleBold` | 700 | 14 (0.875rem) | `widex-subtitle-bold` | labels, botones pequeños |
| `SubtitleRegular` | 400 | 14 (0.875rem) | `widex-subtitle-regular` | metadatos, timestamps |

Tamaños en `rem` (no `px`) para respetar el zoom/font-size del usuario — requisito de
accesibilidad en web sin equivalente directo en Android.

---

## 6. Tokens semánticos (light/dark)

Estos son los tokens que **sí** deben usarse directamente en pantallas y componentes, vía
`var(--widex-*)`.

| Token semántico | Claro | Oscuro | Uso |
|---|---|---|---|
| `--widex-page` | `#F2F2F2` | `#03030B` | fondo de pantalla |
| `--widex-surface` | `#FFFFFF` | `#0E0A34` | cards, sheets, contenedores |
| `--widex-surface-variant` | `#F2F2F2` | `#140E40` | superficie secundaria/anidada |
| `--widex-line` | `#E3E3E3` | `White @ 10%` | dividers, bordes |
| `--widex-fg` (foreground/texto) | `#03030B` | `#FFFFFF` | texto principal |
| `--widex-accent` | `#E190FF` | `#E8ACFF` | acento de marca, links, iconos activos |

Colores de estado (`--widex-error`, `--widex-success`, `--widex-warning`) usan las mismas
variantes Base/100/200 en ambos modos — no cambian entre claro/oscuro; solo ajustar el
contraste de texto sobre ellos según fondo.

---

## 7. Botones

- **Radio:** `radius.6` (`--widex-radius-6`, 12px) en todos los tamaños.
- **Outline:** borde `stroke.0` (`--widex-stroke-0`, 1px) solid.
- **Variantes de color:** cada paleta (Primary/Secondary/etc.) expone 3 tonos utilizables en
  botones: `Base`, `400`, `200` — tanto en fill como en outline.
- **Fill:** fondo = color de paleta, texto = `neutral.white` (o `--widex-fg` invertido según
  contraste).
- **Outline:** fondo transparente, borde y texto = color de paleta.

### Tamaños

| Tamaño | Padding V / H | Font size |
|---|---|---|
| Small | 4 / 20 px (`spacing.1` / `spacing.5`) | 18px (1.125rem) |
| Medium | 8 / 24 px (`spacing.2` / `spacing.6`) | 18px (1.125rem) |
| Large | 12 / 32 px (`spacing.3` / `spacing.7`) | 18px (1.125rem) |

> Nota: los 3 tamaños comparten `font size 18`; solo cambia el padding — igual que en la
> versión Android. Vale la pena revisar con diseño si esto es intencional o si Small/Medium
> deberían usar `SubtitleBold` (14px) en vez de 18px, ya que no coincide con la escala
> tipográfica de la sección 5.

---

## 8. Checklist para la IA al generar una pantalla/componente nuevo

- [ ] Fondo de pantalla → `var(--widex-page)`
- [ ] Contenedores/cards → `var(--widex-surface)` con `radius.6` o `radius.7`
- [ ] Texto principal → `var(--widex-fg)`, tipografía de la sección 5 según jerarquía
- [ ] Elementos interactivos/CTA → `var(--widex-accent)` o paleta Primary
- [ ] Espaciados → solo `var(--widex-spacing-*)`
- [ ] Bordes/divisores → `var(--widex-line)`, `var(--widex-stroke-0)`
- [ ] Soportar modo claro y oscuro desde el día 1 (`ThemeService` + tokens semánticos, nunca
      HEX hardcodeados ni `if (isDark)` en componentes)
- [ ] Estados de error/éxito/warning → paletas dedicadas de la sección 4
- [ ] Componente standalone, `input()`/`output()`, `ChangeDetectionStrategy.OnPush`
- [ ] Sin `ngClass`/`ngStyle` — usar bindings `[class]`/`[style]`

---

## 9. Do's and Don'ts

Reglas rápidas en positivo/negativo — más fáciles de seguir para un agente de IA que prosa
larga. Ante la duda, esta sección manda sobre cualquier inferencia visual.

### Colores

- ✅ Usar siempre un token semántico: `var(--widex-page)`, `var(--widex-surface)`,
  `var(--widex-fg)`, `var(--widex-accent)`, `var(--widex-line)`.
- ✅ Usar las paletas de estado (`--widex-error*`, `--widex-success*`, `--widex-warning*`) para
  feedback — nunca improvisar un rojo/verde/amarillo nuevo.
- ❌ Nunca un HEX o `rgb()` suelto en un componente de feature — ni siquiera si "se ve igual"
  a un token existente.
- ❌ Nunca `--widex-color-*` (paleta cruda) directo en una pantalla — solo se usa para construir
  tokens semánticos en `_semantic.scss`.
- ❌ Nunca introducir un segundo color de acento. `--widex-accent` es el único acento
  interactivo del sistema (igual que Apple con su único Action Blue): si un CTA necesita
  destacar más, se resuelve con tamaño/peso/spacing, no con un color nuevo.

### Tipografía

- ✅ Usar los mixins de `_typography.scss` (`widex-heading1`… `widex-subtitle-regular`) para
  cualquier texto con jerarquía.
- ✅ Cuerpo de texto en `BodyRegular` (16px/1rem) por default.
- ❌ Nunca un `font-size` en `px`/`rem` suelto en el SCSS de un componente.
- ❌ Nunca un peso de fuente fuera de 300/400/700 — no existe un 500/600 en esta escala.

### Espaciado, radios y bordes

- ✅ Todo padding/margin/gap sale de `var(--widex-spacing-*)`.
- ✅ Todo `border-radius` sale de `var(--widex-radius-*)`; botones siempre `radius.6` (12px).
- ❌ Nunca un valor arbitrario como `13px` o `18px` "porque se ve bien" — si ningún token
  encaja, señalarlo en vez de inventar uno.

### Modo claro/oscuro

- ✅ Confiar en los tokens semánticos + `ThemeService` — el tema se resuelve solo.
- ❌ Nunca ramificar con `if (isDark)` / `@if` dentro de un componente de UI. Si sientes la
  necesidad de hacerlo, es señal de que falta un token semántico, no de que haga falta lógica.

### Angular

- ✅ Standalone, `input()`/`output()`, `ChangeDetectionStrategy.OnPush`, `computed()` para
  estado derivado, lazy loading por feature.
- ❌ Nunca `ngClass`/`ngStyle`, `@HostBinding`/`@HostListener`, ni `mutate()` sobre signals.

### Elevación

- ✅ Un único uso de sombra está permitido hoy: bajo imágenes de producto/hero que "descansan"
  sobre una superficie (ver sección 10, gap de elevación — aún no tokenizado).
- ❌ Nunca sombras decorativas en chrome de UI (nav, botones, cards) salvo que se documente un
  token de elevación explícito primero.

---

## 10. Known Gaps

Zonas del sistema que **todavía no están definidas**. No improvisar un valor aquí — señalar el
gap al usuario o usar el token más cercano y dejarlo explícito en el PR/commit.

- **Estados de input (focus/error/disabled/hover).** `DESIGN.md` no define look-and-feel de
  formularios más allá de los colores de estado (`error`/`success`/`warning`). No hay token de
  `focus ring`, grosor de borde en error, ni opacidad de disabled.
- **Elevación / sombras.** No existe una escala de `box-shadow` (`--widex-elevation-*`). Hoy el
  único caso de sombra observado en Android (`Theme.kt`) viene de los defaults de Material3, no
  de un token propio de Witag — pendiente de definir si WiDex necesita una escala explícita.
- **Motion / transiciones.** Sin tokens de duración (`--widex-motion-fast`, etc.) ni easing
  estándar. Cualquier `transition` hoy es una decisión ad-hoc del componente.
- **Tipografía de marca.** `--widex-font-family` usa el stack de sistema porque Wiga no ha
  definido una tipografía propia (ver sección 5) — pendiente de decisión de marca.
- **Contraste de `--widex-accent` en modo oscuro sin confirmar.** `#E8ACFF` sobre `#0E0A34` es
  la combinación que el agente `a11y-contrast-checker` marca como la más crítica a verificar —
  no asumir que pasa AA sin correr el agente.
- **Breakpoints / grid responsive.** No hay una escala oficial de breakpoints ni de columnas de
  grid — cada feature define su propio layout responsive por ahora.
- **Iconografía.** No hay una librería de íconos elegida (Material Symbols, Lucide, custom
  SVG...) ni un tamaño estándar más allá de la mención genérica a "íconos estándar
  16/20/24px" en las skills de auditoría.
- **Componentes reales aún no implementados.** `WidexButton`, `WidexCard`, `WidexLoadingIndicator`,
  `WidexErrorState` etc. están documentados como *patrón* en la skill `widex-component`, pero
  todavía no existen como archivos en `src/app/shared/components/` — créalos la primera vez que
  una pantalla los necesite, siguiendo ese patrón.
- **Inconsistencia heredada de botones (sección 7).** Los 3 tamaños de botón comparten
  `font-size: 18px`, lo cual no coincide con la escala tipográfica de la sección 5. Se heredó
  tal cual de la versión Android — no "corregirla" silenciosamente sin validarlo con diseño.

---

## 11. Mapeo a Angular (SCSS / CSS custom properties)

Ver carpeta `src/styles/tokens/` y `src/app/core/theme/` para la implementación lista para
usar:

- `tokens/_colors.scss` — paleta cruda como CSS custom properties (`--widex-color-*`)
- `tokens/_semantic.scss` — tokens semánticos light/dark (`--widex-page`, `--widex-surface`,
  `--widex-fg`, `--widex-accent`, `--widex-line`) — equivalente a `WitagLightColors` /
  `WitagDarkColorScheme` de Android
- `tokens/_spacing.scss`, `_radius.scss`, `_stroke.scss` — escalas de la sección 1-3
- `tokens/_typography.scss` — mixins `widex-heading1`, `widex-body-regular`, etc. —
  equivalente a `WitagTextStyles`
- `tokens/_index.scss` — punto único de import (`@use "styles/tokens"` desde `styles.scss`)
- `core/theme/theme.service.ts` — `ThemeService` (signals) que resuelve `system/light/dark` y
  escribe `[data-theme]` en `<html>` — equivalente a `WitagTheme` / `WitagTheme.colors.*` de
  Android, pero vía CSS custom properties en vez de `CompositionLocal`

Componentes de UI reutilizables (`WidexButton`, `WidexCard`, etc., equivalentes a
`WitagButton`/`WitagCard`) deben vivir en `src/app/shared/components/` y consumir
exclusivamente estos tokens — ver skill `widex-component`.
