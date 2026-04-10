#!/bin/bash
set -e
cd "$(dirname "$0")/.."

echo "Building Rust WASM..."
cargo build --target wasm32-unknown-unknown --release

echo "Copying to assembly/build/ for compatibility..."
mkdir -p ../assembly/build
cp target/wasm32-unknown-unknown/release/mathts_wasm.wasm ../assembly/build/mathts-rust.wasm

echo "Done. Rust WASM: $(du -h target/wasm32-unknown-unknown/release/mathts_wasm.wasm | cut -f1)"
