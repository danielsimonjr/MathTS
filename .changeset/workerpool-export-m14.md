---
'@danielsimonjr/mathts-parallel': minor
---

Export `WorkerPool` from the package barrel. Fix its timeout and shutdown edges: a task that waits in the queue now times out and leaves the queue (it used to be skipped silently and could hang), `terminate()` cancels the timers of the tasks it rejects and stops a worker that was still starting, and `execute()` after `terminate()` rejects.
