# Intelligence API

`@moon/intelligence` provides provider-independent AI requests, responses, streaming events, tools, context assembly, memory policies, privacy redaction, and high-level actions.

Context sources are permission filtered and token budgeted before provider submission. Page content is always treated as untrusted data. Remote providers, sensitive memory, and personal-data handling are controlled by explicit policy.

Providers declare supported models, tool use, streaming, vision, and context limits. The engine publishes request lifecycle events without exposing abort signals or secret credentials.
