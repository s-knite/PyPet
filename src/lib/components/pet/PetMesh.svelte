<!-- src/lib/components/pet/PetMesh.svelte -->
<!-- Public-facing wrapper. Provides the Threlte <Canvas> and passes props  -->
<!-- down to PetScene which must live inside the Canvas context.            -->
<script lang="ts">
	import { Canvas } from '@threlte/core';
	import PetScene from './PetScene.svelte';
	import type { PetMood } from '$lib/utils/petShapes';

	let { mood, onclick }: { mood: PetMood; onclick: () => void } = $props();
</script>

<div class="h-full w-full">
	<Canvas>
		<PetScene {mood} {onclick} />
	</Canvas>
</div>
