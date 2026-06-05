<!-- src/lib/components/guide/Guide.svelte -->
<script lang="ts">
	import { gameState } from '$lib/state/gameState.svelte';

	function formatMessage(msg: string) {
		if (!msg) return '';
		// Encode HTML first to prevent XSS
		const escaped = msg.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
		
		// Multi-line code blocks
		let html = escaped.replace(/```([\s\S]+?)```/g, '<div class="select-none bg-[#2a2a2a] text-[#eadaad] p-3 rounded font-mono text-base border border-[#444] whitespace-pre overflow-x-auto my-3 block shadow-inner">$1</div>');
		
		// Inline code blocks
		html = html.replace(/`([^`]+)`/g, '<code class="select-none inline-block bg-[#e6e4df] text-[#c92a2a] px-1.5 py-0.5 rounded font-mono text-[0.85em] border border-[#d2d0cb] shadow-sm transform -translate-y-px">$1</code>');
		
		// Bold text
		html = html.replace(/\*\*([^*]+)\*\*/g, '<strong class="text-[#32539a]">$1</strong>');
		return html;
	}

</script>

{#if gameState.getCurrentAction()?.actionType === 'freeplay' && !gameState.isGuideVisible}
	<div class="absolute bottom-10 left-1/2 -translate-x-1/2 flex justify-center z-50 animate-fade-in pointer-events-none">
		<button 
			class="pointer-events-auto rounded-lg border-b-4 border-[#0f0b02] bg-[#adf18a] px-8 py-3 text-lg font-black tracking-wider text-[#0f0b02] uppercase shadow-[4px_4px_0px_#0f0b02] transition-all hover:bg-[#57eb58] active:translate-y-[4px] active:border-b-0 active:shadow-none"
			onclick={() => gameState.advanceStep()}
		>
			Finish Freeplay ➔
		</button>
	</div>
{/if}

{#if gameState.isGuideVisible}
	<!-- Wrapper -->
	<div class="animate-fade-in z-10 @container {gameState.mode === 'play' ? 'absolute right-6 bottom-6 left-6' : 'relative mt-4 w-full shrink-0'}">

		<!-- Avatar Box -->
		<div
			class="pointer-events-none absolute z-20 drop-shadow-[0_0_12px_rgba(50,83,154,0.6)] @md:-top-8 @md:bottom-auto @md:left-4 @md:h-72 @md:w-56 bottom-0 left-4 h-40 w-32"
			style="transition: width 0.5s, height 0.5s;"
		>
			<!-- 1. Base Hologram -->
			<img
				src="/chu.png"
				alt="CHU Guide"
				class="hologram-base absolute inset-0 h-full w-full object-contain object-bottom"
			/>
			<!-- 2. Scanning Overlay -->
			<div
				class="pointer-events-none absolute inset-0 overflow-hidden"
				style="-webkit-mask-image: url('/chu.png'); -webkit-mask-size: contain; -webkit-mask-position: bottom; -webkit-mask-repeat: no-repeat;"
			>
				<div class="animate-scan-fast absolute top-0 left-0 h-full w-16 bg-linear-to-r from-transparent via-[rgba(255,255,255,0.7)] to-transparent"></div>
				<div class="animate-scan-slow absolute top-0 left-0 h-full w-32 bg-linear-to-r from-transparent via-[rgba(173,241,138,0.3)] to-transparent opacity-70"></div>
				<div class="animate-scan-random absolute top-0 left-0 h-full w-8 bg-linear-to-r from-transparent via-[rgba(255,255,255,0.9)] to-transparent opacity-60"></div>
			</div>
		</div>

		<!-- Dialog Text Box -->
		<button
			class="group relative z-10 flex w-full cursor-pointer flex-col justify-between rounded-xl border-[6px] border-[#32539a] bg-white text-left whitespace-pre-wrap shadow-xl hover:bg-[#f8f7f4] min-h-[140px] p-5 pb-[160px] @md:p-6 @md:pl-[15rem] @md:pb-6 @md:min-h-[17rem]"
			style="transition: padding 0.5s, min-height 0.5s;"
			onclick={() => gameState.advanceGuide()}
		>
			<p class="leading-relaxed font-bold text-[#0f0b02] text-xl md:text-2xl">
				<!-- eslint-disable-next-line svelte/no-at-html-tags -->
				{@html formatMessage(gameState.currentMessage)}
			</p>
		</button>
		
		<!-- Click Arrow -->
		{#if gameState.canAdvanceGuide}
			<div class="pointer-events-none absolute bottom-5 right-5 z-20 animate-bounce-small text-[#32539a] @md:bottom-6 @md:right-6">
				<span class="text-3xl font-black">▼</span>
			</div>
		{/if}
	</div>
{/if}

<style>
	/* RPG Guide Animations */
	@keyframes fadeIn {
		from {
			opacity: 0;
			transform: translateY(10px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}
	.animate-fade-in {
		animation: fadeIn 0.2s ease-out forwards;
	}

	@keyframes bounceSmall {
		0%,
		100% {
			transform: translateY(0);
		}
		50% {
			transform: translateY(6px);
		}
	}
	.animate-bounce-small {
		animation: bounceSmall 1.2s infinite ease-in-out;
	}

	/* Hologram Styles */
	.hologram-base {
		filter: sepia(80%) hue-rotate(180deg) saturate(150%) brightness(1.1);
		opacity: 0.95;
		animation: randomPop 11s infinite;
	}

	@keyframes randomPop {
		0%,
		100% {
			filter: sepia(80%) hue-rotate(180deg) saturate(150%) brightness(1.1);
		}
		12% {
			filter: sepia(80%) hue-rotate(180deg) saturate(150%) brightness(1.1);
		}
		13% {
			filter: sepia(90%) hue-rotate(190deg) saturate(200%) brightness(1.4);
		}
		14% {
			filter: sepia(80%) hue-rotate(180deg) saturate(150%) brightness(1.1);
		}
		35% {
			filter: sepia(80%) hue-rotate(180deg) saturate(150%) brightness(1.1);
		}
		36% {
			filter: sepia(100%) hue-rotate(200deg) saturate(250%) brightness(1.5);
		}
		37% {
			filter: sepia(80%) hue-rotate(180deg) saturate(150%) brightness(1.1);
		}
		38% {
			filter: sepia(90%) hue-rotate(180deg) saturate(180%) brightness(1.3);
		}
		39% {
			filter: sepia(80%) hue-rotate(180deg) saturate(150%) brightness(1.1);
		}
		68% {
			filter: sepia(80%) hue-rotate(180deg) saturate(150%) brightness(1.1);
		}
		69% {
			filter: sepia(70%) hue-rotate(170deg) saturate(300%) brightness(1.2);
		}
		70% {
			filter: sepia(80%) hue-rotate(180deg) saturate(150%) brightness(1.1);
		}
		85% {
			filter: sepia(80%) hue-rotate(180deg) saturate(150%) brightness(1.1);
		}
		86% {
			filter: sepia(90%) hue-rotate(190deg) saturate(200%) brightness(1.3);
		}
		87% {
			filter: sepia(80%) hue-rotate(180deg) saturate(150%) brightness(1.1);
		}
	}

	@keyframes scanHorizontal {
		0% {
			transform: translateX(-150px);
		}
		100% {
			transform: translateX(350px);
		}
	}

	.animate-scan-fast {
		animation: scanHorizontal 2.3s linear infinite;
	}
	.animate-scan-slow {
		animation: scanHorizontal 4.7s linear infinite;
	}
	.animate-scan-random {
		animation: scanHorizontal 3.1s ease-in-out infinite alternate;
	}
</style>
