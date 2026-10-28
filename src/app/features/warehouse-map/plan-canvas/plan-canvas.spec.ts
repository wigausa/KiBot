import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { WarehouseMap, WarehouseRackFace } from '../warehouse-map.models';
import { GeocercaElegida, PlanCanvas, PlanCanvasAction } from './plan-canvas';

function cara(side: string, gridSide: string, aisleId: string, segment: number): WarehouseRackFace {
  return { Side: side, X: 0, Y: 0, AisleId: aisleId, GridSide: gridSide, Tramo: 'INFERIOR', Segment: segment };
}

/** Dos pasillos y un bloque de dos segmentos entre ellos. */
function mapa(): WarehouseMap {
  return {
    MapId: 'map-1',
    Name: 'Prueba',
    CompanyId: 1,
    Version: 1,
    Unit: 'meter',
    Origin: { Description: 'esquina', X: 0, Y: 0 },
    Plane: { X: -2, Y: -2, Width: 10, Depth: 10 },
    Inventory: { X: 0, Y: 0, Width: 6, Depth: 6 },
    ResolvedWith: { ShelvingWidth: 1, ShelvingSlotSpacing: 1.3, FaceOffset: 0.5, GridSize: 4 },
    Walls: [],
    Aisles: [
      {
        AisleId: 'P1', Name: 'Pasillo 1', Number: 1,
        X: 1, Y: 2.6, Length: 5.2, Width: 1.6, Rotation: 90,
        Anchors: [
          { Ordinal: 1, X: 1, Y: 0 },
          { Ordinal: 2, X: 1, Y: 2.6 },
          { Ordinal: 3, X: 1, Y: 5.2 }
        ]
      },
      {
        AisleId: 'P2', Name: 'Pasillo 2', Number: 2,
        X: 3.6, Y: 2.6, Length: 5.2, Width: 1.6, Rotation: 90,
        Anchors: [
          { Ordinal: 1, X: 3.6, Y: 0 },
          { Ordinal: 2, X: 3.6, Y: 2.6 },
          { Ordinal: 3, X: 3.6, Y: 5.2 }
        ]
      }
    ],
    ShelvingUnits: [
      {
        RackId: 'B1-2-I01', Name: '', Length: 1.3, Levels: 4, Slots: 1,
        CenterX: 2.3, CenterY: 0.65,
        Faces: [cara('left', 'A', 'P1', 1), cara('right', 'B', 'P2', 1)]
      },
      {
        RackId: 'B1-2-I02', Name: '', Length: 1.3, Levels: 4, Slots: 1,
        CenterX: 2.3, CenterY: 1.95,
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

  // --- zoom ---------------------------------------------------------------------------------

  it('acercar enseña un trozo del plano alrededor del centro, y ajustar vuelve a enseñarlo entero', async () => {
    (fixture.nativeElement.querySelector('button[aria-label="Acercar"]') as HTMLButtonElement).click();
    await fixture.whenStable();

    // 10 m / 1,5 alrededor del centro (3, 3).
    const [x, y, ancho, alto] = svg.getAttribute('viewBox')!.split(' ').map(Number);
    expect(ancho).toBeCloseTo(10 / 1.5, 6);
    expect(alto).toBeCloseTo(10 / 1.5, 6);
    expect(x + ancho / 2).toBeCloseTo(3, 6);
    expect(y + alto / 2).toBeCloseTo(3, 6);

    boton('Ajustar').click();
    await fixture.whenStable();

    expect(svg.getAttribute('viewBox')).toBe('-2 -2 10 10');
  });

  it('con el plano entero no se puede alejar más', () => {
    const botonAlejar = fixture.nativeElement.querySelector('button[aria-label="Alejar"]') as HTMLButtonElement;
    expect(botonAlejar.disabled).toBeTrue();
  });

  it('alejar desde el zoom vuelve al plano entero, sin pasarse', async () => {
    (fixture.nativeElement.querySelector('button[aria-label="Acercar"]') as HTMLButtonElement).click();
    await fixture.whenStable();
    (fixture.nativeElement.querySelector('button[aria-label="Alejar"]') as HTMLButtonElement).click();
    await fixture.whenStable();

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

  it('dibuja con la Y hacia arriba, como se lee el plano', () => {
    // En SVG la Y crece hacia abajo. Sin espejar, el tramo INFERIOR -el del extremo .1- saldría
    // arriba del todo y el plano se leería del revés. Con tramos simétricos no se nota; en cuanto
    // uno tiene 13 segmentos y el otro 8, sí.
    // Dos celdas por estanteria, asi que 0 y 1 son las dos caras de la MISMA: hay que comparar
    // la primera celda de un segmento con la del siguiente.
    const ys = [...svg.querySelectorAll('rect.celda')].map((r) => Number(r.getAttribute('y')));

    // El primer segmento es el de Y menor, así que tiene que quedar MÁS ABAJO en pantalla.
    expect(ys[0]).toBeGreaterThan(ys[2]);
  });

  it('pinta las tres anclas de cada pasillo', () => {
    expect(svg.querySelectorAll('circle.ancla').length).toBe(6);
    expect(svg.querySelectorAll('circle.ancla--transversal').length).toBe(2);
  });

  it('con anclas .1/.I/.S/.3, las dos de junto a la transversal se distinguen', async () => {
    const con = mapa();
    con.Aisles = con.Aisles.map((a) => ({
      ...a,
      Anchors: [
        { Ordinal: 1, Code: '1', X: a.X, Y: 0 },
        { Ordinal: 2, Code: 'I', X: a.X, Y: 2 },
        { Ordinal: 3, Code: 'S', X: a.X, Y: 3 },
        { Ordinal: 4, Code: '3', X: a.X, Y: 5.2 }
      ]
    }));
    fixture.componentRef.setInput('map', con);
    await fixture.whenStable();

    expect(svg.querySelectorAll('circle.ancla').length).toBe(8);
    expect(svg.querySelectorAll('circle.ancla--transversal').length).toBe(4);
  });

  it('sin espejo no transforma nada', () => {
    expect(svg.querySelector(':scope > g')!.getAttribute('transform')).toBeNull();
    expect(svg.querySelector('text.numero')!.getAttribute('transform')).toBeNull();
  });

  it('con la numeración hacia la izquierda dibuja en espejo y endereza los textos', async () => {
    // El cooler 2 del 7000 numera hacia la izquierda: así se ve como el plano del cliente. El eje
    // del espejo es el centro del lienzo (-2 + 10 / 2 = 3, o sea 2·X + ancho = 6).
    fixture.componentRef.setInput('map', { ...mapa(), AisleNumberingTowards: 'izquierda' });
    await fixture.whenStable();

    expect(svg.querySelector(':scope > g')!.getAttribute('transform')).toBe('matrix(-1 0 0 1 6 0)');
    const numero = svg.querySelector('text.numero')!;
    const x = Number(numero.getAttribute('x'));
    expect(numero.getAttribute('transform')).toBe(`matrix(-1 0 0 1 ${2 * x} 0)`);
    // Las coordenadas no cambian: el espejo es solo del dibujo.
    expect(Number(svg.querySelector('rect.celda')!.getAttribute('x'))).toBeCloseTo(1.8, 6);
  });

  it('enseña la numeración impresa del plano', () => {
    const numeros = [...svg.querySelectorAll('text.numero')].map((t) => t.textContent?.trim());
    expect(numeros).toEqual(['1', '2']);
  });

  it('dibuja los muros que trae el mapa', async () => {
    const con = mapa();
    con.Walls = [
      { WallId: 'M01', Name: 'Muro 1', X: 3, Y: 0, Length: 6, Rotation: 0, Thickness: 0.2 }
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

  it('un muro se suelta en cada columna vacía, por tramo o cerrado, y nunca al lado de un bloque', async () => {
    fixture.componentRef.setInput('rejilla', {
      inferior: 13,
      superior: 13,
      largoSegmento: 1.27,
      hueco: 1.96
    });
    await fixture.whenStable();

    boton('Muro').dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    await fixture.whenStable();

    // El norte y el sur, y tres franjas -abajo, cerrado, arriba- en las dos columnas vacías: antes
    // del 1 y después del 2. La del medio tiene el bloque del fixture y no ofrece nada.
    expect(svg.querySelectorAll('g.hueco').length).toBe(2 + 2 * 3);
  });

  it('con un solo tramo, un muro va al norte, al sur o a una de las columnas vacías', async () => {
    boton('Muro').dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    await fixture.whenStable();

    expect(svg.querySelectorAll('g.hueco').length).toBe(2 + 2);
  });

  /** El fixture con un muro entre el 1 y el 2: la columna mide 0,2 y el 2 queda pegado a él. */
  function conMuroEntre(): WarehouseMap {
    const m = mapa();
    m.ShelvingUnits = [];
    m.Aisles = m.Aisles.map((a) => (a.Number === 2 ? { ...a, X: 1 + 1.6 + 0.2 } : a));
    m.Walls = [{ WallId: 'ME1-2.inferior', Name: 'Muro entre 1 y 2', X: 1.9, Y: 1.3, Length: 2.6, Rotation: 90, Thickness: 0.2 }];
    return m;
  }

  it('al lado de un muro solo van pasillos: su columna no ofrece sitio para un bloque', async () => {
    fixture.componentRef.setInput('map', conMuroEntre());
    await fixture.whenStable();

    boton('Bloque').dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    await fixture.whenStable();

    // Dos franjas -abajo y arriba- por columna, y solo quedan las de los extremos.
    expect(svg.querySelectorAll('g.hueco').length).toBe(2 * 2);
  });

  /** El fixture con un muro en un extremo, tal como lo devuelve el backend. */
  function conMuro(wallId: 'MI.ambos' | 'MF.ambos', x: number): WarehouseMap {
    const m = mapa();
    m.Walls = [{ WallId: wallId, Name: 'Muro', X: x, Y: 2.6, Length: 5.2, Rotation: 90, Thickness: 0.2 }];
    return m;
  }

  it('con un muro en un extremo, ese extremo tampoco ofrece bloque', async () => {
    fixture.componentRef.setInput('map', conMuro('MI.ambos', 0.1));
    await fixture.whenStable();

    boton('Bloque').dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    await fixture.whenStable();

    expect(svg.querySelectorAll('g.hueco').length).toBe(2 * 2);
  });

  it('las sombras salen del mapa que se ve, no del plano escrito', async () => {
    // Un backend que todavía no entiende los muros de columna los ignora sin error: el plano dice
    // que hay muro y el mapa no lo trae. Las sombras tienen que caer sobre lo que se ve.
    fixture.componentRef.setInput('rejilla', { inferior: 2, superior: 0, largoSegmento: 1.3, hueco: 2 });
    await fixture.whenStable();

    boton('Bloque').dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    await fixture.whenStable();

    // Sin muros en el mapa, las tres columnas son de bloque.
    expect(svg.querySelectorAll('g.hueco').length).toBe(3 * 2);
  });

  it('con un muro final, el pasillo nuevo cae pegado al otro lado del muro', async () => {
    fixture.componentRef.setInput('map', conMuro('MF.ambos', 4.5));
    await fixture.whenStable();

    boton('Pasillo').dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    await fixture.whenStable();

    // El 2 está en 3,6 y mide 1,6: su borde cae en 4,4, el muro ocupa hasta 4,6 y ahí empieza el nuevo.
    const xs = [...svg.querySelectorAll('g.hueco rect')].map((r) => Number(r.getAttribute('x')));
    expect(xs.some((x) => Math.abs(x - 4.6) < 1e-6)).toBeTrue();
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
    // La tarjeta pone arriba primero, como el plano: el segundo «Ninguno» es el de abajo.
    botones().filter((b) => b.textContent?.includes('Ninguno'))[1].click();
    await fixture.whenStable();

    expect(acciones.at(-1)).toEqual({ tipo: 'poner-bloque', donde: [1, 2], inferior: 0, superior: 0 });
  });

  it('elegir un largo lo pide para ese tramo y deja el otro como estaba', async () => {
    svg.querySelector<SVGRectElement>('rect.bloque-zona')!.dispatchEvent(
      new MouseEvent('click', { bubbles: true })
    );
    await fixture.whenStable();

    // Los largos que dijo el cliente y el CAD: 7, 9, 13 o 14. La primera fila es la de arriba.
    const arriba = fixture.nativeElement.querySelectorAll('.edicion__fila')[0] as HTMLElement;
    [...arriba.querySelectorAll('button')].find((b) => b.textContent?.trim() === '7')!.click();
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

  it('sin editable no se puede cambiar nada del plano, pero sí acercarse a mirarlo', async () => {
    fixture.componentRef.setInput('editable', false);
    await fixture.whenStable();

    expect(fixture.nativeElement.querySelector('.paleta')).toBeNull();
    // Solo quedan los del zoom, que no tocan el plano: mirar de cerca sirve también en Zonas y en
    // Buscar caja.
    expect(botones().filter((b) => !b.closest('.zoom')).length).toBe(0);
    expect(fixture.nativeElement.querySelectorAll('.zoom button').length).toBe(3);
  });

  // --- elegir una geocerca ------------------------------------------------------------------

  describe('modo geocerca', () => {
    let elegidas: GeocercaElegida[];

    beforeEach(async () => {
      elegidas = [];
      // Como la pantalla de Zonas: lo que el lienzo elige le vuelve como entrada.
      fixture.componentInstance.geocercaCambia.subscribe((g) => {
        elegidas.push(g);
        fixture.componentRef.setInput('geocerca', g);
      });
      fixture.componentRef.setInput('editable', false);
      fixture.componentRef.setInput('geocerca', { desde: null, hasta: null });
      await fixture.whenStable();
    });

    const ancla = (id: string) =>
      [...fixture.nativeElement.querySelectorAll('g.ancla-elegible')].find(
        (g) => (g as Element).querySelector('title')?.textContent?.trim() === id
      ) as SVGGElement;

    it('sin geocerca las anclas son solo dibujo; con ella, se pueden pulsar', async () => {
      expect(ancla('P1.1')).toBeTruthy();

      fixture.componentRef.setInput('geocerca', null);
      await fixture.whenStable();
      expect(fixture.nativeElement.querySelectorAll('g.ancla-elegible').length).toBe(0);
    });

    it('pulsar un ancla la pone como primera, y pulsar otra completa la geocerca', async () => {
      ancla('P1.1').dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
      // Soltar sin estar sobre otra ancla deja la primera esperando a la segunda.
      fixture.nativeElement.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, clientX: 0, clientY: 0 }));
      ancla('P2.3').dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));

      expect(elegidas[0]).toEqual({ desde: 'P1.1', hasta: null });
      expect(elegidas.at(-1)).toEqual({ desde: 'P1.1', hasta: 'P2.3' });
    });

    it('dibuja el rectángulo de la geocerca, y lo marca si el robot no la aceptaría', async () => {
      fixture.componentRef.setInput('geocerca', { desde: 'P1.1', hasta: 'P2.3' });
      await fixture.whenStable();
      expect(svg.querySelector('rect.geocerca')).toBeTruthy();
      expect(svg.querySelector('rect.geocerca--invalida')).toBeNull();

      // .1 con .2 no es ninguno de los pares que recorre el robot.
      fixture.componentRef.setInput('geocerca', { desde: 'P1.1', hasta: 'P2.2' });
      await fixture.whenStable();
      expect(svg.querySelector('rect.geocerca--invalida')).toBeTruthy();
    });

    it('si la pantalla borra la primera ancla, la siguiente que se pulse empieza de cero', async () => {
      ancla('P1.1').dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
      fixture.nativeElement.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, clientX: 0, clientY: 0 }));
      fixture.componentRef.setInput('geocerca', { desde: null, hasta: null });   // «Empezar de nuevo»
      await fixture.whenStable();

      ancla('P2.3').dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
      fixture.nativeElement.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, clientX: 0, clientY: 0 }));

      expect(elegidas.at(-1)).toEqual({ desde: 'P2.3', hasta: null });
    });

    it('mientras se arrastra la pantalla no se entera: solo al soltar', async () => {
      // Si se enterase en vivo, sus avisos cambiarían de alto y el lienzo saltaría bajo el cursor.
      ancla('P1.1').dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
      expect(elegidas).toEqual([]);

      fixture.nativeElement.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, clientX: 0, clientY: 0 }));
      expect(elegidas).toEqual([{ desde: 'P1.1', hasta: null }]);
    });

    it('Esc a medio arrastre lo cancela y deja la geocerca como estaba', async () => {
      fixture.componentRef.setInput('geocerca', { desde: 'P1.1', hasta: 'P2.3' });
      await fixture.whenStable();

      ancla('P2.1').dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
      await fixture.whenStable();

      expect(elegidas).toEqual([]);
      expect(svg.querySelector('rect.geocerca')).toBeTruthy();   // la que ya había, P1.1 → P2.3
    });
  });
});
