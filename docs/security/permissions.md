# Permission model

Permissions are decisions over a subject, capability, optional scope, and optional expiration. Subjects can be Moon, origins, extensions, or plugins. Resolution prefers the most recent matching grant, then policy defaults.

Capabilities separate reading tabs, changing navigation, observing/modifying network requests, clipboard and filesystem access, AI context, and notifications. Global extension grants may satisfy origin-specific checks; origin grants never expand beyond their origin.

Unknown or expired capabilities default to deny or prompt according to policy.
