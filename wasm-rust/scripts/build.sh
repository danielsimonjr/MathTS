#!/bin/bash
set -e
cd "$(dirname "$0")/.."

echo "Building Rust WASM..."
cargo build --target wasm32-unknown-unknown --release

WASM_SRC="target/wasm32-unknown-unknown/release/mathts_wasm.wasm"
# Destination is repo-root/lib/wasm/ (one level up from wasm-rust/).
# Previously `../../lib/wasm/...` which resolved OUTSIDE the repo, so the
# benchmark at tests/benchmark/wasm_rust_vs_as_benchmark.ts couldn't find
# the artifact and reported empty Rust columns.
WASM_DST="../lib/wasm/mathts.wasm"

# Create output directory if needed
mkdir -p "$(dirname "$WASM_DST")"

# Copy to lib/wasm/ (where WasmLoader expects it)
cp "$WASM_SRC" "$WASM_DST"

# Run wasm-opt if available (optional optimization)
if command -v wasm-opt &> /dev/null; then
    echo "Optimizing with wasm-opt..."
    wasm-opt -O3 --enable-simd "$WASM_DST" -o "$WASM_DST"
fi

echo "Rust WASM build complete: $WASM_DST ($(du -h "$WASM_DST" | cut -f1))"
# Note: crate is mathts-wasm (binary: mathts_wasm.wasm)
