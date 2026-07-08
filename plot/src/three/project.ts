export interface Camera {
  azim: number; // degrees, rotation about the vertical (z) axis
  elev: number; // degrees, tilt toward the viewer
}

/**
 * Orthographic projection of a 3-D point to screen [x, y, depth].
 * Convention (azim=0, elev=0): world +x → screen +x, world +z → screen +y,
 * world +y → into the screen (depth). Depth increases away from the viewer.
 */
export function project(p: [number, number, number], cam: Camera): [number, number, number] {
  const az = (cam.azim * Math.PI) / 180;
  const el = (cam.elev * Math.PI) / 180;
  const [x, y, z] = p;
  // rotate about z (azimuth)
  const xa = x * Math.cos(az) - y * Math.sin(az);
  const ya = x * Math.sin(az) + y * Math.cos(az);
  // tilt about screen-x (elevation): screen-y gets z, depth gets ya
  const sx = xa;
  const sy = z * Math.cos(el) - ya * Math.sin(el);
  const depth = z * Math.sin(el) + ya * Math.cos(el);
  return [sx, sy, depth];
}
