<!-- src/lib/components/codepad/Codepad.svelte -->
<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { EditorView, lineNumbers, highlightActiveLineGutter, keymap } from '@codemirror/view';
	import { EditorState, Compartment } from '@codemirror/state';
	import { python } from '@codemirror/lang-python';
	import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';
	import {
		syntaxHighlighting,
		defaultHighlightStyle,
		indentOnInput,
		bracketMatching,
		indentUnit
	} from '@codemirror/language';
	import type { PetMemory } from '../../state/progressionState.svelte';

	let {
		code = $bindable(''),
		petMemory = { variables: {}, functions: {}, moodTriggers: {} },
		isEditable = false,
		testsPassed = false,
		standalone = false,
		showDeploy = false,
		onRunTests,
		onSave
	} = $props<{
		code?: string;
		petMemory?: PetMemory;
		isEditable?: boolean;
		testsPassed?: boolean;
		standalone?: boolean;
		showDeploy?: boolean;
		onRunTests?: () => void;
		onSave?: (currentCode: string) => void;
	}>();

	let editorContainer: HTMLDivElement;
	let view: EditorView;

	const editableCompartment = new Compartment();

	const retroTheme = EditorView.theme(
		{
			'&': {
				color: '#0f0b02',
				backgroundColor: '#ffffff',
				fontFamily: 'monospace',
				fontSize: '1.125rem',
				height: '100%'
			},
			'.cm-content': { padding: '10px' },
			'&.cm-focused .cm-cursor': { borderLeftColor: '#32539a', borderLeftWidth: '3px' },
			'&.cm-focused .cm-selectionBackground, ::selection': { backgroundColor: '#adf18a' },
			'.cm-gutters': {
				backgroundColor: '#e3dfd3',
				color: '#32539a',
				borderRight: '2px solid #0f0b02',
				fontWeight: 'bold'
			}
		},
		{ dark: false }
	);



	onMount(() => {
		const state = EditorState.create({
			doc: code,
			extensions: [
				lineNumbers(),
				highlightActiveLineGutter(),
				history(),
				indentOnInput(),
				bracketMatching(),
				indentUnit.of('  '),
				keymap.of([...defaultKeymap, ...historyKeymap, indentWithTab]),
				python(),
				syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
				retroTheme,

				editableCompartment.of(EditorView.editable.of(isEditable)),

				EditorView.updateListener.of((update) => {
					if (update.docChanged) code = update.state.doc.toString();
				})
			]
		});

		view = new EditorView({ state, parent: editorContainer });
	});

	// Reactive effect: hot-swap the CodeMirror editable setting when isEditable changes
	$effect(() => {
		if (view) {
			view.dispatch({
				effects: editableCompartment.reconfigure(EditorView.editable.of(isEditable))
			});
		}
	});

	// Sync external code updates into the editor
	$effect(() => {
		if (view && code !== view.state.doc.toString()) {
			view.dispatch({
				changes: { from: 0, to: view.state.doc.length, insert: code }
			});
		}
	});

	onDestroy(() => {
		if (view) view.destroy();
	});
</script>

<!-- The HTML template below stays exactly the same -->
<div
	class="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border-4 border-[#32539a] bg-[#e3dfd3] p-4 shadow-lg transition-all duration-500 {isEditable
		? 'border-[#57eb58] shadow-[0_0_20px_rgba(87,235,88,0.3)]'
		: ''}"
>
	<!-- Header -->
	{#if !standalone}
		<div class="mb-2 flex items-center justify-between">
			<h2 class="text-sm font-bold {isEditable ? 'text-[#0f0b02]' : 'text-[#32539a]'} uppercase">
				{isEditable ? '/// CODEPAD [EDIT MODE]' : '/// CODEPAD [LOCKED]'}
			</h2>

			{#if isEditable}
				<div class="flex gap-2">
					<button
						onclick={onRunTests}
						class="rounded border-2 border-[#0f0b02] bg-white px-3 py-2 text-xs font-bold tracking-wider text-[#32539a] uppercase shadow-[2px_2px_0px_#0f0b02] transition-all hover:bg-[#e3dfd3] active:translate-y-[2px] active:shadow-none"
					>
						Run Tests
					</button>

					<button
						onclick={() => onSave && onSave(code)}
						disabled={!(showDeploy && testsPassed)}
						class="rounded border-2 border-[#0f0b02] bg-[#adf18a] px-3 py-2 text-xs font-bold tracking-wider text-[#0f0b02] uppercase shadow-[2px_2px_0px_#0f0b02] transition-all hover:bg-[#57eb58] active:translate-y-[2px] active:shadow-none disabled:translate-y-[2px] disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none disabled:grayscale"
					>
						Save & Deploy
					</button>
				</div>
			{/if}
		</div>
	{/if}
	<div class="flex-1 flex flex-col overflow-hidden rounded-md border-2 border-[#0f0b02] bg-white text-lg font-bold shadow-inner">
		{#if Object.keys(petMemory.variables).length > 0 || Object.keys(petMemory.functions).length > 0}
			<div class="bg-[#f0ece1] text-[#7a8da3] p-2 text-sm m-0 border-b-2 border-dashed border-[#d3cebe] flex flex-col gap-2 font-mono opacity-90 select-none">
				<div class="font-bold uppercase tracking-wider text-xs mb-1">Ada's Memory</div>
				{#if Object.keys(petMemory.variables).length > 0}
					<div class="flex flex-col gap-1">
						<span class="text-[#32539a] text-[0.65rem] uppercase tracking-wider">Variables (Data)</span>
						{#each Object.entries(petMemory.variables) as [key, val] (key)}
							<div class="bg-white/50 px-2 py-1 flex rounded border border-[#d3cebe]/50 truncate shadow-sm text-[#0f0b02]"><span class="text-amber-600 pr-2">[var]</span>{val}</div>
						{/each}
					</div>
				{/if}
				{#if Object.keys(petMemory.functions).length > 0}
					<div class="flex flex-col gap-1 mt-1">
						<span class="text-[#32539a] text-[0.65rem] uppercase tracking-wider">Functions (Code)</span>
						{#each Object.entries(petMemory.functions) as [key, val] (key)}
							<details class="group bg-white/50 rounded border border-[#d3cebe]/50 shadow-sm text-[#0f0b02]">
								<summary class="px-2 py-1 flex items-center cursor-pointer hover:bg-white/70 select-none list-none [&::-webkit-details-marker]:hidden">
									<div class="flex-1 truncate"><span class="text-cyan-600 pr-2 font-normal">[def]</span>{key}(...)</div>
									<span class="text-xs text-[#7a8da3] opacity-60 group-open:rotate-180 transition-transform">▼</span>
								</summary>
								<div class="px-3 py-2 bg-[#e3dfd3] border-t border-[#d3cebe]/50 text-xs font-mono whitespace-pre overflow-x-auto text-[#0f0b02] opacity-80">{val}</div>
							</details>
						{/each}
					</div>
				{/if}
			</div>
		{/if}
		<div bind:this={editorContainer} class="flex-1 overflow-hidden"></div>
	</div>
</div>

<style>
	:global(.cm-editor) {
		height: 100%;
	}
	:global(.cm-scroller) {
		overflow: auto;
	}
</style>
