// src/lib/utils/petShapes.ts
// Builds icosahedron morph shape data for the PyPet 3D animation system.
// Returns raw Float32Array buffers so PetScene can lerp and apply
// procedural vertex effects each frame. Results are module-level singletons.

import * as THREE from 'three';
import type { PetMood } from '../state/uiState.svelte';

// Re-export so view-layer consumers can import from here
export type { PetMood };

export const SHAPE_KEYS = [
	'egg',
	'base',
	'idle',
	'error',
	'error_extreme',
	'happy',
	'processing',
	'sad',
	'confused',
	'sleeping',
	'level_up',
	'cube',
	'triangle',
	'recharging'
] as const;

export type ShapeKey = (typeof SHAPE_KEYS)[number];

export interface PetShapeData {
	/** Non-indexed icosahedron — clone this for direct per-frame manipulation. */
	geometry: THREE.BufferGeometry;
	/** Raw per-vertex position arrays for each shape. */
	shapes: Record<ShapeKey, Float32Array>;
	vertexCount: number;
}

/** Maps each PetMood to its target shape key. */
export const MOOD_TO_SHAPE: Record<PetMood, ShapeKey> = {
	egg: 'egg',
	idle: 'idle',
	happy: 'happy',
	sad: 'sad',
	processing: 'processing',
	error: 'error',
	confused: 'confused',
	sleeping: 'sleeping',
	level_up: 'level_up',
	recharging: 'recharging',
	cube: 'cube',
	triangle: 'triangle'
};

/** Three.js hex colours for each PetMood. Vivid — they work well as emissive tints. */
export const MOOD_COLOR: Record<PetMood, number> = {
	egg: 0xf5d76e,
	idle: 0x00aacc,
	happy: 0x22cc55,
	sad: 0x3355dd,
	processing: 0xbb22bb,
	error: 0xdd2222,
	confused: 0xffcc00,
	sleeping: 0x475569,
	level_up: 0xfbbf24,
	recharging: 0x10b981,
	cube: 0xf97316,
	triangle: 0x8b5cf6
};

let cached: PetShapeData | null = null;

/** Build (or return cached) shape data. */
export function buildPetShapes(): PetShapeData {
	if (cached) return cached;

	const indexedGeo = new THREE.IcosahedronGeometry(1, 2);
	const geometry = indexedGeo.getIndex() ? indexedGeo.toNonIndexed() : indexedGeo.clone();
	indexedGeo.dispose();

	const posAttr = geometry.attributes.position;
	const vertexCount = posAttr.count;

	// Subdivision-0 icosahedron vertices — used to detect original spike positions
	const baseIco = new THREE.IcosahedronGeometry(1, 0);
	const origVerts = Array.from({ length: baseIco.attributes.position.count }, (_, i) =>
		new THREE.Vector3().fromBufferAttribute(baseIco.attributes.position, i)
	);
	baseIco.dispose();
	const isOrigVert = (v: THREE.Vector3) => origVerts.some((ov) => v.distanceTo(ov) < 0.01);

	const shapes = Object.fromEntries(
		SHAPE_KEYS.map((k) => [k, new Float32Array(vertexCount * 3)])
	) as Record<ShapeKey, Float32Array>;

	for (let i = 0; i < vertexCount; i++) {
		const v = new THREE.Vector3().fromBufferAttribute(posAttr, i);
		const isOrig = isOrigVert(v);

		const put = (key: ShapeKey, vec: THREE.Vector3) => {
			shapes[key][i * 3] = vec.x;
			shapes[key][i * 3 + 1] = vec.y;
			shapes[key][i * 3 + 2] = vec.z;
		};

		put('base', v);

		// Egg — taller, narrower top, fatter bottom
		{
			const w = v.clone();
			w.x *= 0.8;
			w.z *= 0.8;
			w.y *= 1.35;
			if (w.y < 0) {
				w.x *= 1.15;
				w.z *= 1.15;
				w.y *= 0.85;
			}
			put('egg', w);
		}

		// Idle — slightly inflated boxy sphere
		{
			const absSum = Math.abs(v.x) + Math.abs(v.y) + Math.abs(v.z);
			const w = v.clone().multiplyScalar(1.2 / absSum);
			w.y *= 1.2;
			put('idle', w);
		}

		put('error', v.clone().multiplyScalar(isOrig ? 1.4 : 0.5));
		put('error_extreme', v.clone().multiplyScalar(isOrig ? 2.2 : 0.3));
		put('happy', v.clone().normalize().multiplyScalar(1.2));

		// Processing — tall cylinder-ish
		{
			const w = v.clone();
			w.x *= 0.8;
			w.z *= 0.8;
			w.y *= 1.5;
			const d = Math.sqrt(w.x ** 2 + w.z ** 2);
			if (d > 0) {
				w.x = (w.x / d) * 0.8;
				w.z = (w.z / d) * 0.8;
			}
			put('processing', w);
		}

		// Sad — flattened, drooping
		{
			const w = v.clone();
			w.y *= 0.5;
			w.x *= 1.3;
			w.z *= 1.3;
			w.y += w.y > 0 ? -0.3 : -0.1;
			put('sad', w);
		}

		put('confused', v.clone());

		// Sleeping — slumped and curled resting shape
		{
			const w = v.clone();

			// 1. Tilt the vertices mathematically FIRST so it looks like it's lying on its side
			w.applyAxisAngle(new THREE.Vector3(0, 0, 1), 0.6);

			// 2. Squash and widen
			w.y *= 0.45;
			w.x *= 1.25;
			w.z *= 1.25;

			// 3. Asymmetric droop (tucked head/curled body)
			w.y -= Math.abs(w.x) * 0.25;

			// 4. Flatten the bottom perfectly horizontal
			if (w.y < -0.4) {
				w.y = -0.4;
			}

			put('sleeping', w);
		}

		put('level_up', v.clone().multiplyScalar(isOrig ? 1.8 : 0.9));

		// Cube
		{
			const w = v.clone();
			const m = Math.max(Math.abs(w.x), Math.abs(w.y), Math.abs(w.z));
			put('cube', w.multiplyScalar(0.8 / m));
		}

		// Triangle (tetrahedron-ish)
		{
			const w = v.clone();
			const m = Math.max(w.x + w.y + w.z, w.x - w.y - w.z, -w.x + w.y - w.z, -w.x - w.y + w.z);
			put('triangle', w.multiplyScalar(0.8 / m));
		}

		// Recharging — pill / battery
		{
			const w = v.clone();
			const d = Math.sqrt(w.x ** 2 + w.z ** 2);
			if (d > 0) {
				w.x = (w.x / d) * 0.6;
				w.z = (w.z / d) * 0.6;
			}
			w.y *= 1.5;
			if (w.y > 0.8) w.y = 0.8 + (w.y - 0.8) * 0.3;
			if (w.y < -0.8) w.y = -0.8 + (w.y + 0.8) * 0.3;
			put('recharging', w);
		}
	}

	geometry.computeVertexNormals();
	cached = { geometry, shapes, vertexCount };
	return cached;
}
