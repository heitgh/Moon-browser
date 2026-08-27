# Networking architecture

`NetworkPlatform` is the native interception boundary. Ordered filters return allow, block, redirect, or modify decisions. Moon layers request policies, AdBlock, tracking protection, DNS, proxy, and VPN management above that boundary.

AdBlock compiles versioned lists into request-level matches. Allow rules override blocking matches. Proxy credentials are resolved through secret references rather than stored directly in profiles. VPN state tracks the exact provider responsible for the active connection.
