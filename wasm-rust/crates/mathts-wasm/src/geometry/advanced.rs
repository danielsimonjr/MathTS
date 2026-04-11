//! Advanced geometry algorithms: Delaunay triangulation, Voronoi diagram, k-d tree
//!
//! All functions use `#[no_mangle] extern "C"` for WASM interop.

use alloc::vec;
use alloc::vec::Vec;
use libm;

// =============================================================================
// Delaunay Triangulation (Bowyer-Watson incremental algorithm)
// =============================================================================

/// Triangle with three vertex indices
#[derive(Clone, Copy)]
struct Triangle {
    v: [usize; 3],
}

/// Circumcircle center for a triangle
struct Circumcircle {
    cx: f64,
    cy: f64,
}

/// Compute circumcircle of triangle (ax,ay), (bx,by), (cx,cy).
fn circumcircle(ax: f64, ay: f64, bx: f64, by: f64, cx: f64, cy: f64) -> Option<Circumcircle> {
    let d = 2.0 * (ax * (by - cy) + bx * (cy - ay) + cx * (ay - by));
    if libm::fabs(d) < 1e-15 {
        return None;
    }
    let ux = ((ax * ax + ay * ay) * (by - cy)
        + (bx * bx + by * by) * (cy - ay)
        + (cx * cx + cy * cy) * (ay - by))
        / d;
    let uy = ((ax * ax + ay * ay) * (cx - bx)
        + (bx * bx + by * by) * (ax - cx)
        + (cx * cx + cy * cy) * (bx - ax))
        / d;
    Some(Circumcircle { cx: ux, cy: uy })
}

/// Check if point (px, py) is inside the circumcircle of a triangle.
fn in_circumcircle(points: &[(f64, f64)], tri: &Triangle, px: f64, py: f64) -> bool {
    let (ax, ay) = points[tri.v[0]];
    let (bx, by) = points[tri.v[1]];
    let (cx, cy) = points[tri.v[2]];

    // Use the determinant test (more numerically robust)
    let dax = ax - px;
    let day = ay - py;
    let dbx = bx - px;
    let dby = by - py;
    let dcx = cx - px;
    let dcy = cy - py;

    let det = (dax * dax + day * day) * (dbx * dcy - dcx * dby)
        - (dbx * dbx + dby * dby) * (dax * dcy - dcx * day)
        + (dcx * dcx + dcy * dcy) * (dax * dby - dbx * day);

    det > 0.0
}

/// An edge represented as two vertex indices (ordered for comparison)
#[derive(Clone, Copy, PartialEq)]
struct Edge {
    a: usize,
    b: usize,
}

impl Edge {
    fn new(a: usize, b: usize) -> Self {
        if a < b {
            Edge { a, b }
        } else {
            Edge { a: b, b: a }
        }
    }
}

/// Perform Delaunay triangulation using Bowyer-Watson algorithm.
///
/// # Arguments
/// * `points_ptr` - Pointer to interleaved [x0, y0, x1, y1, ...] coordinates
/// * `n` - Number of points
/// * `triangles_ptr` - Output pointer for triangle indices [i0, j0, k0, i1, j1, k1, ...]
///
/// # Returns
/// Number of triangles written to triangles_ptr
#[no_mangle]
pub unsafe extern "C" fn delaunay_wasm(
    points_ptr: *const f64,
    n: i32,
    triangles_ptr: *mut i32,
) -> i32 {
    let n = n as usize;
    if n < 3 {
        return 0;
    }

    // Load points
    let mut points: Vec<(f64, f64)> = Vec::with_capacity(n + 3);
    for i in 0..n {
        points.push((*points_ptr.add(i * 2), *points_ptr.add(i * 2 + 1)));
    }

    // Find bounding box
    let mut min_x = points[0].0;
    let mut min_y = points[0].1;
    let mut max_x = points[0].0;
    let mut max_y = points[0].1;
    for i in 1..n {
        if points[i].0 < min_x {
            min_x = points[i].0;
        }
        if points[i].1 < min_y {
            min_y = points[i].1;
        }
        if points[i].0 > max_x {
            max_x = points[i].0;
        }
        if points[i].1 > max_y {
            max_y = points[i].1;
        }
    }

    let dx = max_x - min_x;
    let dy = max_y - min_y;
    let dmax = if dx > dy { dx } else { dy } * 10.0;

    // Add super-triangle vertices
    let st0 = n;
    let st1 = n + 1;
    let st2 = n + 2;
    points.push((min_x - dmax, min_y - dmax));
    points.push((min_x + 2.0 * dmax, min_y - dmax));
    points.push((min_x + dx / 2.0, min_y + 2.0 * dmax));

    let mut triangles: Vec<Triangle> = vec![Triangle { v: [st0, st1, st2] }];

    // Insert each point incrementally
    for i in 0..n {
        let (px, py) = points[i];

        // Find all triangles whose circumcircle contains the new point
        let mut bad_indices: Vec<usize> = Vec::new();
        for (idx, tri) in triangles.iter().enumerate() {
            if in_circumcircle(&points, tri, px, py) {
                bad_indices.push(idx);
            }
        }

        // Find the boundary polygon (edges not shared by two bad triangles)
        let mut boundary: Vec<Edge> = Vec::new();
        for &bi in &bad_indices {
            let tri = &triangles[bi];
            let edges = [
                Edge::new(tri.v[0], tri.v[1]),
                Edge::new(tri.v[1], tri.v[2]),
                Edge::new(tri.v[2], tri.v[0]),
            ];
            for edge in &edges {
                let mut shared = false;
                for &bj in &bad_indices {
                    if bj == bi {
                        continue;
                    }
                    let other = &triangles[bj];
                    let other_edges = [
                        Edge::new(other.v[0], other.v[1]),
                        Edge::new(other.v[1], other.v[2]),
                        Edge::new(other.v[2], other.v[0]),
                    ];
                    for oe in &other_edges {
                        if oe.a == edge.a && oe.b == edge.b {
                            shared = true;
                            break;
                        }
                    }
                    if shared {
                        break;
                    }
                }
                if !shared {
                    boundary.push(*edge);
                }
            }
        }

        // Remove bad triangles (from end to preserve indices)
        bad_indices.sort_unstable();
        for &bi in bad_indices.iter().rev() {
            triangles.swap_remove(bi);
        }

        // Create new triangles from boundary edges to the new point
        for edge in &boundary {
            triangles.push(Triangle {
                v: [edge.a, edge.b, i],
            });
        }
    }

    // Filter out triangles with super-triangle vertices and write output
    let mut count = 0i32;
    for tri in &triangles {
        if tri.v[0] >= n || tri.v[1] >= n || tri.v[2] >= n {
            continue;
        }
        *triangles_ptr.add(count as usize * 3) = tri.v[0] as i32;
        *triangles_ptr.add(count as usize * 3 + 1) = tri.v[1] as i32;
        *triangles_ptr.add(count as usize * 3 + 2) = tri.v[2] as i32;
        count += 1;
    }

    count
}

// =============================================================================
// Voronoi Diagram (dual of Delaunay triangulation)
// =============================================================================

/// Compute Voronoi diagram as the dual of a Delaunay triangulation.
///
/// # Arguments
/// * `points_ptr` - Pointer to interleaved [x0, y0, x1, y1, ...] coordinates
/// * `n` - Number of input points
/// * `bounds` - Pointer to [xmin, ymin, xmax, ymax] clipping bounds
/// * `vertices_ptr` - Output pointer for Voronoi vertices [x0, y0, x1, y1, ...]
/// * `edges_ptr` - Output pointer for Voronoi edges [v0_start, v0_end, v1_start, v1_end, ...]
/// * `max_vertices` - Maximum number of vertices that can be written
/// * `max_edges` - Maximum number of edges that can be written
///
/// # Returns
/// Number of Voronoi vertices (lower 16 bits) | number of edges (upper 16 bits)
#[no_mangle]
pub unsafe extern "C" fn voronoi_wasm(
    points_ptr: *const f64,
    n: i32,
    bounds: *const f64,
    vertices_ptr: *mut f64,
    edges_ptr: *mut i32,
    max_vertices: i32,
    max_edges: i32,
) -> i32 {
    let n = n as usize;
    if n < 3 {
        return 0;
    }

    let bound_xmin = *bounds;
    let bound_ymin = *bounds.add(1);
    let bound_xmax = *bounds.add(2);
    let bound_ymax = *bounds.add(3);

    // Load points
    let mut points: Vec<(f64, f64)> = Vec::with_capacity(n + 3);
    for i in 0..n {
        points.push((*points_ptr.add(i * 2), *points_ptr.add(i * 2 + 1)));
    }

    // Find bounding box for super-triangle
    let mut min_x = points[0].0;
    let mut min_y = points[0].1;
    let mut max_x = points[0].0;
    let mut max_y = points[0].1;
    for i in 1..n {
        if points[i].0 < min_x {
            min_x = points[i].0;
        }
        if points[i].1 < min_y {
            min_y = points[i].1;
        }
        if points[i].0 > max_x {
            max_x = points[i].0;
        }
        if points[i].1 > max_y {
            max_y = points[i].1;
        }
    }

    let dx = max_x - min_x;
    let dy = max_y - min_y;
    let dmax = if dx > dy { dx } else { dy } * 10.0;

    let st0 = n;
    let st1 = n + 1;
    let st2 = n + 2;
    points.push((min_x - dmax, min_y - dmax));
    points.push((min_x + 2.0 * dmax, min_y - dmax));
    points.push((min_x + dx / 2.0, min_y + 2.0 * dmax));

    // Run Bowyer-Watson to get triangulation
    let mut triangles: Vec<Triangle> = vec![Triangle { v: [st0, st1, st2] }];

    for i in 0..n {
        let (px, py) = points[i];
        let mut bad_indices: Vec<usize> = Vec::new();
        for (idx, tri) in triangles.iter().enumerate() {
            if in_circumcircle(&points, tri, px, py) {
                bad_indices.push(idx);
            }
        }

        let mut boundary: Vec<Edge> = Vec::new();
        for &bi in &bad_indices {
            let tri = &triangles[bi];
            let edges = [
                Edge::new(tri.v[0], tri.v[1]),
                Edge::new(tri.v[1], tri.v[2]),
                Edge::new(tri.v[2], tri.v[0]),
            ];
            for edge in &edges {
                let mut shared = false;
                for &bj in &bad_indices {
                    if bj == bi {
                        continue;
                    }
                    let other = &triangles[bj];
                    let oes = [
                        Edge::new(other.v[0], other.v[1]),
                        Edge::new(other.v[1], other.v[2]),
                        Edge::new(other.v[2], other.v[0]),
                    ];
                    for oe in &oes {
                        if oe.a == edge.a && oe.b == edge.b {
                            shared = true;
                            break;
                        }
                    }
                    if shared {
                        break;
                    }
                }
                if !shared {
                    boundary.push(*edge);
                }
            }
        }

        bad_indices.sort_unstable();
        for &bi in bad_indices.iter().rev() {
            triangles.swap_remove(bi);
        }

        for edge in &boundary {
            triangles.push(Triangle {
                v: [edge.a, edge.b, i],
            });
        }
    }

    // Filter to only triangles with all original-point vertices
    let valid_triangles: Vec<Triangle> = triangles
        .iter()
        .filter(|t| t.v[0] < n && t.v[1] < n && t.v[2] < n)
        .copied()
        .collect();

    // Compute circumcenter of each valid triangle -> Voronoi vertex
    let mut voronoi_verts: Vec<(f64, f64)> = Vec::new();
    let max_v = max_vertices as usize;
    let max_e = max_edges as usize;

    for tri in &valid_triangles {
        let (ax, ay) = points[tri.v[0]];
        let (bx, by) = points[tri.v[1]];
        let (cx, cy) = points[tri.v[2]];
        if let Some(cc) = circumcircle(ax, ay, bx, by, cx, cy) {
            // Clip to bounds
            let vx = if cc.cx < bound_xmin {
                bound_xmin
            } else if cc.cx > bound_xmax {
                bound_xmax
            } else {
                cc.cx
            };
            let vy = if cc.cy < bound_ymin {
                bound_ymin
            } else if cc.cy > bound_ymax {
                bound_ymax
            } else {
                cc.cy
            };
            voronoi_verts.push((vx, vy));
        } else {
            voronoi_verts.push((0.0, 0.0));
        }
    }

    // Write vertices (capped at max_vertices)
    let num_verts = if voronoi_verts.len() > max_v {
        max_v
    } else {
        voronoi_verts.len()
    };
    for i in 0..num_verts {
        *vertices_ptr.add(i * 2) = voronoi_verts[i].0;
        *vertices_ptr.add(i * 2 + 1) = voronoi_verts[i].1;
    }

    // Build Voronoi edges: two triangles sharing an edge -> connect their circumcenters
    let mut edge_count: usize = 0;
    for i in 0..valid_triangles.len() {
        if edge_count >= max_e {
            break;
        }
        for j in (i + 1)..valid_triangles.len() {
            if edge_count >= max_e {
                break;
            }
            // Check if triangles i and j share exactly 2 vertices (an edge)
            let mut shared = 0;
            for &vi in &valid_triangles[i].v {
                for &vj in &valid_triangles[j].v {
                    if vi == vj {
                        shared += 1;
                    }
                }
            }
            if shared == 2 && i < num_verts && j < num_verts {
                *edges_ptr.add(edge_count * 2) = i as i32;
                *edges_ptr.add(edge_count * 2 + 1) = j as i32;
                edge_count += 1;
            }
        }
    }

    // Pack return: num_verts in lower 16 bits, num_edges in upper 16 bits
    (num_verts as i32) | ((edge_count as i32) << 16)
}

// =============================================================================
// k-d Tree
// =============================================================================

/// Serialized k-d tree node layout (per node, stride = 2 + dims):
///   [left_child_idx (f64), right_child_idx (f64), coord0, coord1, ..., coord_{dims-1}]
/// -1.0 means null child. The original point index is stored implicitly by
/// node position in the flattened array alongside a separate index array.
///
/// Actually, for simplicity we use a different layout:
///   tree_ptr stores: [original_index, left_idx, right_idx, coord0, coord1, ...]
///   stride = 3 + dims per node
///   -1.0 for null children

const NULL_NODE: f64 = -1.0;

/// Build a k-d tree from a set of points.
///
/// # Arguments
/// * `points_ptr` - Pointer to interleaved coordinates [x0, y0, x1, y1, ...] for 2D etc.
/// * `n` - Number of points
/// * `dims` - Number of dimensions per point
/// * `tree_ptr` - Output pointer for serialized tree. Each node: [orig_index, left_idx, right_idx, coords...]
///               Stride = 3 + dims. Null index = -1.
///
/// # Returns
/// Total number of nodes written (always equals n)
#[no_mangle]
pub unsafe extern "C" fn kdtree_build_wasm(
    points_ptr: *const f64,
    n: i32,
    dims: i32,
    tree_ptr: *mut f64,
) -> i32 {
    let n = n as usize;
    let dims = dims as usize;
    if n == 0 || dims == 0 {
        return 0;
    }

    let stride = 3 + dims; // orig_index, left_idx, right_idx, coords...

    // Load points with original indices
    let mut indices: Vec<usize> = (0..n).collect();
    let mut coords: Vec<f64> = Vec::with_capacity(n * dims);
    for i in 0..n * dims {
        coords.push(*points_ptr.add(i));
    }

    // Counter for the next node slot in tree_ptr
    let mut node_count: usize = 0;

    fn build(
        indices: &mut [usize],
        coords: &[f64],
        dims: usize,
        depth: usize,
        tree_ptr: *mut f64,
        stride: usize,
        node_count: &mut usize,
    ) -> f64 {
        let len = indices.len();
        if len == 0 {
            return NULL_NODE;
        }

        let axis = depth % dims;

        // Sort indices by the current axis coordinate
        indices.sort_unstable_by(|&a, &b| {
            let va = coords[a * dims + axis];
            let vb = coords[b * dims + axis];
            va.partial_cmp(&vb).unwrap_or(core::cmp::Ordering::Equal)
        });

        let mid = len / 2;
        let my_idx = *node_count;
        *node_count += 1;

        let orig_index = indices[mid];

        // Write this node's data (placeholder for children, fill in after recursive calls)
        unsafe {
            let base = my_idx * stride;
            *tree_ptr.add(base) = orig_index as f64;
            // coords
            for d in 0..dims {
                *tree_ptr.add(base + 3 + d) = coords[orig_index * dims + d];
            }
        }

        // Build left subtree
        let (left_slice, right_and_mid) = indices.split_at_mut(mid);
        let right_slice = if right_and_mid.len() > 1 {
            &mut right_and_mid[1..]
        } else {
            &mut []
        };

        let left_idx = build(
            left_slice,
            coords,
            dims,
            depth + 1,
            tree_ptr,
            stride,
            node_count,
        );
        let right_idx = build(
            right_slice,
            coords,
            dims,
            depth + 1,
            tree_ptr,
            stride,
            node_count,
        );

        // Fill in children indices
        unsafe {
            let base = my_idx * stride;
            *tree_ptr.add(base + 1) = left_idx;
            *tree_ptr.add(base + 2) = right_idx;
        }

        my_idx as f64
    }

    build(
        &mut indices,
        &coords,
        dims,
        0,
        tree_ptr,
        stride,
        &mut node_count,
    );

    node_count as i32
}

/// Find the nearest neighbor in a serialized k-d tree.
///
/// # Arguments
/// * `tree_ptr` - Pointer to serialized tree (from kdtree_build_wasm)
/// * `query_ptr` - Pointer to query point coordinates [x, y, ...]
/// * `dims` - Number of dimensions
/// * `n` - Total number of nodes in tree
///
/// # Returns
/// Original index of the nearest point
#[no_mangle]
pub unsafe extern "C" fn kdtree_nearest_wasm(
    tree_ptr: *const f64,
    query_ptr: *const f64,
    dims: i32,
    n: i32,
) -> i32 {
    let dims = dims as usize;
    let n = n as usize;
    if n == 0 || dims == 0 {
        return -1;
    }

    let stride = 3 + dims;

    // Load query point
    let mut query: Vec<f64> = Vec::with_capacity(dims);
    for d in 0..dims {
        query.push(*query_ptr.add(d));
    }

    let mut best_idx: i32 = -1;
    let mut best_dist_sq: f64 = f64::MAX;

    fn dist_sq(
        tree_ptr: *const f64,
        node: usize,
        stride: usize,
        dims: usize,
        query: &[f64],
    ) -> f64 {
        let mut sum = 0.0;
        for d in 0..dims {
            unsafe {
                let diff = *tree_ptr.add(node * stride + 3 + d) - query[d];
                sum += diff * diff;
            }
        }
        sum
    }

    fn search(
        tree_ptr: *const f64,
        node_idx_f: f64,
        dims: usize,
        stride: usize,
        depth: usize,
        query: &[f64],
        best_idx: &mut i32,
        best_dist_sq: &mut f64,
    ) {
        if node_idx_f < 0.0 {
            return;
        }
        let node = node_idx_f as usize;

        let d = dist_sq(tree_ptr, node, stride, dims, query);
        if d < *best_dist_sq {
            *best_dist_sq = d;
            unsafe {
                *best_idx = *tree_ptr.add(node * stride) as i32; // orig_index
            }
        }

        let axis = depth % dims;
        let node_coord = unsafe { *tree_ptr.add(node * stride + 3 + axis) };
        let diff = query[axis] - node_coord;

        let (first, second) = if diff < 0.0 {
            unsafe {
                (
                    *tree_ptr.add(node * stride + 1), // left
                    *tree_ptr.add(node * stride + 2), // right
                )
            }
        } else {
            unsafe {
                (
                    *tree_ptr.add(node * stride + 2), // right
                    *tree_ptr.add(node * stride + 1), // left
                )
            }
        };

        search(
            tree_ptr,
            first,
            dims,
            stride,
            depth + 1,
            query,
            best_idx,
            best_dist_sq,
        );

        // Check if we need to explore the other subtree
        if diff * diff < *best_dist_sq {
            search(
                tree_ptr,
                second,
                dims,
                stride,
                depth + 1,
                query,
                best_idx,
                best_dist_sq,
            );
        }
    }

    search(
        tree_ptr,
        0.0,
        dims,
        stride,
        0,
        &query,
        &mut best_idx,
        &mut best_dist_sq,
    );

    best_idx
}
