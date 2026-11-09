import { KiBotIconName } from '../../shared/ui/kibot-icon/kibot-icon';

export interface KiBotNavItem {
  /** Ruta hija del shell, sin slash inicial. */
  readonly path: string;
  readonly label: string;
  /** El nombre largo: el de la tarjeta del Inicio y el título de la pantalla. */
  readonly titulo: string;
  /** Qué se hace ahí, en una línea, para quien entra por primera vez. */
  readonly descripcion: string;
  readonly icon: KiBotIconName;
}

/**
 * Los módulos de KiBot. Una entrada aquí = una ruta lazy en `app.routes.ts`; el mismo arreglo pinta
 * el riel y las tarjetas del Inicio, así que no hay otra fuente de verdad.
 *
 * <p>Seis desde noviembre de 2026: «Buscar con el robot» entró en Buscar; «Ubicación» y «Recorrido»
 * en Control; «Zonas» y «Mapa» en Planos y zonas. Las rutas viejas redirigen (`app.routes.ts`).</p>
 */
export const KIBOT_NAV_ITEMS: readonly KiBotNavItem[] = [
  {
    path: 'inicio',
    label: 'Inicio',
    titulo: 'Inicio',
    descripcion: 'El estado del robot de un vistazo y el acceso a cada módulo.',
    icon: 'home'
  },
  {
    path: 'inventarios',
    label: 'Inventarios',
    titulo: 'Inventarios',
    descripcion: 'Crea un inventario con su plano, zonas y robot; edita su nombre y sus zonas, o ciérralo.',
    icon: 'inventory'
  },
  {
    path: 'control',
    label: 'Control',
    titulo: 'Control del recorrido',
    descripcion: 'Inicia, pausa o detén el recorrido y síguelo: avance, ubicación del robot y su ruta en el plano.',
    icon: 'control'
  },
  {
    path: 'buscar',
    label: 'Buscar',
    titulo: 'Buscar cajas',
    descripcion: 'Encuentra dónde quedó una caja según el último recorrido, o manda al robot a buscarla.',
    icon: 'search'
  },
  {
    path: 'estado',
    label: 'Estado',
    titulo: 'Estado del equipo',
    descripcion: 'Batería, conexión, sensores y avisos de cada robot.',
    icon: 'status'
  },
  {
    path: 'planos',
    label: 'Planos y zonas',
    titulo: 'Planos y zonas',
    descripcion: 'Dibuja el plano de la bodega, administra las zonas y marca su geocerca en el plano.',
    icon: 'map'
  }
];
