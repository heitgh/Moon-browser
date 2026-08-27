# Intelligence architecture

The intelligence layer contains provider contracts, request/response models, streaming, actions, context sources, memory, navigation planning, prompts, caching, and privacy controls.

Context fragments declare sensitivity, relevance, and token estimates. Policy removes disallowed fragments; the builder selects within a token budget. Personal-data redaction occurs before remote transmission when configured. Memory is scoped, size limited, expiring, and disabled for sensitive data by default.
