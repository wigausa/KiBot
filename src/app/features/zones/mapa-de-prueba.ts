import { WarehouseMap, WarehouseShelvingUnit } from '../warehouse-map/warehouse-map.models';

/** Un estante con sus dos caras, centrado donde se diga. */
function rack(id: string, x: number, y: number): WarehouseShelvingUnit {
  return {
    RackId: id,
    Name: id,
    Length: 1.27,
    Levels: 4,
    Slots: 1,
    CenterX: x,
    CenterY: y,
    Faces: [
      { Side: 'left', X: x - 0.98, Y: y, AisleId: null, GridSide: 'B', Tramo: 'INFERIOR', Segment: 1 },
      { Side: 'right', X: x + 0.98, Y: y, AisleId: null, GridSide: 'A', Tramo: 'INFERIOR', Segment: 1 }
    ]
  };
}

/**
 * Tres pasillos (x = 0, 3.56, 7.12) con anclas en y = 0 (.1), 8.25 (.I), 10.25 (.S) y 18.5 (.3);
 * la transversal queda entre .I y .S. Estanterías:
 * dos en el tramo inferior entre P1-P2 y P2-P3, una en el superior entre P1-P2 y una pegada por
 * fuera de P1.
 */
export function mapaDePrueba(zonas: WarehouseMap['Zones'] = []): WarehouseMap {
  const pasillo = (n: number, x: number) => ({
    AisleId: `P${n}`,
    Name: `P${n}`,
    Number: n,
    X: x,
    Y: 9.25,
    Length: 18.5,
    Width: 1.6,
    Rotation: 90,
    Anchors: [
      { Ordinal: 4, Code: '3', X: x, Y: 18.5 },
      { Ordinal: 1, Code: '1', X: x, Y: 0 },
      { Ordinal: 2, Code: 'I', X: x, Y: 8.25 },
      { Ordinal: 3, Code: 'S', X: x, Y: 10.25 }
    ]
  });

  return {
    MapId: 'map-1',
    Name: 'Prueba',
    CompanyId: 1,
    Version: 3,
    Unit: 'meter',
    Origin: { Description: 'esquina', X: 0, Y: 0 },
    Plane: { X: -4, Y: -2, Width: 16, Depth: 22 },
    Inventory: { X: -2, Y: 0, Width: 12, Depth: 18.5 },
    Aisles: [pasillo(2, 3.56), pasillo(1, 0), pasillo(3, 7.12)],
    ShelvingUnits: [
      rack('P1-P2-inf', 1.78, 0.635),
      rack('P2-P3-inf', 5.34, 0.635),
      rack('P1-P2-sup', 1.78, 17.0),
      rack('fuera-P1', -1.78, 0.635)
    ],
    Walls: [],
    ResolvedWith: { ShelvingWidth: 1.96, ShelvingSlotSpacing: 1.27, FaceOffset: 0.98, GridSize: 1 },
    Zones: zonas
  };
}
