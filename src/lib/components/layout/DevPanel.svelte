<!-- src/lib/components/layout/DevPanel.svelte -->
<script lang="ts">
	import { gameState } from '$lib/state/gameState.svelte';
	import { storyLevels } from '$lib/utils/stageLoader';
	import { PET_MOODS, type PetMood } from '$lib/state/uiState.svelte';

	let isOpen = $state(false);
	let jumpTarget = $state('0_0');
	let injectCode = $state('');
	let preserveCode = $state(true);
	let devSolutionCode = $state(false);

	let forcedMood = $state<PetMood | ''>('');

	function applyForcedMood(mood: PetMood | '') {
		forcedMood = mood;
		if (mood) (gameState as { petMood: string }).petMood = mood;
	}
</script>

{#if gameState.devMode}
	<div class="fixed bottom-0 right-0 z-50 font-mono text-xs">
		<!-- Toggle Tab -->
		<button
			onclick={() => (isOpen = !isOpen)}
			class="rounded-tl-lg border-2 border-b-0 border-r-0 border-[#32539a] bg-[#0f0b02] px-3 py-1 text-[#adf18a] hover:bg-[#1a1a1a]"
		>
			{isOpen ? '▼ DEV' : '▲ DEV'}
		</button>

		{#if isOpen}
			<div
				class="max-h-[50vh] w-[420px] overflow-y-auto border-2 border-b-0 border-r-0 border-[#32539a] bg-[#0f0b02] p-3 text-[#adf18a]"
			>
				<!-- State Inspector -->
				<div class="mb-3 border-b border-[#32539a] pb-2">
					<h3 class="mb-1 font-bold text-[#57eb58]">State</h3>
					<div class="grid grid-cols-2 gap-1">
						<span>Stage:</span>
						<span class="text-white"
							>L{gameState.currentLevelIndex} S{gameState.currentStageIndex} — {gameState.currentStage.title}</span
						>
						<span>Mood:</span>
						<span class="text-white">{gameState.petMood}</span>
						<span>Mode:</span>
						<span class="text-white">{gameState.mode}</span>
						<span>Tests:</span>
						<span class="text-white">{gameState.testsPassed ? '✅ PASSED' : '❌ NOT PASSED'}</span>
						<span>Guide:</span>
						<span class="text-white"
							>{gameState.currentMessageIndex + 1}/{gameState.guideMessages.length}</span
						>
					</div>
				</div>

				<!-- Stage Jumper -->
				<div class="mb-3 border-b border-[#32539a] pb-2">
					<h3 class="mb-1 font-bold text-[#57eb58]">Jump to Stage</h3>
					<div class="mb-2 flex flex-col gap-1 text-sm text-[#adf18a]">
						<label class="flex items-center gap-2 cursor-pointer">
							<input type="checkbox" bind:checked={preserveCode} class="rounded bg-[#1a1a1a]" />
							Preserve Current Code
						</label>
						<label class="flex items-center gap-2 cursor-pointer">
							<input type="checkbox" bind:checked={devSolutionCode} class="rounded bg-[#1a1a1a]" />
							Auto-load Stage Solution Code
						</label>
					</div>
					<div class="flex gap-2">
						<select
							bind:value={jumpTarget}
							class="flex-1 min-w-0 overflow-hidden text-ellipsis rounded bg-[#1a1a1a] px-2 py-1 text-white"
						>
							{#each storyLevels as level, lIndex (level.id)}
								{#each level.stages as stage, sIndex (stage.id)}
									<option value={`${lIndex}_${sIndex}`}>L{lIndex}.S{sIndex}: {level.title} - {stage.title}</option>
								{/each}
							{/each}
						</select>
						<button
							onclick={() => {
								const [l, s] = jumpTarget.split('_').map(Number);
								gameState.jumpToStage(l, s, { preserveCode, devSolutionCode });
							}}
							class="rounded bg-[#32539a] px-3 py-1 text-white hover:bg-[#4a6bb8]"
						>
							Go
						</button>
					</div>
				</div>

				<!-- Code Injector -->
				<div class="mb-3 border-b border-[#32539a] pb-2">
					<h3 class="mb-1 font-bold text-[#57eb58]">Inject Code</h3>
					<textarea
						bind:value={injectCode}
						rows="3"
						class="mb-1 w-full rounded bg-[#1a1a1a] p-2 text-white"
						placeholder="def greeting():&#10;  print('Hello')"
					></textarea>
					<button
						onclick={() => {
							gameState.activeCode = injectCode;
						}}
						class="rounded bg-[#32539a] px-3 py-1 text-white hover:bg-[#4a6bb8]"
					>
						Set Active Code
					</button>
				</div>

				<!-- Code State -->
				<div class="mb-3 border-b border-[#32539a] pb-2">
					<h3 class="mb-1 font-bold text-[#57eb58]">Active Code</h3>
					<pre class="max-h-20 overflow-auto rounded bg-[#1a1a1a] p-1 text-white">{gameState.activeCode || '(empty)'}</pre>
					<h3 class="mb-1 mt-2 font-bold text-[#57eb58]">Locked Code</h3>
					<pre class="max-h-20 overflow-auto rounded bg-[#1a1a1a] p-1 text-white">{gameState.lockedCodeString || '(empty)'}</pre>
				</div>

				<!-- Pet Mood Preview -->
				<div class="mb-3 border-b border-[#32539a] pb-2">
					<h3 class="mb-1 font-bold text-[#57eb58]">Pet Mood Preview</h3>
					<div class="flex gap-2">
						<select
							value={forcedMood}
							onchange={(e) => applyForcedMood((e.currentTarget as HTMLSelectElement).value as PetMood | '')}
							class="flex-1 rounded bg-[#1a1a1a] px-2 py-1 text-white"
						>
							<option value="">(current: {gameState.petMood})</option>
							{#each PET_MOODS as m (m)}
								<option value={m}>{m}</option>
							{/each}
						</select>
						<button
							onclick={() => applyForcedMood('')}
							class="rounded bg-[#32539a] px-2 py-1 text-white hover:bg-[#4a6bb8]"
							title="Clear forced mood"
						>✕</button>
					</div>
				</div>

				<!-- Actions -->
				<div class="flex flex-wrap gap-2">
					<button
						onclick={() => gameState.jumpToStage(0, 0)}
						class="rounded bg-red-900 px-3 py-1 text-white hover:bg-red-700"
					>
						Reset All
					</button>
					<button
						onclick={() => {
							gameState.testsPassed = true;
						}}
						class="rounded bg-amber-800 px-3 py-1 text-white hover:bg-amber-600"
					>
						Force Pass Tests
					</button>
					<button
						onclick={() => gameState.advanceStage()}
						class="rounded bg-green-900 px-3 py-1 text-white hover:bg-green-700"
					>
						Skip Stage
					</button>
					<a
						href="/playground"
						class="rounded bg-purple-900 px-3 py-1 text-white hover:bg-purple-700"
					>
						Error Playground
					</a>
					<a
						href="/level-editor"
						class="rounded bg-sky-900 px-3 py-1 text-white hover:bg-sky-700 font-bold"
					>
						Level Editor
					</a>
				</div>
			</div>
		{/if}
	</div>
{/if}
