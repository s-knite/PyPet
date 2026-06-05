<!-- src/routes/+page.svelte -->
<script lang="ts">
	import { gameState } from '$lib/state/gameState.svelte';
	import Guide from '$lib/components/guide/Guide.svelte';
	import SpeechBubble from '$lib/components/pet/SpeechBubble.svelte';
	import PetMesh from '$lib/components/pet/PetMesh.svelte';
	import Codepad from '$lib/components/codepad/Codepad.svelte';
	import Repl from '$lib/components/repl/Repl.svelte';
	import DevPanel from '$lib/components/layout/DevPanel.svelte';
	import type { PetMood } from '$lib/utils/petShapes';

	function handleRunTests() {
		gameState.runMockTests();
	}

	function handleSaveCode(codeToSave: string) {
		gameState.saveAndDeployCode(codeToSave);
	}
</script>

<main
	class="flex h-screen w-screen flex-col overflow-hidden bg-[#e3dfd3] p-4 font-mono text-[#0f0b02]"
>
	<header class="mb-4 flex shrink-0 items-end justify-between border-b-4 border-[#32539a] pb-2">
		<h1 class="text-3xl font-bold tracking-widest text-[#32539a] uppercase drop-shadow-sm">
			PyPet Workspace
		</h1>
		<div
			class="text-sm font-bold tracking-widest text-[#32539a] transition-colors duration-700 {gameState.mode ===
			'edit'
				? 'text-[#57eb58]'
				: ''}"
		>
			MODE: {gameState.mode.toUpperCase()}
		</div>
	</header>

	<!-- Unified Layout Container (No gap here, we handle spacing on the children to avoid gaps when elements shrink to 0) -->
	<div class="flex min-h-0 flex-1 gap-4">
		<!-- LEFT COLUMN (Canvas, Tests, Guide) -->
		<!-- Smoothly shrinks from flex-[3] to flex-[2] -->
		<section
			class="relative flex min-h-0 min-w-0 flex-col transition-all duration-700 ease-in-out {gameState.mode ===
			'play'
				? 'flex-3'
				: 'flex-2'}"
		>
			<!-- Pet Canvas -->
			<!-- Shrinks from flex-1 (fills available space) to a hard-coded flex-[0_0_12rem] (48 units) -->
			<div
				class="relative flex flex-col overflow-hidden rounded-xl border-4 border-[#32539a] bg-white shadow-lg transition-all duration-700 ease-in-out {gameState.mode ===
				'play'
					? 'flex-1'
					: 'flex-[0_0_12rem]'}"
			>
				<h2
					class="absolute top-3 left-4 z-0 rounded border-2 border-[#32539a] bg-[#e3dfd3] px-2 py-1 text-sm font-bold text-[#32539a]"
				>
					{gameState.mode === 'play' ? '/// PET_CANVAS' : '/// PET_MONITOR'}
				</h2>

				<!-- Status label (Moved to top right) -->
				<div
					class="absolute top-3 right-4 z-10 overflow-hidden text-right transition-all duration-700 {gameState.mode ===
					'play'
						? 'max-h-20 opacity-100 pointer-events-auto'
						: 'max-h-0 opacity-0 pointer-events-none'}"
				>
					<p class="text-lg font-bold tracking-widest text-[#32539a]">
						STATE: <span class="uppercase">{gameState.petMood}</span>
					</p>
				</div>

				<div class="z-0 flex flex-1 flex-col overflow-hidden">
					<!-- Speech Bubble -->
					<div class="pointer-events-none absolute top-4 right-0 left-0 z-10 flex justify-center">
						<div class="pointer-events-auto">
							<SpeechBubble />
						</div>
					</div>

					<!-- 3D Pet Mesh (add a little top margin so the bubble doesn't cover the pet) -->
					<div class="relative mt-10 min-h-0 flex-1">
						<PetMesh
							mood={gameState.petMood as PetMood}
							onclick={() => gameState.handlePetClick()}
						/>
					</div>
				</div>
			</div>

			<!-- Test Panel -->
			<!-- Expands from 0 height/opacity to full height -->
			<div
				class="flex flex-col overflow-hidden rounded-xl border-[#32539a] bg-white shadow-lg transition-all duration-700 ease-in-out {gameState.mode ===
				'edit'
					? 'mt-4 flex-[1_1_100%] border-4 p-4 opacity-100'
					: 'mt-0 flex-[0_0_0px] border-0 p-0 opacity-0'}"
			>
				<!-- Inner fixed-min wrapper prevents content from wrapping awkwardly while the outer box shrinks -->
				<div class="flex h-full min-h-[150px] w-full min-w-[300px] flex-col">
					<h2 class="mb-3 text-sm font-bold text-[#32539a] uppercase">
						/// Functional Requirements
					</h2>
					{#if gameState.codeChangedSincePass}
						<div class="mb-3 rounded border-2 border-amber-300 bg-amber-100 p-2 text-xs font-bold text-amber-800">
							⚠️ Changes detected. Please re-run tests.
						</div>
					{/if}
					<div class="flex flex-1 flex-col gap-2 overflow-y-auto pr-2">
						{#each gameState.testRequirements as test (test.id)}
							<div
								class="flex items-center gap-3 rounded border-2 border-[#e3dfd3] bg-[#f8f7f4] p-3 transition-colors duration-500 {test.passed
									? 'border-[#adf18a] bg-green-50'
									: ''}"
							>
								<div
									class="flex h-6 w-6 items-center justify-center rounded-full border-2 text-sm font-bold transition-colors duration-500 {test.passed
										? 'border-[#adf18a] bg-[#adf18a] text-[#0f0b02]'
										: 'border-[#32539a] bg-white text-transparent'}"
								>
									✓
								</div>
								<p
									class="text-sm font-bold text-[#32539a] transition-colors md:text-base {test.passed
										? 'text-green-800'
										: ''}"
								>
									{test.text}
								</p>
							</div>
						{/each}
					</div>
				</div>
			</div>

			<!-- Guide -->
			<Guide />
		</section>

		<!-- RIGHT COLUMN (Codepad, Terminal) -->
		<!-- Smoothly grows from flex-[2] to flex-[3] -->
		<section
			class="flex min-h-0 min-w-0 flex-col transition-all duration-700 ease-in-out {gameState.mode === 'play'
				? 'flex-2'
				: 'flex-3'}"
		>
			<!-- Codepad Wrapper -->
			<div class="relative flex min-h-0 flex-[1_1_100%] flex-col transition-all duration-700 ease-in-out">
				<Codepad
					bind:code={gameState.activeCode}
					petMemory={gameState.petMemory}
					isEditable={gameState.mode === 'edit'}
					testsPassed={gameState.testsPassed}
					showDeploy={gameState.getCurrentAction()?.actionType === 'save_and_deploy' || gameState.getCurrentAction()?.actionType === 'freeplay'}
					onRunTests={handleRunTests}
					onSave={handleSaveCode}
				/>
			</div>

			<!-- "Open Editor" Button -->
			<div
				class="flex shrink-0 justify-center transition-all duration-700 {gameState.mode === 'play'
					? 'mt-2 max-h-12 opacity-100'
					: 'mt-0 max-h-0 overflow-hidden opacity-0 pointer-events-none'}"
			>
				<button
					onclick={() => gameState.enterEditMode()}
					disabled={!(gameState.getCurrentAction()?.actionType === 'open_codepad' || gameState.getCurrentAction()?.actionType === 'freeplay')}
					class="rounded-lg border-2 border-[#32539a] px-6 py-1.5 text-sm font-bold tracking-wider uppercase shadow-[2px_2px_0px_#0f0b02] transition-all
						{ (gameState.getCurrentAction()?.actionType === 'open_codepad' || gameState.getCurrentAction()?.actionType === 'freeplay')
							? 'bg-[#32539a] text-white hover:bg-[#4a6bb8] active:translate-y-[2px] active:shadow-none'
							: 'bg-neutral-400 border-neutral-500 text-neutral-200 opacity-60 cursor-not-allowed shadow-none' }"
				>
					📝 Open Editor
				</button>
			</div>

			<!-- Terminal -->
			<!-- Shrinks from half the space to 0 -->
			<Repl />
		</section>
	</div>
</main>

<DevPanel />
