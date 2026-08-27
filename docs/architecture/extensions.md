# Extensions architecture

Extension packages pass through manifest parsing, path validation, permission mapping, compatibility analysis, installation, runtime isolation, and API construction.

Background scripts execute behind `ExtensionProcessAdapter`. Messaging is routed by extension identity. Storage is namespaced. Marketplace packages require verification and checksum validation before installation. Updates preserve the installed version until the replacement package validates successfully.
