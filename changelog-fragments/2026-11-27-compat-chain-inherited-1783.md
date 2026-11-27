### Fixed

- **Chain prototype inheritance (#1783):** The chain `Proxy` now falls through to the target's prototype chain for names that are not math functions, so inherited properties (as on `Object.prototype` in mathjs's unit test) remain visible and are not reported as own properties.
