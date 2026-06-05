<!-- src/lib/components/pet/PetScene.svelte -->
<script lang="ts">
	import { T, useTask } from '@threlte/core';
	import { interactivity } from '@threlte/extras';
	import * as THREE from 'three';
	import { buildPetShapes, MOOD_TO_SHAPE, MOOD_COLOR, type PetMood } from '$lib/utils/petShapes';

	let { mood, onclick }: { mood: PetMood; onclick: () => void } = $props();

	interactivity();

	// ── Geometry setup ────────────────────────────────────────────────────────
	const { geometry: srcGeo, shapes, vertexCount } = buildPetShapes();
	const dynGeo = srcGeo.clone();
	const wireGeo = srcGeo.clone();
	const currentPositions = new Float32Array(shapes.base);

	const wireMat = new THREE.MeshBasicMaterial({
		color: 0xffffff,
		wireframe: true,
		transparent: true,
		opacity: 0.12
	});

	function resolveColor(key: PetMood): number {
		return MOOD_COLOR[key];
	}

	// ── Three.js object refs ──────────────────────────────────────────────────
	let groupRef: THREE.Group | undefined = $state();
	let matRef: THREE.MeshStandardMaterial | undefined = $state();

	// Colour accumulators — seeded to a neutral value; useTask drives them each frame
	const currentColor = new THREE.Color(0x888888);
	const targetColor = new THREE.Color(0x888888);
	const emissiveColor = new THREE.Color();

	// Animation state
	const CELEBRATION_DURATION = 2.2;
	let celebrationTimer = 0;
	let lastMood: PetMood = 'idle'; // seeded to neutral; synced on first frame
	let eggShakeTimer = 0;
	let time = 0;

	function handleClick(e: MouseEvent) {
		if (e && e.stopPropagation) e.stopPropagation();
		if (mood === 'egg') eggShakeTimer = 0.5;
		onclick();
	}

	// ── Per-frame loop ────────────────────────────────────────────────────────
	useTask((delta: number) => {
		if (!groupRef || !matRef) return;
		time += delta;

		// ── Detect egg-hatch / level-up transition ───────────────────────────
		if (lastMood !== mood) {
			if ((lastMood === 'egg' && mood !== 'egg') || (lastMood === 'level_up' && mood === 'idle')) {
				celebrationTimer = CELEBRATION_DURATION;
				groupRef.rotation.set(0, 0, 0);
				groupRef.position.set(0, 0, 0);
				groupRef.scale.set(1, 1, 1);
			}
			lastMood = mood;
		}

		const targetShapeKey = MOOD_TO_SHAPE[mood] || 'idle';
		let targetShape = shapes[targetShapeKey] || shapes['idle'];
		let emissiveIntensity = 0.5;
		let lerpSpeed = 8;

		if (mood === 'error') {
			const pulse = (Math.sin(time * 20) + 1) / 2;
			targetShape = new Float32Array(vertexCount * 3);
			for (let i = 0; i < vertexCount * 3; i++) {
				targetShape[i] = THREE.MathUtils.lerp(shapes.error[i], shapes.error_extreme[i], pulse);
			}
			emissiveIntensity = 1.0 + pulse * 1.0;
			lerpSpeed = 15;
		} else if (mood === 'sleeping') {
			emissiveIntensity = 0.15;
			lerpSpeed = 4;
		} else if (mood === 'level_up') {
			emissiveIntensity = 1.0 + ((Math.sin(time * 15) + 1) / 2) * 1.2;
		} else if (mood === 'processing') {
			emissiveIntensity = 0.5 + Math.sin(time * 8) * 0.2;
		} else if (mood === 'recharging') {
			emissiveIntensity = 0.8 + Math.sin(time * 8) * 0.3;
		} else if (mood === 'happy') {
			emissiveIntensity = 0.6;
		}

		// ── 2. Lerp positions toward target shape ────────────────────────────
		for (let i = 0; i < vertexCount * 3; i++) {
			currentPositions[i] = THREE.MathUtils.lerp(
				currentPositions[i],
				targetShape[i],
				Math.min(1, delta * lerpSpeed)
			);
		}

		// ── 3. Procedural vertex overlay ─────────────────────────────────────
		const display = new Float32Array(currentPositions);

		if (mood === 'processing') {
			const twist = Math.sin(time * 4) * 2.5;
			for (let i = 0; i < vertexCount; i++) {
				const x = display[i * 3];
				const y = display[i * 3 + 1];
				const z = display[i * 3 + 2];
				const angle = y * twist;
				const c = Math.cos(angle);
				const s = Math.sin(angle);
				display[i * 3] = x * c - z * s;
				display[i * 3 + 2] = x * s + z * c;
			}
		} else if (mood === 'sad') {
			const breath = Math.sin(time * 1.5) * 0.05;
			for (let i = 0; i < vertexCount; i++) {
				display[i * 3] += display[i * 3] * breath;
				display[i * 3 + 1] += display[i * 3 + 1] * breath;
				display[i * 3 + 2] += display[i * 3 + 2] * breath;
			}
		} else if (mood === 'sleeping') {
			// Deep, slow, rhythmic breathing.
			const breathPhase = Math.sin(time * 2.2);
			const breath = breathPhase > 0 ? Math.pow(breathPhase, 2) * 0.05 : 0;
			for (let i = 0; i < vertexCount; i++) {
				// Prevent the flat bottom vertices from lifting or wiggling!
				if (display[i * 3 + 1] > -0.39) {
					display[i * 3 + 1] += breath; // Chest rises
					display[i * 3] += display[i * 3] * breath * 0.3; // Slight radial stretch
					display[i * 3 + 2] += display[i * 3 + 2] * breath * 0.3;
				}
			}
		} else if (mood === 'idle') {
			const breath = Math.sin(time * 1.2) * 0.02;
			for (let i = 0; i < vertexCount; i++) {
				display[i * 3] += display[i * 3] * breath;
				display[i * 3 + 1] += display[i * 3 + 1] * breath;
				display[i * 3 + 2] += display[i * 3 + 2] * breath;
			}
		} else if (mood === 'egg') {
			const breath = Math.sin(time * 2.0) * 0.035;
			for (let i = 0; i < vertexCount; i++) {
				display[i * 3] += display[i * 3] * breath;
				display[i * 3 + 1] += display[i * 3 + 1] * breath;
				display[i * 3 + 2] += display[i * 3 + 2] * breath;
			}
		} else if (mood === 'level_up') {
			const pulse = (Math.sin(time * 15) + 1) / 2;
			const scale = 1.0 + pulse * 0.1;
			for (let i = 0; i < vertexCount; i++) {
				display[i * 3] *= scale;
				display[i * 3 + 1] *= scale;
				display[i * 3 + 2] *= scale;
			}
		} else if (mood === 'recharging') {
			for (let i = 0; i < vertexCount; i++) {
				const y = display[i * 3 + 1];
				const wave = Math.sin(y * 6 - time * 12);
				if (wave > 0.8) {
					const bulge = (wave - 0.8) * 5 * 0.15;
					display[i * 3] *= 1 + bulge;
					display[i * 3 + 2] *= 1 + bulge;
				}
			}
		}

		// ── 4. Upload to GPU ─────────────────────────────────────────────────
		(dynGeo.attributes.position.array as Float32Array).set(display);
		dynGeo.attributes.position.needsUpdate = true;
		(wireGeo.attributes.position.array as Float32Array).set(display);
		wireGeo.attributes.position.needsUpdate = true;

		// ── 5. Group transforms ───────────────────────────────────────────────
		const g = groupRef;

		// Celebration (Loop-de-loop) — overrides normal transforms
		if (celebrationTimer > 0) {
			const elapsed = CELEBRATION_DURATION - celebrationTimer;
			celebrationTimer = Math.max(0, celebrationTimer - delta);

			const t = elapsed / CELEBRATION_DURATION; // 0 to 1

			// Custom tweening (easeInOutBack) to guarantee mathematically continuous motion (no jerks!)
			const c1 = 1.70158;
			const c2 = c1 * 1.525;
			const progress =
				t < 0.5
					? (Math.pow(2 * t, 2) * ((c2 + 1) * 2 * t - c2)) / 2
					: (Math.pow(2 * t - 2, 2) * ((c2 + 1) * (t * 2 - 2) + c2) + 2) / 2;

			// Circular path (starts at bottom: -90 degrees)
			const theta = -Math.PI / 2 + progress * Math.PI * 2;
			const radius = 2.2;

			// Tracing an anticlockwise circle on the XY plane
			g.position.x = Math.cos(theta) * radius * 0.8; // slightly squished loop horizontally
			g.position.y = radius + Math.sin(theta) * radius;
			g.position.z = Math.sin(progress * Math.PI) * -0.5; // slight depth parallax

			// Rotation follows progression perfectly
			g.rotation.z = progress * Math.PI * 2;
			g.rotation.x = Math.sin(progress * Math.PI) * 0.2; // slight pitch
			g.rotation.y = 0; // remain facing user

			// Squash and stretch inherently derived from the back-ease curve!
			// Windups and overshoots create negative stretch (squash), leaps create positive stretch.
			const stretch = Math.sin(progress * Math.PI) * 0.35;
			g.scale.set(1 - stretch * 0.5, 1 + stretch, 1 - stretch * 0.5);

			// Boost emissive during celebration
			targetColor.setHex(resolveColor(mood));
			currentColor.lerp(targetColor, Math.min(1, delta * 5));
			matRef.color.copy(currentColor);
			matRef.emissive.copy(currentColor);
			matRef.emissiveIntensity = THREE.MathUtils.lerp(
				matRef.emissiveIntensity,
				emissiveIntensity + 0.6,
				Math.min(1, delta * 8)
			);
			return;
		}

		// Normal per-mood transforms
		let targetPosY = 0;
		let targetRotX = 0;
		let targetRotY = g.rotation.y + delta * 0.5;
		let targetRotZ = 0;
		let shakeX = 0;
		let shakeY = 0;

		if (mood === 'egg') {
			targetRotY = g.rotation.y; // No spin
			targetRotZ = Math.sin(time * 2.8) * 0.08; // Gentle rock
			targetPosY = Math.sin(time * 1.5) * 0.03;
			// Click shake
			if (eggShakeTimer > 0) {
				eggShakeTimer = Math.max(0, eggShakeTimer - delta);
				const intensity = eggShakeTimer / 0.5;
				shakeX = (Math.random() - 0.5) * 0.18 * intensity;
				shakeY = (Math.random() - 0.5) * 0.1 * intensity;
				targetRotZ += Math.sin(time * 25) * 0.25 * intensity;
			}
		} else if (mood === 'idle') {
			targetPosY = Math.sin(time * 2) * 0.15;
		} else if (mood === 'error') {
			shakeX = (Math.random() - 0.5) * 0.25;
			shakeY = (Math.random() - 0.5) * 0.15;
			targetRotY = g.rotation.y + delta * 2.0;
		} else if (mood === 'happy') {
			targetPosY = Math.abs(Math.sin(time * 5)) * 0.8;
			targetRotY = g.rotation.y + delta * 4;
			targetRotZ = Math.sin(time * 8) * 0.15;
		} else if (mood === 'processing') {
			targetPosY = Math.sin(time * 8) * 0.08;
			targetRotY = g.rotation.y + delta * 1.2;
		} else if (mood === 'sad') {
			targetPosY = -0.35 + Math.sin(time * 1.5) * 0.04;
			targetRotY = g.rotation.y + delta * 0.1;
			targetRotZ = 0.25;
		} else if (mood === 'sleeping') {
			targetPosY = -0.4;
			targetRotY = g.rotation.y + delta * 0.05;
			targetRotZ = 0;
			targetRotX = 0;
		} else if (mood === 'confused') {
			targetPosY = Math.sin(time * 3) * 0.2;
			targetRotX = Math.sin(time * 4) * 0.3;
			targetRotZ = Math.cos(time * 3.5) * 0.3;
		} else if (mood === 'level_up') {
			targetPosY = Math.sin(time * 4) * 0.4 + 0.3;
			targetRotY = g.rotation.y + delta * 6;
			targetRotX = Math.sin(time * 2) * 0.3;
		} else if (mood === 'recharging') {
			targetPosY = Math.sin(time * 2) * 0.08;
			targetRotY = g.rotation.y + delta * 1.5;
		}

		g.position.y = THREE.MathUtils.lerp(g.position.y, targetPosY + shakeY, delta * 10);
		g.position.x = THREE.MathUtils.lerp(g.position.x, shakeX, delta * 15);
		g.rotation.x = THREE.MathUtils.lerp(g.rotation.x, targetRotX, delta * 5);
		g.rotation.y = targetRotY;
		g.rotation.z = THREE.MathUtils.lerp(g.rotation.z, targetRotZ, delta * 5);

		// ── 6. Material ───────────────────────────────────────────────────────
		targetColor.setHex(resolveColor(mood));
		currentColor.lerp(targetColor, Math.min(1, delta * 5));
		emissiveColor.copy(currentColor);
		matRef.color.copy(currentColor);
		matRef.emissive.copy(emissiveColor);
		matRef.emissiveIntensity = THREE.MathUtils.lerp(
			matRef.emissiveIntensity,
			emissiveIntensity,
			Math.min(1, delta * 8)
		);
	});
</script>

<T.PerspectiveCamera makeDefault position={[0, 0.1, 10]} fov={32} />

<T.AmbientLight intensity={0.5} />
<T.DirectionalLight position={[3, 5, 3]} intensity={1.2} />
<T.DirectionalLight position={[-2, -1, -2]} intensity={0.25} color={0x8899cc} />

<T.Group bind:ref={groupRef}>
	<T.Mesh args={[dynGeo]} onclick={handleClick} castShadow>
		<T.MeshStandardMaterial
			bind:ref={matRef}
			flatShading={true}
			roughness={0.25}
			metalness={0.7}
			emissiveIntensity={0.5}
		/>
		<T.Mesh args={[wireGeo, wireMat]} />
	</T.Mesh>
</T.Group>
