export const intersectLines2DDocs = {
  name: 'intersectLines2D',
  category: 'Geometry',
  syntax: ['intersectLines2D(p1, d1, p2, d2)'],
  description:
    'Find the intersection point of two infinite 2D lines, each defined by a point and direction vector. Returns null if parallel.',
  examples: ['intersectLines2D([0, 0], [1, 1], [1, 0], [0, 1])'],
  seealso: ['intersectSegments2D', 'distancePointToLine2D'],
};
