import { mapaDePrueba as mapa } from './mapa-de-prueba';
import {
  anclasDeLaGeocerca,
  anclasDelMapa,
  carasDentro,
  conQuienSePisa,
  geocercaEntre,
  racksDentro,
  sePisan
} from './geofence';

describe('geocerca por anclas', () => {
  it('lista las anclas por pasillo y ordinal, con su nombre de plano', () => {
    expect(anclasDelMapa(mapa()).map((a) => a.etiqueta)).toEqual([
      'P1.1', 'P1.I', 'P1.S', 'P1.3', 'P2.1', 'P2.I', 'P2.S', 'P2.3', 'P3.1', 'P3.I', 'P3.S', 'P3.3'
    ]);
  });

  it('un plano anterior a .I/.S sigue nombrando sus anclas .1, .2 y .3', () => {
    const viejo = mapa();
    viejo.Aisles = viejo.Aisles.map((a) => ({
      ...a,
      Anchors: [
        { Ordinal: 1, X: a.X, Y: 0 },
        { Ordinal: 2, X: a.X, Y: 9.25 },
        { Ordinal: 3, X: a.X, Y: 18.5 }
      ]
    }));

    expect(anclasDelMapa(viejo).slice(0, 3).map((a) => a.etiqueta)).toEqual(['P1.1', 'P1.2', 'P1.3']);
  });

  it('dos anclas dan el rectángulo de esquina mínima a máxima, en cualquier orden', () => {
    const anclas = anclasDelMapa(mapa());
    const [p1_1, p3_i] = [anclas[0], anclas[9]];
    const esperado = [{ X: 0, Y: 0 }, { X: 7.12, Y: 8.25 }];

    expect(p3_i.etiqueta).toBe('P3.I');
    expect(geocercaEntre(p1_1, p3_i)).toEqual(esperado);
    expect(geocercaEntre(p3_i, p1_1)).toEqual(esperado);
  });

  it('entran los racks entre los pasillos del borde, y no la fila pegada por fuera', () => {
    const anclas = anclasDelMapa(mapa());
    const puntos = geocercaEntre(anclas[0], anclas[9]); // P1.1 → P3.I

    expect(racksDentro(mapa(), puntos).map((r) => r.RackId)).toEqual(['P1-P2-inf', 'P2-P3-inf']);
  });

  it('señala las dos caras de cada rack que entra', () => {
    const anclas = anclasDelMapa(mapa());
    const caras = carasDentro(mapa(), geocercaEntre(anclas[0], anclas[5])); // P1.1 → P2.I

    expect(caras).toEqual([
      { rackId: 'P1-P2-inf', side: 'left' },
      { rackId: 'P1-P2-inf', side: 'right' }
    ]);
  });

  it('dos geocercas vecinas que comparten un pasillo no se pisan; dos que se cruzan sí', () => {
    const a = [{ X: 0, Y: 0 }, { X: 3.56, Y: 9.25 }];
    const vecina = [{ X: 3.56, Y: 0 }, { X: 7.12, Y: 9.25 }];
    const cruzada = [{ X: 1, Y: 1 }, { X: 5, Y: 5 }];

    expect(sePisan(a, vecina)).toBeFalse();
    expect(sePisan(a, cruzada)).toBeTrue();
  });

  it('al comprobar solapes no se compara una zona consigo misma', () => {
    const m = mapa([
      { IdZone: 10, Name: 'A', Shape: 'rect', Points: [{ X: 0, Y: 0 }, { X: 3.56, Y: 9.25 }] },
      { IdZone: 20, Name: 'B', Shape: 'rect', Points: [{ X: 3.56, Y: 0 }, { X: 7.12, Y: 18.5 }] }
    ]);

    expect(conQuienSePisa(m, 10, [{ X: 0, Y: 0 }, { X: 3.56, Y: 9.25 }])).toEqual([]);
    expect(conQuienSePisa(m, 10, [{ X: 0, Y: 0 }, { X: 7.12, Y: 9.25 }]).map((z) => z.Name)).toEqual(['B']);
  });

  it('reconoce las anclas de una geocerca guardada, aunque las esquinas vengan cruzadas', () => {
    const anclas = anclasDelMapa(mapa());
    const zona = { IdZone: 10, Name: 'A', Shape: 'rect', Points: [{ X: 7.12, Y: 0 }, { X: 0, Y: 8.25 }] };

    expect(anclasDeLaGeocerca(anclas, zona)?.map((a) => a.etiqueta)).toEqual(['P1.1', 'P3.I']);
  });

  it('una geocerca dibujada a mano no sale de anclas', () => {
    const zona = { IdZone: 10, Name: 'A', Shape: 'rect', Points: [{ X: 0.5, Y: 0 }, { X: 3, Y: 4 }] };

    expect(anclasDeLaGeocerca(anclasDelMapa(mapa()), zona)).toBeNull();
  });
});
