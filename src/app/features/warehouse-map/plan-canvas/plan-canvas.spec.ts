import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { WarehouseMap, WarehouseRackFace } from '../warehouse-map.models';
import { PlanCanvas, PlanCanvasAction } from './plan-canvas';

function cara(side: string, gridSide: string, aisleId: string, segment: number): WarehouseRackFace {
  return { Side: side, X: 0, Z: 0, AisleId: aisleId, GridSide: gridSide, Tramo: 'INFERIOR', Segment: segment };
}

/** Dos pasillos y un bloque de dos segmentos entre ellos. */
function mapa(): WarehouseMap {
  return {
    MapId: 'map-1',
    Name: 'Prueba',
    CompanyId: 1,
    Version: 1,
    Unit: 'meter',
    Origin: { Description: 'esquina', X: 0, Z: 0 },
    Plane: { X: -2, Z: -2, Width: 10, Depth: 10 },
    Inventory: { X: 0, Z: 0, Width: 6, Depth: 6 },
    ResolvedWith: { ShelvingWidth: 1, ShelvingSlotSpacing: 1.3, FaceOffset: 0.5, GridSize: 4 },
    Walls: [],
    Aisles: [
      {
        AisleId: 'P1', Name: 'Pasillo 1', Number: 1,
        X: 1, Z: 2.6, Length: 5.2, Width: 1.6, Rotation: 90,
        Anchors: [
          { Ordinal: 1, X: 1, Z: 0 },
          { Ordinal: 2, X: 1, Z: 2.6 },
          { Ordinal: 3, X: 1, Z: 5.2 }
        ]
      },
      {
        AisleId: 'P2', Name: 'Pasillo 2', Number: 2,
        X: 3.6, Z: 2.6, Length: 5.2, Width: 1.6, Rotation: 90,
        Anchors: [
          { Ordinal: 1, X: 3.6, Z: 0 },
          { Ordinal: 2, X: 3.6, Z: 2.6 },
          { Ordinal: 3, X: 3.6, Z: 5.2 }
        ]
      }
    ],
    ShelvingUnits: [
      {
        RackId: 'B1-2-I01', Name: '', Length: 1.3, Levels: 4, Slots: 1,
        CenterX: 2.3, CenterZ: 0.65,
        Faces: [cara('left', 'A', 'P1', 1), cara('right', 'B', 'P2', 1)]
      },
      {
        RackId: 'B1-2-I02', Name: '', Length: 1.3, Levels: 4, Slots: 1,
        CenterX: 2.3, CenterZ: 1.95,
        Faces: [cara('left', 'A', 'P1', 2), cara('right', 'B', 'P2', 2)]
      }
    ]
  };
}

/**
 * El lienzo <b>no calcula geometría</b>: pinta lo que el backend ya resolvió, y cada gesto suyo se
 * traduce a una línea del plano. Lo que estos tests protegen es eso: que dibuje lo que le llega, y
 * que lo que pide cambiar sea lo que el usuario hizo.
 */
describe('PlanCanvas', () => {
  let fixture: ComponentFixture<PlanCanvas>;
  let svg: SVGSVGElement;
  let acciones: PlanCanvasAction[];

  const botones = () =>
    [...fixture.nativeElement.querySelectorAll('button')] as HTMLButtonElement[];

  const boton = (texto: string) => botones().find((b) => b.textContent?.includes(texto))!;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      imports: [PlanCanvas],
      providers: [provideZonelessChangeDetection()]
    });

    fixture = TestBed.createComponent(PlanCanvas);
    fixture.componentRef.setInput('map', mapa());
    fixture.componentRef.setInput('rejilla', {
      inferior: 2,
      superior: 0,
      largoSegmento: 1.3,
      hueco: 2
    });
    await fixture.whenStable();

    // Por clase y no por etiqueta: las figuras de la paleta tambien son <svg>.
    svg = fixture.nativeElement.querySelector('.lienzo__svg');
    acciones = [];
    fixture.componentInstance.accion.subscribe((a) => acciones.push(a));
  });

  // --- dibujar ------------------------------------------------------------------------------

  it('encuadra en metros, con el lienzo que calculó el backend', () => {
    // Una unidad del viewBox es un metro. Sin eso habría un factor de escala que mantener a mano.
    expect(svg.getAttribute('viewBox')).toBe('-2 -2 10 10');
  });

  it('dibuja cada estantería partida en sus dos celdas', () => {
    // Un bloque son DOS filas espalda contra espalda, y verlo es justo lo que costó entender.
    expect(svg.querySelectorAll('rect.celda').length).toBe(4);
    expect(svg.querySelectorAll('rect.calle__calzada').length).toBe(2);
  });

  it('el ancho de la celda sale del mapa, no de una constante escrita aquí', () => {
    // Replicar la constante del backend es lo que desincroniza los dos lados. Sale de ResolvedWith,
    // y cada celda es la mitad del bloque.
    const celda = svg.querySelector('rect.celda')!;
    expect(Number(celda.getAttribute('width'))).toBe(0.5);
    expect(Number(celda.getAttribute('x'))).toBeCloseTo(1.8, 6);
  });

  it('dibuja con la Z hacia arriba, como se lee el plano', () => {
    // En SVG la Y crece hacia abajo. Sin espejar, el tramo INFERIOR -el del extremo .1- saldría
    // arriba del todo y el plano se leería del revés. Con tramos simétricos no se nota; en cuanto
    // uno tiene 13 segmentos y el otro 8, sí.
    // Dos celdas por estanteria, asi que 0 y 1 son las dos caras de la MISMA: hay que comparar
    // la primera celda de un segmento con la del siguiente.
    const ys = [...svg.querySelectorAll('rect.celda')].map((r) => Number(r.getAttribute('y')));

    // El primer segmento es el de Z menor, así que tiene que quedar MÁS ABAJO en pantalla.
    expect(ys[0]).toBeGreaterThan(ys[2]);
  });

  it('pinta las tres anclas de cada pasillo', () => {
    expect(svg.querySelectorAll('circle.ancla').length).toBe(6);
    expect(svg.querySelectorAll('circle.ancla--transversal').length).toBe(2);
  });

  it('enseña la numeración impresa del plano', () => {
    const numeros = [...svg.querySelectorAll('text.numero')].map((t) => t.textContent?.trim());
    expect(numeros).toEqual(['1', '2']);
  });

  it('dibuja los muros que trae el mapa', async () => {
    const con = mapa();
    con.Walls = [
      { WallId: 'M01', Name: 'Muro 1', X: 3, Z: 0, Length: 6, Rotation: 0, Thickness: 0.2 }
    ];
    fixture.componentRef.setInput('map', con);
    await fixture.whenStable();

    expect(fixture.nativeElement.querySelectorAll('rect.muro').length).toBe(1);
  });

  // --- las piezas que se arrastran ------------------------------------------------------------

  it('sin arrastrar nada no hay huecos marcados', () => {
    expect(svg.querySelectorAll('g.hueco').length).toBe(0);
  });

  it('un bloque se suelta en un tramo, arriba o abajo', async () => {
    boton('Bloque').dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    await fixture.whenStable();

    // Tres columnas -antes del primero, entre los dos, despues del ultimo- por dos tramos cada una.
    // Que haya un hueco POR TRAMO es lo que permite un bloque de un solo tramo.
    expect(svg.querySelectorAll('g.hueco').length).toBe(6);
  });

  it('el plano crece por los dos lados', async () => {
    // Hacia la izquierda la numeración no cabe por debajo del 1, así que se corre entera. Un plano
    // se dibuja hacia donde haga falta, no solo hacia la derecha.
    boton('Pasillo').dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    await fixture.whenStable();

    expect(svg.querySelectorAll('g.hueco').length).toBe(2);
  });

  it('un pasillo también se suelta por tramo cuando hay dos', async () => {
    fixture.componentRef.setInput('rejilla', {
      inferior: 13,
      superior: 13,
      largoSegmento: 1.27,
      hueco: 1.96
    });
    await fixture.whenStable();

    boton('Pasillo').dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    await fixture.whenStable();

    // Tres por cada extremo -abajo, los dos y arriba-, que es lo que permite un pasillo que
    // recorre un solo tramo. Y dos mas para COMPLETAR: con este marco los dos pasillos del mapa se
    // quedan cortos, asi que se ofrece terminarlos en vez de abrir otro numero.
    expect(svg.querySelectorAll('g.hueco').length).toBe(8);
  });

  it('un pasillo que ya recorre todo el marco no se ofrece completar', async () => {
    // El marco del fixture lo cubren de sobra los pasillos, asi que no hay nada que terminar.
    boton('Pasillo').dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    await fixture.whenStable();

    // Un solo tramo declarado, asi que un hueco por cada extremo y ninguno de completar.
    expect(svg.querySelectorAll('g.hueco').length).toBe(2);
  });

  it('sin pasillos pero con estantería, el hueco va pegado a ella', async () => {
    // Es donde de verdad va a caer el pasillo, y el único sitio que le daría dirección a esas
    // caras. En el centro del lienzo prometía un sitio que no era.
    const soloBloque = mapa();
    soloBloque.Aisles = [];
    fixture.componentRef.setInput('map', soloBloque);
    await fixture.whenStable();

    boton('Pasillo').dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    await fixture.whenStable();

    const hueco = svg.querySelector('g.hueco rect')!;

    // Las estanterías del fixture tienen su centro en 2.3 y el bloque mide 1, así que su borde
    // derecho cae en 2.8: ahí empieza el pasillo.
    expect(Number(hueco.getAttribute('x'))).toBeCloseTo(2.8, 6);
  });

  it('los muros de los lados van por tramo: la transversal se queda libre', async () => {
    fixture.componentRef.setInput('rejilla', {
      inferior: 13,
      superior: 13,
      largoSegmento: 1.27,
      hueco: 1.96
    });
    await fixture.whenStable();

    boton('Muro').dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    await fixture.whenStable();

    // Los dos extremos de punta a punta, y los dos lados partidos por tramo: un muro que cruzara
    // la transversal la dejaría cerrada, y por ahí no pasa ningún muro de una bodega de verdad.
    expect(svg.querySelectorAll('g.hueco').length).toBe(6);
  });

  it('un muro encaja en los cuatro lados del recinto', async () => {
    boton('Muro').dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    await fixture.whenStable();

    expect(svg.querySelectorAll('g.hueco').length).toBe(4);
  });

  it('soltar fuera de todo hueco no cambia el plano', async () => {
    boton('Bloque').dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    await fixture.whenStable();

    // Sin layout real getScreenCTM no resuelve, así que el punto no cae en ningún hueco.
    fixture.nativeElement.dispatchEvent(
      new PointerEvent('pointerup', { bubbles: true, clientX: 0, clientY: 0 })
    );
    await fixture.whenStable();

    expect(acciones).toEqual([]);
  });

  // --- los bloques --------------------------------------------------------------------------

  it('junta las estanterías en el bloque al que pertenecen', async () => {
    // En el plano un bloque no es una entidad: es lo que hay entre dos pasillos. El lienzo lo
    // vuelve a juntar para poder hablar de él.
    svg.querySelector<SVGRectElement>('rect.bloque-zona')!.dispatchEvent(
      new MouseEvent('click', { bubbles: true })
    );
    await fixture.whenStable();

    expect(fixture.nativeElement.textContent).toContain('Bloque entre P1 y P2');
  });

  it('se puede dejar un bloque con un solo tramo', async () => {
    svg.querySelector<SVGRectElement>('rect.bloque-zona')!.dispatchEvent(
      new MouseEvent('click', { bubbles: true })
    );
    await fixture.whenStable();

    // Quitar el tramo de abajo deja el bloque solo con el de arriba. No toda bodega tiene los dos.
    boton('sin tramo').click();
    await fixture.whenStable();

    expect(acciones.at(-1)).toEqual({ tipo: 'poner-bloque', donde: [1, 2], inferior: 0, superior: 0 });
  });

  it('elegir un largo lo pide para ese tramo y deja el otro como estaba', async () => {
    svg.querySelector<SVGRectElement>('rect.bloque-zona')!.dispatchEvent(
      new MouseEvent('click', { bubbles: true })
    );
    await fixture.whenStable();

    // Los largos que dijo el cliente: 7, 13 o 14.
    const siete = botones().filter((b) => b.textContent?.trim() === '7');
    siete[siete.length - 1].click();
    await fixture.whenStable();

    expect(acciones.at(-1)).toEqual({ tipo: 'poner-bloque', donde: [1, 2], inferior: 2, superior: 7 });
  });

  // --- quitar -------------------------------------------------------------------------------

  it('quitar pasillo se refiere siempre al de numeración mayor', async () => {
    boton('Quitar pasillo').click();
    await fixture.whenStable();

    expect(acciones.at(-1)).toEqual({ tipo: 'quitar-pasillo', numero: 2 });
  });

  // --- resaltar (Buscar caja) ---------------------------------------------------------------

  it('sin nada que resaltar no apaga ninguna celda', () => {
    expect(svg.querySelectorAll('rect.celda--apagada').length).toBe(0);
    expect(svg.querySelectorAll('rect.celda--resaltada').length).toBe(0);
  });

  it('resalta solo la cara pedida —no la de la espalda— y apaga el resto', async () => {
    fixture.componentRef.setInput('resaltadas', [{ rackId: 'B1-2-I02', side: 'left' }]);
    await fixture.whenStable();

    // Una estantería son dos caras a pasillos distintos: señalar las dos mandaría a mirar al pasillo
    // equivocado la mitad de las veces.
    expect(svg.querySelectorAll('rect.celda--resaltada').length).toBe(1);
    expect(svg.querySelectorAll('rect.celda--apagada').length).toBe(3);
  });

  it('resalta varias caras a la vez, como las candidatas de una ambigua', async () => {
    fixture.componentRef.setInput('resaltadas', [
      { rackId: 'B1-2-I01', side: 'left' },
      { rackId: 'B1-2-I02', side: 'right' }
    ]);
    await fixture.whenStable();

    expect(svg.querySelectorAll('rect.celda--resaltada').length).toBe(2);
  });

  it('sin editable no se puede tocar nada', async () => {
    fixture.componentRef.setInput('editable', false);
    await fixture.whenStable();

    expect(fixture.nativeElement.querySelector('.paleta')).toBeNull();
    expect(botones().length).toBe(0);
  });
});
