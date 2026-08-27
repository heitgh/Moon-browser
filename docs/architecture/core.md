# Core architecture

The Core is divided into events, errors, state, models, commands, tabs, navigation, sessions, workspaces, and browser lifecycle.

State updates are immutable and versioned. Managers coordinate platform calls, persist the resulting domain state, and publish typed events. Models are serializable and contain no runtime objects. Commands receive an explicit context containing Platform, EventBus, StateStore, scope IDs, metadata, and cancellation signal.

Core modules must not import Electron, native database drivers, or DOM UI components.
