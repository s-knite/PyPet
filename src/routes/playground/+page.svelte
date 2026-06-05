<!-- src/routes/playground/+page.svelte -->
<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { PythonEngine } from '$lib/utils/pythonEngine';
	import { translateError } from '$lib/utils/errorTranslator';
	import { runTestCheck, type StageTestDef, type Requirement, type ReplCheckDef } from '$lib/utils/stageLoader';
	import { codeCompiles } from '$lib/utils/testRunner';
	import { analyzeReplExecution } from '$lib/services/pythonAnalyzer';
	import Codepad from '$lib/components/codepad/Codepad.svelte';

	let engine: PythonEngine;
	let inputCode = $state('');

	// Translator State
	let rawOutput = $state('');
	let rawError = $state('');
	let translatedOutput = $state<string[]>([]);

	// Interactive input() state
	let awaitingInput = $state(false);
	let pendingInputText = $state('');
	let terminalLogs = $state<string[]>([]);
	let terminalInputEl = $state<HTMLInputElement | undefined>(undefined);

	// Test Builder State
	let testRunResult = $state<{
		passed: boolean;
		requirements: Requirement[];
		overrideHint?: string;
	} | null>(null);
	let visualTests = $state<StageTestDef[]>([
		{
			id: 1,
			text: "Define a function called 'greeting'",
			check: 'functionExists',
			args: { name: 'greeting' },
			hint: 'Start with: def greeting():'
		}
	]);

	let visualReplCheck = $state<ReplCheckDef | null>(null);
	let replRunResult = $state<{ passed: boolean; message: string } | null>(null);

	let generatedJSON = $derived(JSON.stringify({ tests: visualTests, replCheck: visualReplCheck }, null, 2));

	let isRunning = $state(false);

	onMount(() => {
		engine = new PythonEngine();
		engine.onPrint = (text) => {
			rawOutput += text + '\n';
			terminalLogs.push(text);
		};
		engine.onSystemLog = (text) => {
			rawOutput += text + '\n';
			terminalLogs.push(text);
		};
		engine.onInputRequest = () => {
			awaitingInput = true;
			setTimeout(() => terminalInputEl?.focus(), 50);
		};
	});

	onDestroy(() => {
		if (engine) engine.reboot();
	});

	function handleTerminalSubmit(e: Event) {
		e.preventDefault();
		if (!awaitingInput || !engine) return;
		const text = pendingInputText;
		pendingInputText = '';
		terminalLogs.push(text);
		awaitingInput = false;
		engine.provideInput(text);
	}

	async function runSimulatedTest(context: 'repl' | 'deploy') {
		if (!engine || !inputCode.trim()) return;

		isRunning = true;
		rawOutput = '';
		rawError = '';
		translatedOutput = [];
		terminalLogs = [];
		awaitingInput = false;

		try {
			await engine.wipeEnvironment();
			if (context === 'repl') {
				const result = await analyzeReplExecution(engine, inputCode);
				if (result.status === 'success') {
					rawOutput += '\n--- REPL Execution Finished ---';
					if (result.output) rawOutput += '\nOutput:\n' + result.output;
					
					// Evaluate the replCheck if present
					if (visualReplCheck) {
						if (visualReplCheck.type === 'exactMatch') {
							const acceptSet = new Set(visualReplCheck.accept.map((s) => s.replace(/\s+/g, '')));
							const isMatch = acceptSet.has(inputCode.replace(/\s+/g, ''));
							replRunResult = { passed: isMatch, message: isMatch ? 'Matched exact keys!' : 'Failed exact match.' };
						} else {
							const acceptArr = visualReplCheck.ignoreCase ? visualReplCheck.accept.map((s) => s.toLowerCase().trim()) : visualReplCheck.accept.map((s) => s.trim());
							let out = (result.output || '').trim();
							if (visualReplCheck.ignoreCase) out = out.toLowerCase();
							const isMatch = acceptArr.includes(out);
							replRunResult = { passed: isMatch, message: isMatch ? 'Matched output!' : 'Failed output match.' };
						}
					}
				} else {
					rawError = result.rawErrorLine || 'Unknown REPL Error';
					translatedOutput = result.friendlyMessage ? (Array.isArray(result.friendlyMessage) ? result.friendlyMessage : [result.friendlyMessage]) : translateError(rawError, context, inputCode);
				}
			} else {
				await engine.runCode(inputCode);
				rawOutput += '\n--- Deploy Execution Finished Without Errors ---';
			}
		} catch (error) {
			rawError = String(error);
			translatedOutput = translateError(rawError, context, inputCode);
		} finally {
			isRunning = false;
			awaitingInput = false;
		}
	}

	async function runVisualTests() {
		if (!engine || !inputCode.trim() || visualTests.length === 0) return;

		isRunning = true;
		testRunResult = null;
		rawOutput = '';

		try {
			await engine.wipeEnvironment();
			const reqs: Requirement[] = visualTests.map((t) => ({
				id: t.id,
				text: t.text,
				passed: false
			}));

			// Compile step
			const compileResult = await codeCompiles(engine, inputCode);
			if (!compileResult.passed) {
				testRunResult = { passed: false, requirements: reqs, overrideHint: compileResult.reason };
				return;
			}

			// Run each test
			for (let i = 0; i < visualTests.length; i++) {
				const testDef = visualTests[i];

				// Deep copy args so we don't mutate state visually
				const parsedArgs: Record<string, unknown> = JSON.parse(JSON.stringify(testDef.args));

				// Quick hack: Parse args string arrays if the user comma-separated them in the UI
				if (typeof parsedArgs.testArgs === 'string') {
					parsedArgs.testArgs = (parsedArgs.testArgs as string).split(',').map((s) => {
						const trimmed = s.trim();
						// Attempt to interpret numbers or booleans, else strip quotes if they wrapped strings
						if (!isNaN(Number(trimmed)) && trimmed !== '') return Number(trimmed);
						if (trimmed === 'true') return true;
						if (trimmed === 'false') return false;
						return trimmed.replace(/^["'](.*)["']$/, '$1');
					});
				}
				if (typeof parsedArgs.mockInputs === 'string') {
					parsedArgs.mockInputs = (parsedArgs.mockInputs as string)
						.split(',')
						.map((s) => s.trim().replace(/^["'](.*)["']$/, '$1'));
				}
				if (typeof parsedArgs.mockRandoms === 'string') {
					parsedArgs.mockRandoms = (parsedArgs.mockRandoms as string)
						.split(',')
						.map((s) => Number(s.trim()));
				}

				const result = await runTestCheck(engine, inputCode, testDef.check, parsedArgs);

				if (result.passed) {
					reqs[i].passed = true;
				} else {
					testRunResult = { passed: false, requirements: reqs, overrideHint: result.reason };
					return;
				}
			}

			testRunResult = { passed: true, requirements: reqs };
			rawOutput += '\n--- All Tests Passed! ---';
		} finally {
			isRunning = false;
		}
	}

	function addTest() {
		visualTests = [
			...visualTests,
			{
				id: visualTests.length ? Math.max(...visualTests.map((t) => t.id)) + 1 : 1,
				text: 'New Test',
				check: 'functionExists',
				args: { name: '' },
				hint: ''
			}
		];
	}

	function removeTest(index: number) {
		visualTests = visualTests.filter((_, i) => i !== index);
	}
</script>

<main class="flex h-screen w-screen flex-col bg-[#e3dfd3] p-8 font-mono text-[#0f0b02]">
	<header class="mb-6 flex shrink-0 items-end justify-between border-b-4 border-[#32539a] pb-2">
		<h1 class="text-3xl font-bold tracking-widest text-[#32539a] uppercase">
			Error Translator Playground
		</h1>
		<a href="/" class="font-bold text-[#32539a] hover:underline">← Back to PyPet</a>
	</header>

	<div class="grid flex-1 grid-cols-[1fr_2fr_1fr] gap-4 overflow-hidden">
		<!-- Left: Input & Translator -->
		<div class="flex flex-col gap-4 overflow-y-auto pr-2">
			<!-- Removed the min-h and hardcoded input container, replaced with Codepad -->
			<div class="flex h-[400px] flex-col rounded-xl border-4 border-[#32539a] shadow-xl">
				<Codepad bind:code={inputCode} isEditable={true} standalone={true} />
			</div>
			<div class="flex flex-wrap gap-2">
				<button
					onclick={() => runSimulatedTest('deploy')}
					disabled={isRunning}
					class="flex-1 rounded bg-[#32539a] p-2 text-sm font-bold text-white shadow-lg transition-transform hover:-translate-y-1 active:translate-y-0 disabled:opacity-50"
				>
					Sim. Deploy
				</button>
				<button
					onclick={() => runSimulatedTest('repl')}
					disabled={isRunning}
					class="flex-1 rounded bg-amber-600 p-2 text-sm font-bold text-white shadow-lg transition-transform hover:-translate-y-1 active:translate-y-0 disabled:opacity-50"
				>
					Sim. REPL
				</button>
				<button
					onclick={runVisualTests}
					disabled={isRunning || visualTests.length === 0}
					class="flex-1 rounded bg-green-700 p-2 text-sm font-bold text-white shadow-lg transition-transform hover:-translate-y-1 active:translate-y-0 disabled:opacity-50"
				>
					Run Unit Tests
				</button>
			</div>

			<!-- Test Runner Results -->
			{#if testRunResult}
				<div class="rounded-xl border-[6px] border-green-800 bg-green-50 p-4 shadow-xl">
					<h2 class="mb-2 font-bold text-green-800 uppercase">Unit Tests Results</h2>
					<div class="mb-4">
						{#each testRunResult.requirements as req (req.id)}
							<div class="flex items-center gap-2">
								<span>{req.passed ? '✅' : '❌'}</span>
								<span
									class={req.passed
										? 'text-green-800 line-through opacity-70'
										: 'font-bold text-red-800'}>{req.text}</span
								>
							</div>
						{/each}
					</div>

					{#if !testRunResult.passed}
						<div class="rounded border-2 border-red-200 bg-white p-3">
							<p class="mb-1 font-bold text-red-800">👨‍🏫 Professor Chu's Test Hint:</p>
							{#if testRunResult.overrideHint}
								<p class="font-semibold text-gray-800">{testRunResult.overrideHint}</p>
							{:else}
								{@const failReq = testRunResult.requirements.find((r) => !r.passed)}
								<p class="font-semibold text-gray-800">
									{visualTests.find((t) => t.id === failReq?.id)?.hint}
								</p>
							{/if}
						</div>
					{/if}
				</div>
			{/if}

			<!-- REPL Results -->
			{#if replRunResult}
				<div class="rounded-xl border-[6px] border-amber-800 bg-amber-50 p-4 shadow-xl mt-4">
					<h2 class="mb-2 font-bold text-amber-800 uppercase">REPL Check Results</h2>
					<div class="flex items-center gap-2">
						<span>{replRunResult.passed ? '✅' : '❌'}</span>
						<span class="font-bold {replRunResult.passed ? 'text-amber-700' : 'text-red-800'}">{replRunResult.message}</span>
					</div>
				</div>
			{/if}
		</div>

		<!-- Middle: Visual Test Builder -->
		<div class="flex flex-col gap-4 overflow-y-auto pr-2">
			<div class="flex items-center justify-between">
				<h2 class="font-bold text-[#32539a] uppercase">Visual Test Builder</h2>
				<button
					onclick={addTest}
					class="hover:bg-opacity-80 rounded bg-[#32539a] px-3 py-1 text-white">+ Add Test</button
				>
			</div>

			{#each visualTests as test, i (test.id)}
				<div class="rounded-xl border-4 border-gray-400 bg-white p-4">
					<div class="mb-3 flex items-center justify-between border-b pb-2">
						<span class="font-bold text-gray-500">Test #{test.id}</span>
						<button onclick={() => removeTest(i)} class="text-red-500 hover:text-red-700"
							>❌ Remove</button
						>
					</div>

					<div class="flex flex-col gap-2 text-sm">
						<label class="flex flex-col font-bold"
							>Requirement Text:
							<input
								type="text"
								bind:value={test.text}
								class="rounded border bg-gray-100 p-1 font-normal"
								placeholder="e.g. Define a function"
							/>
						</label>

						<label class="flex flex-col font-bold"
							>Test Check:
							<select bind:value={test.check} class="rounded border bg-gray-100 p-1 font-normal">
								<option value="functionExists">functionExists</option>
								<option value="functionParamsCount">functionParamsCount</option>
								<option value="functionRunsWithoutError">functionRunsWithoutError</option>
								<option value="functionOutputMatches">functionOutputMatches</option>
								<option value="functionReturns">functionReturns</option>
							</select>
						</label>

						<div class="rounded border border-gray-200 bg-[#f8f7f4] p-2">
							<p class="mb-1 text-xs font-bold tracking-wider text-gray-500 uppercase">
								Arguments Object
							</p>

							<div class="flex flex-col gap-1">
								<input
									type="text"
									bind:value={test.args.name}
									class="w-full rounded border bg-white p-1 text-sm"
									placeholder="Target Function Name (e.g. greeting)"
								/>

								{#if test.check === 'functionParamsCount'}
									<input
										type="number"
										bind:value={test.args.expectedCount}
										class="w-full rounded border bg-white p-1 text-sm"
										placeholder="Expected Count (e.g. 1)"
									/>
								{/if}

								{#if test.check === 'functionOutputMatches' || test.check === 'functionReturns' || test.check === 'functionRunsWithoutError'}
									<input
										type="text"
										bind:value={test.args.testArgs}
										class="w-full rounded border bg-white p-1 text-sm"
										placeholder="Function Args to call with (e.g. 'Ada', 5)"
									/>
									<input
										type="text"
										bind:value={test.args.mockInputs}
										class="w-full rounded border bg-white p-1 text-sm"
										placeholder="Mock input() queue (e.g. 'Cat', 'Dog')"
									/>
									<input
										type="text"
										bind:value={test.args.mockRandoms}
										class="w-full rounded border bg-white p-1 text-sm"
										placeholder="Mock randint() queue (e.g. 3, 7)"
									/>
								{/if}

								{#if test.check === 'functionOutputMatches'}
									<input
										type="text"
										bind:value={test.args.expectedOutput}
										class="w-full rounded border bg-white p-1 text-sm font-bold"
										placeholder="Expected Output String (e.g. Hello)"
									/>
								{/if}

								{#if test.check === 'functionReturns'}
									<input
										type="text"
										bind:value={test.args.expectedReturn}
										class="w-full rounded border bg-white p-1 text-sm font-bold"
										placeholder="Expected Return (e.g. 10)"
									/>
								{/if}
							</div>
						</div>

						<label class="flex flex-col font-bold"
							>Fallback Hint:
							<textarea
								bind:value={test.hint}
								class="h-12 rounded border bg-gray-100 p-1 font-normal"
								placeholder="Start with: def greeting():"
							></textarea>
						</label>
					</div>
				</div>
			{/each}

			<div class="flex items-center justify-between border-t border-gray-300 pt-4 mt-4">
				<h2 class="font-bold text-[#32539a] uppercase">Visual REPL Check Builder</h2>
				{#if !visualReplCheck}
					<button
						onclick={() => visualReplCheck = { type: 'matchOutput', accept: [''] }}
						class="hover:bg-opacity-80 rounded bg-[#32539a] px-3 py-1 text-white text-sm"
					>+ Add REPL Check</button>
				{/if}
			</div>

			{#if visualReplCheck}
				<div class="rounded-xl border-4 border-amber-400 bg-amber-50 p-4">
					<div class="mb-3 flex items-center justify-between border-b pb-2">
						<span class="font-bold text-amber-800">REPL Check Settings</span>
						<button onclick={() => visualReplCheck = null} class="text-red-500 hover:text-red-700 text-sm">❌ Remove</button>
					</div>
					<div class="flex flex-col gap-2 text-sm">
						<label class="flex flex-col font-bold text-amber-900">Check Type:
							<select bind:value={visualReplCheck.type} class="rounded border border-amber-300 bg-white p-1 font-normal">
								<option value="exactMatch">exactMatch</option>
								<option value="matchOutput">matchOutput</option>
							</select>
						</label>
						{#if visualReplCheck.type === 'matchOutput'}
							<label class="flex items-center gap-2 font-bold text-amber-900 mt-2">
								<input type="checkbox" bind:checked={visualReplCheck.ignoreCase} class="rounded" />
								Ignore Case
							</label>
						{/if}

						<div class="mt-2 space-y-2">
							<span class="font-bold text-amber-900 text-xs uppercase tracking-wider">Accepted Values</span>
							{#each visualReplCheck.accept as _, i (i)}
								<div class="flex gap-2">
									<input type="text" bind:value={visualReplCheck.accept[i]} class="flex-1 rounded border border-amber-300 bg-white px-2 py-1" />
									<button onclick={() => visualReplCheck!.accept.splice(i, 1)} class="text-red-500 hover:text-red-700 font-bold px-2">✕</button>
								</div>
							{/each}
							<button onclick={() => visualReplCheck!.accept.push('')} class="text-xs font-bold text-amber-700 hover:text-amber-900">+ Add Value</button>
						</div>
					</div>
				</div>
			{/if}
		</div>

		<!-- Right: Outputs & Live JSON -->
		<div class="flex flex-col gap-6 overflow-y-auto">
			{#if rawError || translatedOutput.length > 0}
				<div class="rounded-xl border-[6px] border-red-800 bg-red-50 p-6 shadow-xl">
					<h2 class="mb-2 font-bold text-red-800 uppercase">👨‍🏫 Professor Chu's Translation</h2>
					{#if translatedOutput.length > 0}
						{#each translatedOutput as line (line)}
							<p class="mb-2 text-lg font-semibold">{line}</p>
						{/each}
					{:else}
						<p class="text-gray-500 italic">No translation found for this error.</p>
					{/if}
				</div>
			{/if}

			<!-- Mini Terminal for interactive input() -->
			{#if terminalLogs.length > 0 || awaitingInput}
				<div class="rounded-xl border-[6px] border-amber-500 bg-[#0f0b02] p-4 font-mono text-[#adf18a] shadow-xl">
					<h2 class="mb-2 font-bold text-amber-400 uppercase">Interactive Terminal</h2>
					{#each terminalLogs as line, idx (idx)}
						<pre class="m-0 whitespace-pre-wrap min-h-[1.5em]">{line || ' '}</pre>
					{/each}
					{#if awaitingInput}
						<form onsubmit={handleTerminalSubmit} class="mt-1 flex items-center">
							<span class="mr-2 animate-pulse text-[#f0c040]">?</span>
							<input
								bind:this={terminalInputEl}
								type="text"
								bind:value={pendingInputText}
								class="flex-1 bg-transparent text-[#f0c040] outline-none placeholder-[#f0c040]/40"
								placeholder="Type your answer..."
								autocomplete="off"
							/>
						</form>
					{/if}
				</div>
			{/if}

			<div
				class="rounded-xl border-[6px] border-gray-400 bg-[#1a1a1a] p-4 text-[#adf18a] shadow-xl"
			>
				<h2 class="mb-2 font-bold text-gray-400 uppercase">Raw Stack Trace</h2>
				<pre class="font-mono text-sm whitespace-pre-wrap">{rawError || 'No errors!'}</pre>
			</div>

			<div class="rounded-xl border-[6px] border-gray-400 bg-white p-4 shadow-xl">
				<h2 class="mb-2 font-bold text-gray-400 uppercase">Standard Output</h2>
				<pre class="font-mono whitespace-pre-wrap">{rawOutput || 'No output'}</pre>
			</div>

			<div
				class="flex max-h-[300px] flex-col rounded-xl border-[6px] border-gray-400 bg-white p-4 shadow-xl"
			>
				<div class="mb-2 flex items-center justify-between">
					<h2 class="font-bold text-gray-400 uppercase">Live JSON</h2>
					<button
						onclick={() => navigator.clipboard.writeText(generatedJSON)}
						class="rounded bg-gray-200 px-2 py-1 text-xs text-gray-700 hover:bg-gray-300"
					>
						Copy JSON
					</button>
				</div>
				<pre class="overflow-y-auto font-mono text-xs whitespace-pre-wrap">{generatedJSON}</pre>
			</div>
		</div>
	</div>
</main>
