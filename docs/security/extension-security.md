# Extension security

Extension installation validates Manifest V3, package paths, requested permissions, checksum, and marketplace verification. Background code runs through an isolated process adapter and cannot receive Electron or Node objects.

Every privileged API checks the extension context. Storage is namespaced, messages identify sender and target, and runtime shutdown clears handlers. High-risk permissions such as blocking web requests, cookies, management, and clipboard reading require prominent consent and can be revoked independently.
