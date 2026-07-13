---
'@danielsimonjr/mathts-functions': patch
---

Fix the WebGPU wrappers (`gpuMatmul`/`gpuAdd`/`gpuTranspose`/`gpuScale`) rejecting
on a device-initialization failure. An environment can advertise WebGPU and still
fail to hand out a device (lost adapter, driver refusal, revoked permission), in
which case `GPUMatrixBackend.initialize()` rejects — and that rejection escaped the
wrapper, because the init call sat outside the backend's CPU-fallback guard. The GPU
is a best-effort fast path, never a hard dependency: an init failure now degrades to
the CPU implementation, matching the documented fallback contract.
