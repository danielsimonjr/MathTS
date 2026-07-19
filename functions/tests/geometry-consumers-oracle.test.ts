/**
 * Voronoi / alpha-shape / spherical-Voronoi — oracle tests.
 *
 * Consumers of the Delaunay/convex-hull foundation. Pinned with
 * implementation-independent invariants and, for the spherical Voronoi,
 * scipy.spatial.SphericalVoronoi facts (vertex count = 2N−4, areas sum to
 * 4πr²) generated with SciPy 1.17.1.
 */

import { describe, it, expect } from 'vitest';
import { voronoi } from '../src/geometry/voronoi.js';
import { alphaShape } from '../src/geometry/alpha-shape.js';
import { sphericalVoronoi } from '../src/geometry/spherical-voronoi.js';
import { delaunay } from '../src/geometry/delaunay.js';

const RANDOM20_2D = [
  [0.08564916714362436, 0.2368105065960997],
  [0.8012744652063969, 0.5821620360643678],
  [0.09412864224039919, 0.4331269402364738],
  [0.479051298140834, 0.15973891463707857],
  [0.7345771514092145, 0.11367201992140341],
  [0.39122819049566204, 0.5167401826213637],
  [0.4306280204141778, 0.5867985714381407],
  [0.7378377872921602, 0.9562672548360985],
  [0.28420116374879145, 0.648547207079825],
  [0.6962159966701554, 0.2927207490124871],
  [0.0014900835088361708, 0.9734602747664127],
  [0.29840122301687566, 0.3139860020343368],
  [0.8917110704451572, 0.5851629398909081],
  [0.47130966518183137, 0.7732770096488164],
  [0.030346007662471197, 0.7069650956556235],
  [0.3742438334784708, 0.09085271350425783],
  [0.6605000674278948, 0.9314638547413545],
  [0.20719116808100124, 0.630090199785343],
  [0.29816309065742475, 0.7417566800693304],
  [0.7221648081421175, 0.21871542456880455],
];

// 25 points on the unit sphere (seed 11), scipy.spatial.SphericalVoronoi oracle.
const SPHERE25 = [
  [0.018681436816318283, 0.742906754880426, 0.669134184952101],
  [-0.6442915638816851, -0.3762033705437209, -0.6658523895747738],
  [0.6054175337735679, -0.05957666161708024, 0.7936751421016629],
  [-0.7620842566379824, 0.6462546051008533, -0.03978154308814695],
  [0.8604248818876323, -0.17270545711195887, -0.4794182388190954],
  [0.4788572553133039, 0.8525493933395604, -0.2094164772651781],
  [-0.13660044365312388, 0.6130576425526639, -0.7781392199995704],
  [-0.8894258974204567, 0.23198027241791414, -0.3938359127945612],
  [-0.8983919201214413, -0.3808382939970124, -0.2187559180592721],
  [-0.6243349842015175, -0.780921455579804, 0.019170490792130793],
  [0.7549934662249241, -0.19616978705505048, -0.6257014308793376],
  [0.44376813837648554, 0.8267312141219905, -0.3458111319177681],
  [0.4559393266627619, 0.8729870494850291, -0.17324243658448926],
  [-0.8855399782758943, 0.37842977493354335, 0.2694621537783672],
  [0.6053105794662877, -0.7076458864888837, -0.36446728484398805],
  [-0.4342590903114206, -0.8984029972603691, 0.06550646529528599],
  [0.3186021387447669, -0.44596098049047256, 0.836427809836113],
  [0.7409447651250767, 0.5655646110255512, 0.36212915622642455],
  [0.5459289755848353, -0.7608972979284437, 0.35070907547721814],
  [0.31731255376898804, -0.9305588152252603, 0.18268287995092203],
  [-0.26905816033506114, 0.8396850413315329, -0.47173799690206697],
  [-0.019381991189871387, 0.3643000354433765, -0.9310799227743396],
  [0.7652496784989465, -0.13418559311370626, 0.6295928495130657],
  [-0.3869799604336708, 0.8054963952116629, 0.4488006991123911],
  [-0.1253186024249078, 0.44485873738394166, 0.8867896885166365],
];

describe('voronoi — dual of Delaunay (invariants)', () => {
  it('one Voronoi vertex per Delaunay triangle', () => {
    const v = voronoi(RANDOM20_2D);
    const d = delaunay(RANDOM20_2D);
    expect(v.vertices.length).toBe(d.simplices.length);
    expect(v.vertices.length).toBe(31); // scipy Voronoi/Delaunay count
  });

  it('each Voronoi vertex is the circumcenter of its Delaunay triangle (equidistant to its 3 generators)', () => {
    const v = voronoi(RANDOM20_2D);
    for (let k = 0; k < v.vertices.length; k++) {
      const [cx, cy] = v.vertices[k];
      const [i, j, l] = v.simplices[k];
      const di = Math.hypot(RANDOM20_2D[i][0] - cx, RANDOM20_2D[i][1] - cy);
      const dj = Math.hypot(RANDOM20_2D[j][0] - cx, RANDOM20_2D[j][1] - cy);
      const dl = Math.hypot(RANDOM20_2D[l][0] - cx, RANDOM20_2D[l][1] - cy);
      expect(dj).toBeCloseTo(di, 9);
      expect(dl).toBeCloseTo(di, 9);
    }
  });

  it('dual empty-circumcircle: a vertex generators are its nearest generators', () => {
    const v = voronoi(RANDOM20_2D);
    const EPS = 1e-9;
    for (let k = 0; k < v.vertices.length; k++) {
      const [cx, cy] = v.vertices[k];
      const [i] = v.simplices[k];
      const r = Math.hypot(RANDOM20_2D[i][0] - cx, RANDOM20_2D[i][1] - cy);
      for (let p = 0; p < RANDOM20_2D.length; p++) {
        const dp = Math.hypot(RANDOM20_2D[p][0] - cx, RANDOM20_2D[p][1] - cy);
        expect(dp).toBeGreaterThan(r - EPS);
      }
    }
  });

  it('each interior generator has a non-empty region', () => {
    const v = voronoi(RANDOM20_2D);
    // point 5 (0.39,0.52) is well inside — must have a bounded, non-empty cell
    expect(v.regions[5].length).toBeGreaterThanOrEqual(3);
  });
});

// Deterministic annulus: concentric rings between r=1 and r=2, in GENERAL
// POSITION (a tiny deterministic jitter breaks the exact cocircularity of each
// ring — perfectly-cocircular points are a Delaunay degeneracy that Bowyer–
// Watson, like Qhull without joggle, does not resolve; see the geometry
// module's "Known limitations" note).
function annulus(): number[][] {
  const pts: number[][] = [];
  let seed = 1;
  const rand = (): number => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647 - 0.5;
  };
  for (const r of [1.0, 1.35, 1.7, 2.0]) {
    const m = Math.max(8, Math.round((2 * Math.PI * r) / 0.32));
    for (let k = 0; k < m; k++) {
      const th = (2 * Math.PI * k) / m;
      pts.push([r * Math.cos(th) + 1e-3 * rand(), r * Math.sin(th) + 1e-3 * rand()]);
    }
  }
  return pts;
}

describe('alphaShape — annulus recovers the hole', () => {
  it('alpha=1.6 yields exactly two boundary loops (outer + inner hole)', () => {
    const pts = annulus();
    const { edges } = alphaShape(pts, 1.6);
    // Union-find over boundary-edge vertices → connected components = loops.
    const parent = new Map<number, number>();
    const find = (x: number): number => {
      if (!parent.has(x)) parent.set(x, x);
      let r = x;
      while (parent.get(r) !== r) r = parent.get(r)!;
      while (parent.get(x) !== r) {
        const nx = parent.get(x)!;
        parent.set(x, r);
        x = nx;
      }
      return r;
    };
    for (const [a, b] of edges) parent.set(find(a), find(b));
    const verts = new Set<number>();
    for (const [a, b] of edges) {
      verts.add(a);
      verts.add(b);
    }
    const roots = new Set<number>();
    for (const v of verts) roots.add(find(v));
    expect(roots.size).toBe(2);

    // Each boundary vertex has degree 2 (simple closed loops).
    const deg = new Map<number, number>();
    for (const [a, b] of edges) {
      deg.set(a, (deg.get(a) ?? 0) + 1);
      deg.set(b, (deg.get(b) ?? 0) + 1);
    }
    for (const d of deg.values()) expect(d).toBe(2);
  });

  it('small alpha recovers (nearly) the convex hull boundary; large alpha opens the hole', () => {
    const pts = annulus();
    const loose = alphaShape(pts, 0.4); // 1/alpha = 2.5 (>= any circumradius): full disk
    const tight = alphaShape(pts, 1.6);
    // Full disk: single outer boundary loop (fewer boundary edges than the holed shape).
    expect(loose.edges.length).toBeLessThan(tight.edges.length);
    expect(tight.triangles.length).toBeLessThan(loose.triangles.length);
  });

  it('throws on non-positive alpha', () => {
    expect(() => alphaShape(annulus(), 0)).toThrow(/positive/);
  });
});

describe('sphericalVoronoi — scipy.spatial.SphericalVoronoi oracle', () => {
  it('vertex count = 2N - 4 = 46', () => {
    const sv = sphericalVoronoi(SPHERE25);
    expect(sv.vertices.length).toBe(46);
  });

  it('every Voronoi vertex lies on the unit sphere', () => {
    const sv = sphericalVoronoi(SPHERE25);
    for (const v of sv.vertices) {
      expect(Math.hypot(v[0], v[1], v[2])).toBeCloseTo(1, 10);
    }
  });

  it('region areas sum to 4*pi (r=1)', () => {
    const sv = sphericalVoronoi(SPHERE25);
    const total = sv.areas.reduce((s, a) => s + a, 0);
    expect(total).toBeCloseTo(4 * Math.PI, 8);
    for (const a of sv.areas) expect(a).toBeGreaterThan(0);
  });

  it('spherical empty-cap: a vertex three generators are its nearest generators', () => {
    const sv = sphericalVoronoi(SPHERE25);
    const gen = SPHERE25; // already unit
    const EPS = 1e-9;
    // Recompute nearest-generator check per vertex using the region membership.
    // For each vertex, find its distance to the closest generator; the facet
    // generators must realise that minimum (no generator strictly closer).
    for (const v of sv.vertices) {
      let minD = Infinity;
      for (const g of gen) minD = Math.min(minD, Math.hypot(v[0] - g[0], v[1] - g[1], v[2] - g[2]));
      // At least 3 generators tie at the minimum (the facet vertices).
      let ties = 0;
      for (const g of gen) {
        if (Math.hypot(v[0] - g[0], v[1] - g[1], v[2] - g[2]) < minD + EPS) ties++;
      }
      expect(ties).toBeGreaterThanOrEqual(3);
    }
  });

  it('scales with radius: areas sum to 4*pi*r^2', () => {
    const sv = sphericalVoronoi(SPHERE25, 2);
    const total = sv.areas.reduce((s, a) => s + a, 0);
    expect(total).toBeCloseTo(4 * Math.PI * 4, 7);
  });

  it('throws on fewer than 4 points and on 2-D input', () => {
    expect(() =>
      sphericalVoronoi([
        [1, 0, 0],
        [0, 1, 0],
        [0, 0, 1],
      ])
    ).toThrow(/at least 4/);
    expect(() =>
      sphericalVoronoi([
        [0, 0],
        [1, 0],
        [0, 1],
        [1, 1],
      ])
    ).toThrow(/3-D/);
  });
});
