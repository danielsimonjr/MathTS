export const polygonAreaDocs = {
  name: 'polygonArea',
  category: 'Geometry',
  syntax: ['polygonArea(vertices)'],
  description:
    'Compute the area of a simple polygon given ordered 2D vertices using the shoelace formula.',
  examples: ['polygonArea([[0,0], [1,0], [1,1], [0,1]])'],
  seealso: ['triangleArea', 'convexHull'],
};
