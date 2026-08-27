# UI architecture

UI modules use standards-based DOM APIs and import no Electron modules. The shell contains titlebar, toolbar, sidebar, and content areas. Home widgets, workspaces, settings, Zen Mode, customization, extensions, and plugins register through explicit view contracts.

Styles use design tokens, responsive grids, reduced-motion support, high-contrast adaptations, visible focus states, and minimum touch targets. The document CSP forbids inline scripts and unsafe evaluation.
