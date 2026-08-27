# Debugging

Start with `npm run typecheck`, then inspect the smallest responsible boundary. Renderer failures belong to UI/preload; native failures belong to Electron adapters; incorrect browser behavior belongs to Core managers; persistence failures belong to repositories or migrations.

Never disable isolation or Node security settings to simplify debugging. Use typed logs with IDs and sanitized context. Private URLs, page content, tokens, cookies, passwords, and AI prompts must not appear in logs.
