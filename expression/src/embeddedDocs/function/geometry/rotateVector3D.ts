export const rotateVector3DDocs = {
  name: 'rotateVector3D',
  category: 'Geometry',
  syntax: ['rotateVector3D(v, axis, angle)'],
  description:
    "Rotate a 3D vector around an arbitrary axis by a given angle using Rodrigues' formula.",
  examples: ['rotateVector3D([1, 0, 0], [0, 0, 1], pi / 2)'],
  seealso: ['rotateVector2D', 'reflectVector'],
};
