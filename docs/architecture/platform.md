# Platform architecture

Platform contracts isolate the browser domain from operating-system and rendering APIs. The desktop platform composes Electron-backed services; the mobile boundary composes Android or iOS implementations.

Browser surfaces, process metrics, sessions, proxy, VPN, permission enforcement, isolation, downloads, clipboard, filesystem, and notifications are exposed as focused services. Implementations validate inputs and preserve consistent error semantics.
