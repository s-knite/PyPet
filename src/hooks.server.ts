// src/hooks.server.ts
// Injects Cross-Origin Isolation headers for SharedArrayBuffer support (used by input() mechanism).

import type { Handle } from '@sveltejs/kit';

export const handle: Handle = async ({ event, resolve }) => {
    const response = await resolve(event);
    response.headers.set('Cross-Origin-Opener-Policy', 'same-origin');
    response.headers.set('Cross-Origin-Embedder-Policy', 'credentialless');
    return response;
};
