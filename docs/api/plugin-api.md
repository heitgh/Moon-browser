# Plugin API

Plugins can contribute panels, widgets, and automations through explicit capabilities. Each plugin has a versioned `plugin.json`, a relative entrypoint, declared capabilities, and an isolated runtime.

The loader rejects absolute paths, traversal, missing entrypoints, and runtime identity mismatches. Plugin UI receives only a container element; native access is mediated by capability APIs. Automations execute registered actions sequentially and fail when a required action or permission is unavailable.
