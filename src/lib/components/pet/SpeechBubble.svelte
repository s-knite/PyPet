<!-- src/lib/components/pet/SpeechBubble.svelte -->
<script lang="ts">
	import { gameState } from '$lib/state/gameState.svelte';

	let canDismiss = $state(false);

	// Whenever new speech appears, lock dismissal for a minimum display time
	$effect(() => {
		if (gameState.petSpeechText) {
			canDismiss = false;
			const timer = setTimeout(() => {
				canDismiss = true;
			}, 2000); // 2 second minimum display
			return () => clearTimeout(timer);
		}
	});

	function dismiss() {
		if (canDismiss) {
			gameState.dismissPetSpeech();
		}
	}
</script>

{#if gameState.petSpeechText}
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div
		class="speech-bubble z-10 {canDismiss ? 'cursor-pointer' : 'cursor-default'}"
		onclick={dismiss}
	>
		<div
			class="relative max-w-xs rounded-2xl border-4 border-[#0f0b02] bg-white px-5 py-3 shadow-xl"
		>
			<p
				class="custom-scrollbar m-0 max-h-48 overflow-y-auto text-lg leading-snug font-bold whitespace-pre-wrap text-[#0f0b02]"
			>
				{gameState.petSpeechText}
			</p>
		</div>
		<!-- SVG Tail pointing down, centered under the bubble -->
		<svg
			class="mx-auto block"
			width="24"
			height="16"
			viewBox="0 0 24 16"
			fill="none"
			xmlns="http://www.w3.org/2000/svg"
		>
			<!-- White fill with black stroke matching the border -->
			<path
				d="M0 0 L12 14 L24 0"
				fill="white"
				stroke="#0f0b02"
				stroke-width="4"
				stroke-linejoin="round"
			/>
			<!-- Cover the top border so it merges with the bubble -->
			<rect x="0" y="0" width="24" height="4" fill="white" />
		</svg>
	</div>
{/if}

<style>
	.speech-bubble {
		animation: gentleFloat 2.5s ease-in-out infinite;
	}

	@keyframes gentleFloat {
		0%,
		100% {
			transform: translateY(0);
		}
		50% {
			transform: translateY(-4px);
		}
	}

	.custom-scrollbar::-webkit-scrollbar {
		width: 4px;
	}
	.custom-scrollbar::-webkit-scrollbar-thumb {
		background-color: #e3dfd3;
		border-radius: 4px;
	}
</style>
