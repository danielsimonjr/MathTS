export const pointInPolygonDocs = {
  name: 'pointInPolygon',
  category: 'Geometry',
  syntax: ['pointInPolygon(point, polygon)'],
  description: 'Determine if a 2D point lies inside a polygon using the ray casting algorithm.',
  examples: ['pointInPolygon([0.5, 0.5], [[0,0], [1,0], [1,1], [0,1]])'],
  seealso: ['convexHull', 'polygonArea'],
};
