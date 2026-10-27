import {
  avanceDe,
  haceCuanto,
  robotsDe,
  RobotInventory,
  RobotProgress,
  textoDeAviso,
  textoDeEstado,
  ubicacionDe
} from './robot.models';

function progreso(cambios: Partial<RobotProgress>): RobotProgress {
  return {
    IdInventory: 'inv-1',
    TotalSides: 1664,
    CoveredSides: 220,
    Readings: 56943,
    LastReadAt: null,
    Closed: false,
    Consolidated: false,
    ...cambios
  };
}

describe('avanceDe', () => {
  it('con ruta, el avance son los tramos hechos sobre los de la misión', () => {
    // Un recorrido de 10 tramos en un plano de 1.664 caras: contra el plano parecería un 13 %.
    expect(avanceDe(progreso({ TramosDone: 5, TramosTotal: 10 }))).toBe(50);
  });

  it('sin ruta —no llegó el inicio— vuelve a las caras del plano', () => {
    expect(avanceDe(progreso({ TotalSides: 10, CoveredSides: 4 }))).toBe(40);
  });

  it('no pasa del 100 % ni divide entre cero', () => {
    expect(avanceDe(progreso({ TramosDone: 12, TramosTotal: 10 }))).toBe(100);
    expect(avanceDe(progreso({ TotalSides: 0 }))).toBe(0);
    expect(avanceDe(null)).toBe(0);
  });
});

describe('ubicacionDe', () => {
  const pose = { X: 44.31, Y: 46.51, Heading: -1.53, Zone: 'AISLE', Cooler: 2, Aisle: 20, Tramo: 'SUPERIOR', Segment: 18 };

  it('en un pasillo da la dirección, con el segmento como lo numera el robot', () => {
    expect(ubicacionDe(pose)).toBe('Pasillo 20 · tramo superior · segmento 18');
  });

  it('fuera de un pasillo da la zona', () => {
    // El primer latido real (2026-10-27): en el dock, con la dirección a null.
    expect(ubicacionDe({ ...pose, Zone: 'DOCK', Aisle: null, Tramo: null, Segment: null })).toBe('En el dock');
    expect(ubicacionDe({ ...pose, Zone: 'CORRIDOR', Aisle: null })).toBe('En el corredor');
  });

  it('sin pose no inventa nada', () => {
    expect(ubicacionDe(null)).toBe('Sin posición');
  });
});

describe('textos del latido', () => {
  it('traduce lo conocido y enseña tal cual lo que no', () => {
    expect(textoDeEstado('CHARGING')).toBe('Cargando');
    expect(textoDeEstado('ALGO_NUEVO')).toBe('ALGO_NUEVO');
    expect(textoDeEstado(null)).toBe('Desconocido');
    expect(textoDeAviso('BATTERY_LOW')).toBe('Batería baja');
    expect(textoDeAviso('OTRO')).toBe('OTRO');
  });

  it('dice cuánto hace en la unidad que se lee', () => {
    expect(haceCuanto(12.4)).toBe('hace 12 s');
    expect(haceCuanto(600)).toBe('hace 10 min');
    expect(haceCuanto(7200)).toBe('hace 2 h');
  });
});

describe('robotsDe', () => {
  it('junta los robots de todos los inventarios, uno por id, sin puertas', () => {
    const inv = (id: string, devices: RobotInventory['Devices']): RobotInventory =>
      ({ _id: id, Name: id, EndDate: null, Devices: devices });

    expect(
      robotsDe([
        inv('a', [
          { Type: 'Robot', Name: 'R1', IdDevice: 7, IdZone: 1, Zone: 'Z1' },
          { Type: 'Robot', Name: 'R1', IdDevice: 7, IdZone: 2, Zone: 'Z2' },
          { Type: 'Portal Inventario', Name: 'P', IdDevice: 9, IdZone: 1, Zone: 'Z1' }
        ]),
        inv('b', [{ Type: 'robot', Name: 'R2', IdDevice: 8, IdZone: 1, Zone: 'Z1' }])
      ])
    ).toEqual([
      { IdDevice: 7, Name: 'R1' },
      { IdDevice: 8, Name: 'R2' }
    ]);
  });
});
