import { json, error } from '@sveltejs/kit';
import { dev } from '$app/environment';
import fs from 'node:fs';
import path from 'node:path';

export async function POST({ request }) {
    // Extra safety, although +layout.server.ts should protect this segment too
    if (!dev) {
        throw error(404, 'Not found');
    }

    try {
        const data = await request.json();
        
        // Ensure path resolves correctly from project root
        const filePath = path.resolve(process.cwd(), 'src/lib/data/levels.json');
        
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
        return json({ success: true });
    } catch (err) {
        console.error('Failed to save stages:', err);
        return json({ success: false, error: String(err) }, { status: 500 });
    }
}
