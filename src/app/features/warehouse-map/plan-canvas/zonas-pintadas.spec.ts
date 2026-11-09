import { mapaDePrueba } from '../../zones/mapa-de-prueba';
import { COLORES_DE_ZONA, zonasPintadasDe } from './plan-canvas';

describe('zonasPintadasDe', () => {
  const rect = (IdZone: number, Name: string, x0: number, x1: number) => ({
    IdZone,
    Name,
    Shape: 'rect',
    Points: [
      { X: x0, Y: 0 },
      { X: x1, Y: 8.25 }
    ]
  });

  it('da un color por zona según su IdZone, el mismo aunque cambie el orden del plano', () => {
    const a = zonasPintadasDe(mapaDePrueba([rect(30, 'B', 3.56, 7.12), rect(12, 'A', 0, 3.56)]));
    const b = zonasPintadasDe(mapaDePrueba([rect(12, 'A', 0, 3.56), rect(30, 'B', 3.56, 7.12)]));
    expect(a.map((z) => [z.idZone, z.color])).toEqual([
      [12, 0],
      [30, 1]
    ]);
    expect(b).toEqual(a);
  });

  it('deja fuera las zonas sin geocerca y usa el nombre del catálogo si lo hay', () => {
    const sinGeocerca = { IdZone: 5, Name: 'Vacía', Shape: 'rect', Points: [] };
    const zonas = zonasPintadasDe(mapaDePrueba([sinGeocerca, rect(12, 'A', 0, 3.56)]), (id) =>
      id === 12 ? 'Cocina' : null
    );
    expect(zonas.map((z) => z.nombre)).toEqual(['Cocina']);
  });

  it('repite los colores a partir del último', () => {
    const muchas = Array.from({ length: COLORES_DE_ZONA + 1 }, (_, i) => rect(i + 1, `Z${i + 1}`, 0, 3.56));
    expect(zonasPintadasDe(mapaDePrueba(muchas)).at(-1)!.color).toBe(0);
  });
});
