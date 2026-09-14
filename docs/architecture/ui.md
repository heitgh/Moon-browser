# UI architecture

UI modules use standards-based DOM APIs and import no Electron modules. The shell contains titlebar, toolbar, sidebar, and content areas. Home widgets, workspaces, settings, Zen Mode, customization, extensions, and plugins register through explicit view contracts.

Styles use design tokens, responsive grids, reduced-motion support, high-contrast adaptations, visible focus states, and minimum touch targets. The document CSP forbids inline scripts and unsafe evaluation.


## Simple-mode compact baseline

Perfis novos usam densidade compacta, tabs de 196 px, rail de 48 px, toolbar de 42 px, status bar oculto e Home minimalista. A camada `professional-compact.css` reduz ruído sem remover controles ou contratos; preferências existentes e o modo Avançado continuam intactos. Em ponteiro coarse, os alvos voltam a 44 px. O drawer padrão permanece fixo para não cobrir nem interceptar a omnibox.
