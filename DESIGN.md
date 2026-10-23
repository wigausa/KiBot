# DESIGN.md — Witag Design System (KiBot / Web)

> **Propósito de este archivo:** es la fuente de verdad para que cualquier asistente de IA
> (Claude Code, Cursor, Copilot, etc.) genere UI consistente para KiBot. Contiene todos los
> tokens de diseño en formato estructurado, listos para mapear a CSS custom properties / SCSS
> / Angular.
>
> **Origen:** este documento es la contraparte web del mismo sistema de diseño Witag ya
> implementado en la app Android (`Color.kt`, `Theme.kt`, `Shape.kt`, `Type.kt`). Los valores
> crudos (HEX, spacing, radius, tipografía) son **idénticos** entre ambas plataformas — KiBot
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
   variables `--kibot-color-*`, salvo para construir esos tokens semánticos en
   `src/styles/tokens/_semantic.scss`.
3. Modo claro y modo oscuro se implementan con el mismo mecanismo: `[data-theme="light"]` /
   `[data-theme="dark"]` en `<html>` (ver `ThemeService`), más `prefers-color-scheme` como
   default cuando no hay preferencia explícita. Nunca ramificar colores con `if` en TypeScript.
4. Radios, spacing y stroke siempre deben tomarse de la escala fija (`var(--kibot-spacing-*)`,
   `var(--kibot-radius-*)`, `var(--kibot-stroke-*)`) — nunca valores arbitrarios como `13px`.
5. Hay una inconsistencia conocida en el archivo fuente del PDF de diseño original (ver
   sección 4, nota de Primary). Usar el valor corregido, no el literal del PDF.
6. Nunca usar `ngClass` ni `ngStyle` (prohibido también por las reglas generales del proyecto
   en `.claude/CLAUDE.md`) — usar bindings de `class`/`style` con las variables de este
   documento.

---

## 1. Spacing scale

Escala base 4/8 con dos pasos extra pequeños. Usar SIEMPRE `var(--kibot-spacing-N)` para
`padding`, `margin`, `gap`, etc.

| Token | px | Variable CSS |
|---|---|---|
| `spacing.0` | 2 | `--kibot-spacing-0` |
| `spacing.1` | 4 | `--kibot-spacing-1` |
| `spacing.2` | 8 | `--kibot-spacing-2` |
| `spacing.3` | 12 | `--kibot-spacing-3` |
| `spacing.4` | 16 | `--kibot-spacing-4` |
| `spacing.5` | 20 | `--kibot-spacing-5` |
| `spacing.6` | 24 | `--kibot-spacing-6` |
| `spacing.7` | 32 | `--kibot-spacing-7` |
| `spacing.8` | 40 | `--kibot-spacing-8` |
| `spacing.9` | 48 | `--kibot-spacing-9` |
| `spacing.10` | 56 | `--kibot-spacing-10` |

## 2. Radius scale

| Token | px | Variable CSS | Uso sugerido |
|---|---|---|---|
| `radius.none` | 0 | `--kibot-radius-none` | rectángulos duros |
| `radius.1` | 2 | `--kibot-radius-1` | chips pequeños |
| `radius.2` | 4 | `--kibot-radius-2` | inputs densos |
| `radius.3` | 6 | `--kibot-radius-3` | badges |
| `radius.4` | 8 | `--kibot-radius-4` | cards pequeñas |
| `radius.5` | 10 | `--kibot-radius-5` | inputs |
| `radius.6` | 12 | `--kibot-radius-6` | **botones (default)**, cards |
| `radius.7` | 16 | `--kibot-radius-7` | cards grandes, modales/sheets |
| `radius.full` | 999 | `--kibot-radius-full` | pills, avatares, FAB |

## 3. Stroke (grosor de borde)

| Token | px | Variable CSS |
|---|---|---|
| `stroke.0` | 1 (default para outline) | `--kibot-stroke-0` |
| `stroke.1` | 2 | `--kibot-stroke-1` |
| `stroke.2` | 4 | `--kibot-stroke-2` |
| `stroke.3` | 6 | `--kibot-stroke-3` |

---

## 4. Paleta de color (cruda — solo para construir tokens semánticos/componentes)

### Primary (Magenta/Violeta)

| Variante | HEX | Variable CSS |
|---|---|---|
| Base | `#E190FF` | `--kibot-color-primary-base` |
| 50 (alpha) | `#D974FF` @ 50% opacidad *(ver nota)* | `--kibot-color-primary-alpha-50` |
| 100 | `#E8ACFF` | `--kibot-color-primary-100` |
| 200 | `#D974FF` | `--kibot-color-primary-200` |
| 400 | `#AE5DCC` | `--kibot-color-primary-400` |
| 500 | `#824699` | `--kibot-color-primary-500` |

> **Nota de corrección:** el PDF original trae el swatch "50" con HEX `#E190FF80` pero RGBa
> `217,116,255 @ 50%`, que en realidad corresponde a `#D974FF` al 50%. Es una inconsistencia
> del archivo original (idéntica en Android y aquí). **Usar `#D974FF` al 50% de opacidad**
> como `primary.alpha50`.

### Secondary (Azul)

| Variante | HEX | Variable CSS |
|---|---|---|
| Base | `#29ABE2` | `--kibot-color-secondary-base` |
| 50 | `#7FCDEE` | `--kibot-color-secondary-50` |
| 100 | `#54BCE8` | `--kibot-color-secondary-100` |
| 200 | `#29ABE2` | `--kibot-color-secondary-200` |
| 400 | `#2189B5` | `--kibot-color-secondary-400` |
| 500 | `#196788` | `--kibot-color-secondary-500` |

### Tertiary (Índigo oscuro)

| Variante | HEX | Variable CSS |
|---|---|---|
| Base | `#1B1451` | `--kibot-color-tertiary-base` |
| 50 | `#3D30A0` | `--kibot-color-tertiary-50` |
| 100 | `#2B2277` | `--kibot-color-tertiary-100` |
| 200 | `#1B1451` | `--kibot-color-tertiary-200` |
| 400 | `#140E40` | `--kibot-color-tertiary-400` |
| 500 | `#0E0A34` | `--kibot-color-tertiary-500` |

### Neutral

| Variante | HEX | Variable CSS |
|---|---|---|
| White | `#FFFFFF` | `--kibot-color-neutral-white` |
| 100 | `#F2F2F2` | `--kibot-color-neutral-100` |
| 200 | `#E3E3E3` | `--kibot-color-neutral-200` |
| 300 | `#CECECE` | `--kibot-color-neutral-300` |
| 400 | `#B3B3B3` | `--kibot-color-neutral-400` |
| 500 | `#03030B` | `--kibot-color-neutral-500` |

### Error

| Variante | HEX | Variable CSS |
|---|---|---|
| Base | `#E21E1E` | `--kibot-color-error-base` |
| 100 | `#E84B4B` | `--kibot-color-error-100` |
| 200 | `#B51818` | `--kibot-color-error-200` |

### Success

| Variante | HEX | Variable CSS |
|---|---|---|
| Base | `#3AB674` | `--kibot-color-success-base` |
| 100 | `#61C590` | `--kibot-color-success-100` |
| 200 | `#236D46` | `--kibot-color-success-200` |

### Warning

| Variante | HEX | Variable CSS |
|---|---|---|
| Base | `#FDB712` | `--kibot-color-warning-base` |
| 100 | `#FDC541` | `--kibot-color-warning-100` |
| 200 | `#996B00` | `--kibot-color-warning-200` |

---

## 5. Tipografía

**Tipografía de marca: Poppins**, la misma que usa WitagFrontend (`src/global.scss`). Se usa
siempre vía `var(--kibot-font-family)`; nunca declarar `font-family: "Poppins"` en un
componente. Si algún día cambia, se toca **únicamente** `--kibot-font-family` en
`src/styles/tokens/_typography.scss` y todo el sistema lo hereda.

Está **auto-hospedada** en `public/fonts/` y declarada en `src/styles/_fonts.scss` (subsets
latin y latin-ext, pesos 300/400/700, ~39 KB en total). WitagFrontend la carga desde el CDN de
Google; KiBot no puede, porque corre en la pantalla del robot y un arranque sin red dejaría
toda la UI en la tipografía de respaldo. `src/index.html` precarga los pesos 400 y 700 del
subset latin, que son los que se ven en el primer render.

Solo existen esos tres pesos: si un diseño pide otro, descargar el woff2 correspondiente — no
sintetizar el peso con `font-weight`.

| Estilo | Weight | Size | Mixin SCSS | Uso sugerido |
|---|---|---|---|---|
| `Heading1` | 700 | 34 (2.125rem) | `kibot-heading1` | título de pantalla / hero |
| `Heading2` | 700 | 28 (1.75rem) | `kibot-heading2` | título de sección |
| `Heading3` | 700 | 24 (1.5rem) | `kibot-heading3` | subtítulo de sección |
| `Heading4` | 700 | 20 (1.25rem) | `kibot-heading4` | título de card |
| `CaptionBold` | 700 | 18 (1.125rem) | `kibot-caption-bold` | énfasis en captions |
| `CaptionRegular` | 400 | 18 (1.125rem) | `kibot-caption-regular` | caption estándar |
| `CaptionLight` | 300 | 18 (1.125rem) | `kibot-caption-light` | caption secundaria |
| `BodyBold` | 700 | 16 (1rem) | `kibot-body-bold` | texto de cuerpo con énfasis |
| `BodyRegular` | 400 | 16 (1rem) | `kibot-body-regular` | **texto de cuerpo default** |
| `BodyLight` | 300 | 16 (1rem) | `kibot-body-light` | texto de cuerpo secundario |
| `SubtitleBold` | 700 | 14 (0.875rem) | `kibot-subtitle-bold` | labels, botones pequeños |
| `SubtitleRegular` | 400 | 14 (0.875rem) | `kibot-subtitle-regular` | metadatos, timestamps |

Tamaños en `rem` (no `px`) para respetar el zoom/font-size del usuario — requisito de
accesibilidad en web sin equivalente directo en Android.

---

## 6. Tokens semánticos (light/dark)

Estos son los tokens que **sí** deben usarse directamente en pantallas y componentes, vía
`var(--kibot-*)`.

| Token semántico | Claro | Oscuro | Uso |
|---|---|---|---|
| `--kibot-page` | `#F2F2F2` | `#03030B` | fondo de pantalla |
| `--kibot-surface` | `#FFFFFF` | `#0E0A34` | cards, sheets, contenedores |
| `--kibot-surface-variant` | `#F2F2F2` | `#140E40` | superficie secundaria/anidada |
| `--kibot-line` | `#E3E3E3` | `White @ 10%` | dividers, bordes |
| `--kibot-fg` (foreground/texto) | `#03030B` | `#FFFFFF` | texto principal |
| `--kibot-accent` | `#E190FF` | `#E8ACFF` | acento de marca, links, iconos activos |

### 6.1 Extensiones añadidas en KiBot

Estos tokens no venían del PDF original; se agregaron al implementar el shell y el Inicio
(fase 1) y viven en `src/styles/tokens/_semantic.scss`. Ninguno introduce un HEX nuevo: todos
se construyen sobre la paleta cruda o se derivan de un token existente.

| Token | Claro | Oscuro | Uso |
|---|---|---|---|
| `--kibot-fg-muted` | `fg @ 62%` sobre surface | `White @ 60%` | texto secundario. `neutral-400` no llega a AA sobre blanco |
| `--kibot-accent-strong` | `#824699` (Primary 500) | `#E8ACFF` (Primary 100) | acento como **texto/ícono**: `--kibot-accent` en claro da 2.18:1 y falla AA |
| `--kibot-brand-ink` | `#1B1451` | `#FFFFFF` | trazo del logo/spinner de marca |
| `--kibot-brand-magenta` | `#D974FF` | igual | arco medio del spinner |
| `--kibot-brand-aqua` | `#29ABE2` | igual | arco interno del spinner |
| `--kibot-brand-gradient` | diagonal Tertiary base→100→50 | diagonal Tertiary 500→400→base | superficies de identidad (cortina de arranque). No usar como fondo de pantallas de trabajo |
| `--kibot-on-brand` | `#FFFFFF` | `#FFFFFF` | contenido sobre `--kibot-brand-gradient` |

Regla: `--kibot-accent` es para fondos/washes; para texto o íconos sobre superficie clara usar
`--kibot-accent-strong`.

Colores de estado (`--kibot-error`, `--kibot-success`, `--kibot-warning`) usan las mismas
variantes Base/100/200 en ambos modos — no cambian entre claro/oscuro; solo ajustar el
contraste de texto sobre ellos según fondo.

---

## 7. Botones

- **Radio:** `radius.6` (`--kibot-radius-6`, 12px) en todos los tamaños.
- **Outline:** borde `stroke.0` (`--kibot-stroke-0`, 1px) solid.
- **Variantes de color:** cada paleta (Primary/Secondary/etc.) expone 3 tonos utilizables en
  botones: `Base`, `400`, `200` — tanto en fill como en outline.
- **Fill:** fondo = color de paleta, texto = `neutral.white` (o `--kibot-fg` invertido según
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

- [ ] Fondo de pantalla → `var(--kibot-page)`
- [ ] Contenedores/cards → `var(--kibot-surface)` con `radius.6` o `radius.7`
- [ ] Texto principal → `var(--kibot-fg)`, tipografía de la sección 5 según jerarquía
- [ ] Elementos interactivos/CTA → `var(--kibot-accent)` o paleta Primary
- [ ] Espaciados → solo `var(--kibot-spacing-*)`
- [ ] Bordes/divisores → `var(--kibot-line)`, `var(--kibot-stroke-0)`
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

- ✅ Usar siempre un token semántico: `var(--kibot-page)`, `var(--kibot-surface)`,
  `var(--kibot-fg)`, `var(--kibot-accent)`, `var(--kibot-line)`.
- ✅ Usar las paletas de estado (`--kibot-error*`, `--kibot-success*`, `--kibot-warning*`) para
  feedback — nunca improvisar un rojo/verde/amarillo nuevo.
- ❌ Nunca un HEX o `rgb()` suelto en un componente de feature — ni siquiera si "se ve igual"
  a un token existente.
- ❌ Nunca `--kibot-color-*` (paleta cruda) directo en una pantalla — solo se usa para construir
  tokens semánticos en `_semantic.scss`.
- ❌ Nunca introducir un segundo color de acento. `--kibot-accent` es el único acento
  interactivo del sistema (igual que Apple con su único Action Blue): si un CTA necesita
  destacar más, se resuelve con tamaño/peso/spacing, no con un color nuevo.

### Tipografía

- ✅ Usar los mixins de `_typography.scss` (`kibot-heading1`… `kibot-subtitle-regular`) para
  cualquier texto con jerarquía.
- ✅ Cuerpo de texto en `BodyRegular` (16px/1rem) por default.
- ❌ Nunca un `font-size` en `px`/`rem` suelto en el SCSS de un componente.
- ❌ Nunca un peso de fuente fuera de 300/400/700 — no existe un 500/600 en esta escala.

### Espaciado, radios y bordes

- ✅ Todo padding/margin/gap sale de `var(--kibot-spacing-*)`.
- ✅ Todo `border-radius` sale de `var(--kibot-radius-*)`; botones siempre `radius.6` (12px).
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
- **Elevación / sombras.** No existe una escala de `box-shadow` (`--kibot-elevation-*`). Hoy el
  único caso de sombra observado en Android (`Theme.kt`) viene de los defaults de Material3, no
  de un token propio de Witag — pendiente de definir si KiBot necesita una escala explícita.
- ~~**Motion / transiciones.**~~ **Cerrado.** `src/styles/tokens/_motion.scss` define
  `--kibot-motion-fast|base|slow|pulse|curtain` y `--kibot-ease-standard|linear|settle`,
  portados 1:1 de `WitagMotion` (WitagAndroid, `presentation/theme/Brand.kt`), más un bloque
  `prefers-reduced-motion` que colapsa las duraciones decorativas. No usar duraciones ni
  curvas fuera de esos tokens.
- ~~**Tipografía de marca.**~~ **Cerrado.** Poppins, auto-hospedada en `public/fonts/` y
  declarada en `src/styles/_fonts.scss` — misma tipografía que WitagFrontend (ver sección 5).
  El stack de sistema queda solo como respaldo si el woff2 no carga.
- **Contraste de `--kibot-accent`.** En **claro** ya está medido y NO sirve como texto
  (`#E190FF` sobre `#FFFFFF` = 2.18:1): por eso existe `--kibot-accent-strong`. En oscuro: `#E8ACFF` sobre `#0E0A34` es
  la combinación que el agente `a11y-contrast-checker` marca como la más crítica a verificar —
  no asumir que pasa AA sin correr el agente.
- **Breakpoints / grid responsive.** No hay una escala oficial de breakpoints ni de columnas de
  grid — cada feature define su propio layout responsive por ahora.
- **Iconografía.** No hay una librería de íconos elegida (Material Symbols, Lucide, custom
  SVG...) ni un tamaño estándar más allá de la mención genérica a "íconos estándar
  16/20/24px" en las skills de auditoría. Provisional: `KiBotIcon`
  (`src/app/shared/ui/kibot-icon/`) dibuja SVG inline propio con `currentColor` y tamaño por
  `--kibot-icon-size`, para no depender de una webfont externa en la pantalla del robot (puede
  arrancar sin red). Migrar a la librería oficial cuando se decida.
- **Componentes reales aún no implementados.** `KiBotButton`, `KiBotCard`, `KiBotLoadingIndicator`,
  `KiBotErrorState` etc. están documentados como *patrón* en la skill `kibot-component`, pero
  todavía no existen como archivos en `src/app/shared/components/` — créalos la primera vez que
  una pantalla los necesite, siguiendo ese patrón.
- **Inconsistencia heredada de botones (sección 7).** Los 3 tamaños de botón comparten
  `font-size: 18px`, lo cual no coincide con la escala tipográfica de la sección 5. Se heredó
  tal cual de la versión Android — no "corregirla" silenciosamente sin validarlo con diseño.

---

## 11. Mapeo a Angular (SCSS / CSS custom properties)

Ver carpeta `src/styles/tokens/` y `src/app/core/theme/` para la implementación lista para
usar:

- `tokens/_colors.scss` — paleta cruda como CSS custom properties (`--kibot-color-*`)
- `tokens/_semantic.scss` — tokens semánticos light/dark (`--kibot-page`, `--kibot-surface`,
  `--kibot-fg`, `--kibot-accent`, `--kibot-line`) — equivalente a `WitagLightColors` /
  `WitagDarkColorScheme` de Android
- `tokens/_spacing.scss`, `_radius.scss`, `_stroke.scss` — escalas de la sección 1-3
- `tokens/_typography.scss` — mixins `kibot-heading1`, `kibot-body-regular`, etc. —
  equivalente a `WitagTextStyles`
- `tokens/_index.scss` — punto único de import (`@use "styles/tokens"` desde `styles.scss`)
- `core/theme/theme.service.ts` — `ThemeService` (signals) que resuelve `system/light/dark` y
  escribe `[data-theme]` en `<html>` — equivalente a `WitagTheme` / `WitagTheme.colors.*` de
  Android, pero vía CSS custom properties en vez de `CompositionLocal`

Componentes de UI reutilizables (`KiBotButton`, `KiBotCard`, etc., equivalentes a
`WitagButton`/`WitagCard`) deben vivir en `src/app/shared/components/` y consumir
exclusivamente estos tokens — ver skill `kibot-component`.
