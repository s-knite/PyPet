<script lang="ts">
  import type { StageStepDef } from '$lib/utils/stageLoader';
  import { PET_MOODS } from '$lib/state/uiState.svelte';
  
  let { step = $bindable(), idx, onDelete }: { step: StageStepDef, idx: number, onDelete: () => void } = $props();

  const actionTypes = [
      { value: 'open_codepad', label: 'Open Editor' },
      { value: 'close_codepad', label: 'Close Editor' },
      { value: 'codepad_test', label: 'Code Test' },
      { value: 'repl_test', label: 'Terminal / REPL Test' },
      { value: 'click_target', label: 'Click Interaction Target' },
      { value: 'save_and_deploy', label: 'Save & Deploy (End Stage)' },
      { value: 'freeplay', label: 'Freeplay Sandbox' }
  ];

  function addMessage() {
      if (step.type === 'dialogue') {
          if (!step.messages) step.messages = [];
          step.messages.push("");
      }
  }

  function addCodepadTest() {
      if (step.type === 'action' && step.actionType === 'codepad_test') {
          if (!step.tests) step.tests = [];
          step.tests.push({ 
              id: step.tests.length + 1, 
              text: 'New Requirement', 
              check: 'functionExists', 
              args: { name: 'my_function' },
              hint: 'Try creating a function.'
          });
      }
  }

  async function copyStepData() {
      try {
          await navigator.clipboard.writeText(JSON.stringify(step, null, 2));
      } catch {
          alert('Failed to copy step data');
      }
  }

  async function pasteStepData() {
      try {
          const text = await navigator.clipboard.readText();
          const parsed = JSON.parse(text);
          if (parsed && typeof parsed === 'object') {
              if (parsed.type === step.type) {
                  for (const key of Object.keys(step)) {
                      delete (step as any)[key];
                  }
                  Object.assign(step, parsed);
              } else {
                  alert(`Cannot paste a ${parsed.type || 'unknown'} step over a ${step.type} block! (Types must match)`);
              }
          }
      } catch {
          alert('Invalid JSON in clipboard');
      }
  }
</script>

<div class="group border rounded-lg overflow-hidden border-neutral-800 bg-neutral-900/50 shadow-sm flex flex-col">
    <!-- Header/Handle -->
    <div class="flex justify-between items-center flex-wrap px-3 py-2 bg-neutral-900 border-b border-neutral-800">
        <div class="flex items-center gap-3">
            <span class="cursor-grab hover:text-white text-neutral-500 hidden md:block" title="Drag to reorder" aria-hidden="true">⋮⋮</span>
            <span class="font-mono text-xs text-neutral-500 bg-black/50 px-1.5 py-0.5 rounded">#{idx + 1}</span>
            
            {#if step.type === 'dialogue'}
                <span class="px-2 py-0.5 rounded text-xs font-bold bg-cyan-900/40 text-cyan-300 border border-cyan-800/50">DIALOGUE</span>
            {:else if step.type === 'action'}
                <span class="px-2 py-0.5 rounded text-xs font-bold bg-amber-900/40 text-amber-300 border border-amber-800/50">ACTION</span>
                <select bind:value={step.actionType} class="text-sm bg-neutral-950 border border-neutral-700 text-amber-300 rounded px-2 py-0.5 focus:outline-none">
                    {#each actionTypes as type (type.value)}
                        <option value={type.value}>{type.label}</option>
                    {/each}
                </select>
            {/if}
        </div>
        <div class="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button onclick={copyStepData} class="text-[10px] uppercase font-bold text-neutral-400 hover:text-emerald-400 px-2 py-1 bg-black/30 rounded border border-neutral-800 hover:border-emerald-900" title="Copy Step JSON">Copy</button>
            <button onclick={pasteStepData} class="text-[10px] uppercase font-bold text-neutral-400 hover:text-emerald-400 px-2 py-1 bg-black/30 rounded border border-neutral-800 hover:border-emerald-900" title="Paste/Overwrite Step JSON">Paste</button>
            <button onclick={onDelete} class="text-neutral-500 hover:text-red-400 p-1 ml-1" title="Delete Step">
                ✕
            </button>
        </div>
    </div>

    <!-- Body -->
    <div class="p-4 space-y-4">
        {#if step.type === 'dialogue'}
            <label class="flex items-center gap-3 cursor-pointer p-3 bg-neutral-950 rounded-lg border border-neutral-800">
                <input type="checkbox" bind:checked={step.blockFinalMessage} class="w-4 h-4 rounded border-neutral-700 text-cyan-500 focus:ring-cyan-500 focus:ring-offset-neutral-950 bg-neutral-900" />
                <span class="text-sm font-medium text-neutral-300">Lock Final Message (User cannot proceed until auto-launched next action completes)</span>
            </label>

            <div class="space-y-2">
                {#if step.messages && step.messages.length > 0}
                    {#each step.messages as msg, i (i)}
                        <div class="flex gap-2 items-start relative group/msg" data-value={msg}>
                            <textarea bind:value={step.messages[i]} rows="2" placeholder="Guide text..." class="w-full bg-neutral-950 border border-neutral-800 rounded px-3 py-2 text-neutral-200 focus:outline-none focus:border-cyan-500 transition resize-y"></textarea>
                            <button onclick={() => step.type==='dialogue' && step.messages?.splice(i, 1)} class="mt-2 text-neutral-500 hover:text-red-400 opacity-0 group-hover/msg:opacity-100 transition">✕</button>
                        </div>
                    {/each}
                {:else}
                    <p class="text-sm text-neutral-500 italic">No messages. Add one to show dialogue.</p>
                {/if}
                <button onclick={addMessage} class="text-xs text-cyan-500 hover:text-cyan-400 transition font-medium">+ Add Message</button>
            </div>
            
        {:else if step.type === 'action'}
            {#if step.actionType === 'codepad_test'}
                <!-- Checkbox requirements -->
                <div class="space-y-2 bg-indigo-950/20 p-3 rounded-lg border border-indigo-900/50">
                    <div class="flex justify-between">
                        <h4 class="text-sm font-semibold text-indigo-300">Code Tests</h4>
                        <label class="flex items-center gap-2 cursor-pointer">
                            <input type="checkbox" bind:checked={step.accumulateTests} class="w-3 h-3 text-indigo-500" />
                            <span class="text-xs text-neutral-400">Keep prior checks</span>
                        </label>
                    </div>
                    
                    {#if step.tests}
                        {#each step.tests as test, ti (ti)}
                            <div class="flex flex-col gap-2 p-3 bg-black/20 rounded border border-indigo-900/30 group/test relative" data-type={test.check}>
                                <button onclick={() => step.tests?.splice(ti, 1)} class="absolute top-2 right-2 text-neutral-500 hover:text-red-400 opacity-0 group-hover/test:opacity-100">✕</button>
                                
                                <div class="flex gap-2 w-full pr-6">
                                    <input type="number" bind:value={step.tests[ti].id} placeholder="ID" class="w-16 text-xs bg-neutral-950 border border-neutral-800 rounded px-2 py-1 text-neutral-300" />
                                    <input type="text" bind:value={step.tests[ti].text} placeholder="UI Requirement Statement" class="flex-1 text-xs bg-neutral-950 border border-neutral-800 rounded px-2 py-1 text-white font-medium" />
                                </div>
                                <div class="flex gap-2">
                                    <select bind:value={step.tests[ti].check} class="w-40 text-xs bg-neutral-900 border border-neutral-700 text-indigo-300 rounded px-2 py-1">
                                        <option value="functionExists">functionExists</option>
                                        <option value="functionParamsCount">functionParamsCount</option>
                                        <option value="functionOutputMatches">functionOutputMatches</option>
                                        <option value="functionRunsWithoutError">functionRunsWithoutError</option>
                                        <option value="variableValueMatches">variableValueMatches</option>
                                        <option value="functionReturns">functionReturns</option>
                                        <option value="codeCompiles">codeCompiles</option>
                                    </select>
                                    <input type="text" bind:value={test.hint} placeholder="Error Hint..." class="flex-1 text-xs bg-neutral-950 border border-neutral-800 rounded px-2 py-1 text-red-300" />
                                </div>
                                <!-- Dynamic args form based on test check type -->
                                {#if test.check === 'functionExists'}
                                    <div class="flex items-center gap-2 mt-1">
                                        <span class="text-[10px] text-neutral-400 font-mono">args.name:</span>
                                        <input type="text" value={test.args?.name || ''} oninput={(e) => test.args = { ...test.args, name: e.currentTarget.value }} class="flex-1 bg-neutral-950 border border-neutral-800 rounded px-2 py-1 text-xs text-emerald-200" placeholder="Function Name" />
                                    </div>
                                {:else if test.check === 'functionParamsCount'}
                                    <div class="flex items-center gap-2 mt-1">
                                        <span class="text-[10px] text-neutral-400 font-mono">args.name:</span>
                                        <input type="text" value={test.args?.name || ''} oninput={(e) => test.args = { ...test.args, name: e.currentTarget.value }} class="flex-1 bg-neutral-950 border border-neutral-800 rounded px-2 py-1 text-xs text-emerald-200" placeholder="Function Name" />
                                        <span class="text-[10px] text-neutral-400 font-mono ml-2">count:</span>
                                        <input type="number" value={test.args?.count || 0} oninput={(e) => test.args = { ...test.args, count: parseInt(e.currentTarget.value) }} class="w-16 bg-neutral-950 border border-neutral-800 rounded px-2 py-1 text-xs text-emerald-200" />
                                    </div>
                                {:else if test.check === 'functionOutputMatches'}
                                    <div class="flex items-center gap-2 mt-1">
                                        <span class="text-[10px] text-neutral-400 font-mono">args.name:</span>
                                        <input type="text" value={test.args?.name || ''} oninput={(e) => test.args = { ...test.args, name: e.currentTarget.value }} class="w-1/3 bg-neutral-950 border border-neutral-800 rounded px-2 py-1 text-xs text-emerald-200" placeholder="Function Name" />
                                        <span class="text-[10px] text-neutral-400 font-mono ml-2">output:</span>
                                        <input type="text" value={test.args?.output || ''} oninput={(e) => test.args = { ...test.args, output: e.currentTarget.value }} class="flex-1 bg-neutral-950 border border-neutral-800 rounded px-2 py-1 text-xs text-emerald-200" placeholder="Expected Output" />
                                    </div>
                                {:else if test.check === 'functionRunsWithoutError'}
                                    <div class="flex items-center gap-2 mt-1">
                                        <span class="text-[10px] text-neutral-400 font-mono">args.name:</span>
                                        <input type="text" value={test.args?.name || ''} oninput={(e) => test.args = { ...test.args, name: e.currentTarget.value }} class="flex-1 bg-neutral-950 border border-neutral-800 rounded px-2 py-1 text-xs text-emerald-200" placeholder="Function Name" />
                                    </div>
                                {:else if test.check === 'variableValueMatches'}
                                    <div class="flex items-center gap-2 mt-1 flex-wrap">
                                        <span class="text-[10px] text-neutral-400 font-mono">args.name:</span>
                                        <input type="text" value={test.args?.name || ''} oninput={(e) => test.args = { ...test.args, name: e.currentTarget.value }} class="w-1/3 bg-neutral-950 border border-neutral-800 rounded px-2 py-1 text-xs text-emerald-200" placeholder="Variable Name" />
                                        <span class="text-[10px] text-neutral-400 font-mono ml-2">value:</span>
                                        <input type="text" value={test.args?.value || ''} oninput={(e) => {
                                            let val: any = e.currentTarget.value;
                                            if (!isNaN(Number(val)) && val.trim() !== '') val = Number(val);
                                            test.args = { ...test.args, value: val };
                                        }} class="flex-1 bg-neutral-950 border border-neutral-800 rounded px-2 py-1 text-xs text-emerald-200" placeholder="Number/String Value..." />
                                    </div>
                                {:else if test.check === 'functionReturns'}
                                    <div class="flex items-center gap-2 mt-1 flex-wrap">
                                        <span class="text-[10px] text-neutral-400 font-mono">args.name:</span>
                                        <input type="text" value={test.args?.name || ''} oninput={(e) => test.args = { ...test.args, name: e.currentTarget.value }} class="w-1/3 bg-neutral-950 border border-neutral-800 rounded px-2 py-1 text-xs text-emerald-200" placeholder="Function Name" />
                                        <span class="text-[10px] text-neutral-400 font-mono ml-2">expectedValue:</span>
                                        <input type="text" value={test.args?.expectedValue || ''} oninput={(e) => {
                                            let val: any = e.currentTarget.value;
                                            if (!isNaN(Number(val)) && val.trim() !== '') val = Number(val);
                                            test.args = { ...test.args, expectedValue: val };
                                        }} class="flex-1 bg-neutral-950 border border-neutral-800 rounded px-2 py-1 text-xs text-emerald-200" placeholder="Return value..." />
                                    </div>
                                {:else if test.check === 'codeCompiles'}
                                    <!-- No arguments required -->
                                {:else}
                                    <textarea 
                                        value={JSON.stringify(test.args, null, 2)}
                                        oninput={(e) => { try { test.args = JSON.parse(e.currentTarget.value) } catch { /* ignore typing errors */ } }} 
                                        rows="1" 
                                        placeholder="Args JSON..."
                                        class="w-full text-[10px] font-mono bg-neutral-950 border border-neutral-800 rounded p-2 text-emerald-200 focus:border-indigo-500 focus:outline-none"
                                    ></textarea>
                                {/if}


                            </div>
                        {/each}
                    {/if}
                    <button onclick={addCodepadTest} class="text-xs text-indigo-400 hover:text-indigo-300">+ Add Check</button>
                </div>

            {:else if step.actionType === 'repl_test'}
                <div class="space-y-2 bg-purple-950/20 p-3 rounded-lg border border-purple-900/50">
                    <h4 class="text-sm font-semibold text-purple-300">Terminal Matchers</h4>
                    {#if step.replChecks}
                        {#each step.replChecks as rCheck, ri (ri)}
                            <div class="flex flex-col gap-2 p-2 bg-black/20 rounded border border-purple-900/30 group/repl" data-type={rCheck.type}>
                                <div class="flex justify-between items-center">
                                    <div class="flex items-center gap-2">
                                        <select bind:value={step.replChecks[ri].type} class="text-xs bg-neutral-900 border border-neutral-700 text-purple-300 rounded px-2 py-1">
                                            <option value="exactMatch">exactMatch</option>
                                            <option value="matchOutput">matchOutput</option>
                                            <option value="commandContains">commandContains</option>
                                        </select>
                                        
                                        {#if rCheck.type === 'matchOutput' || rCheck.type === 'commandContains'}
                                        <label class="flex items-center gap-1 ml-1 text-[10px] text-neutral-400 cursor-pointer">
                                            <input type="checkbox" bind:checked={step.replChecks[ri].ignoreCase} class="rounded bg-neutral-900 border-neutral-700 text-purple-500 w-3 h-3" />
                                            Ignore Case
                                        </label>
                                        {/if}
                                    </div>
                                    <button onclick={() => step.replChecks?.splice(ri, 1)} class="text-neutral-500 hover:text-red-400 opacity-0 group-hover/repl:opacity-100">✕</button>
                                </div>
                                <div class="flex flex-col gap-1">
                                    <span class="text-[10px] text-neutral-500 uppercase tracking-wider font-semibold">Accepted Matches</span>
                                    <div class="space-y-1 mt-1">
                                        {#each rCheck.accept as _, ai}
                                            <div class="flex items-center gap-1">
                                                <input type="text" bind:value={rCheck.accept[ai]} placeholder="Matched string..." class="flex-1 text-xs bg-neutral-950 border border-neutral-800 rounded px-2 py-1 text-white" />
                                                <button onclick={() => rCheck.accept.splice(ai, 1)} class="text-neutral-500 hover:text-red-400">✕</button>
                                            </div>
                                        {/each}
                                        <button onclick={() => rCheck.accept.push('')} class="text-[10px] text-purple-400 hover:text-purple-300 block">+ Add Match</button>
                                    </div>
                                </div>
                            </div>
                        {/each}
                    {/if}
                    <button onclick={() => {if(!step.replChecks) step.replChecks=[]; step.replChecks.push({type: 'exactMatch', accept: []})}} class="text-xs text-purple-400 hover:text-purple-300">+ Add Repl Matcher</button>
                </div>

            {:else if step.actionType === 'click_target'}
                <div class="space-y-4 bg-emerald-950/20 p-3 rounded-lg border border-emerald-900/50">
                    <label class="flex items-center gap-2">
                        <span class="text-sm font-semibold text-emerald-300">Target Object:</span>
                        <!-- In the engine this doesn't explicitly store clickTarget right now but it could be expanded if multiple targets existed -->
                        <select class="text-sm bg-neutral-900 border border-neutral-700 text-white rounded px-3 py-1">
                            <option value="egg">Egg</option>
                            <option value="pet">Hatched Pet</option>
                        </select>
                    </label>
                    <label class="flex items-center gap-2">
                        <span class="text-sm font-semibold text-emerald-300">Required Clicks:</span>
                        <input type="number" bind:value={step.targetClicks} min="1" class="w-20 text-sm bg-neutral-950 border border-neutral-800 rounded px-2 py-1 text-white" />
                    </label>
                </div>
            {:else if step.actionType === 'open_codepad'}
                <p class="text-sm text-neutral-500 italic px-2">Engine will wait for user to click the "Open Editor" button.</p>
            {:else if step.actionType === 'close_codepad'}
                <p class="text-sm text-neutral-500 italic px-2">Engine will instantly close the editor.</p>
            {:else if step.actionType === 'save_and_deploy'}
                <p class="text-sm text-neutral-500 italic px-2 mb-2">Engine will wait for user to click "Save & Deploy".</p>
                <div class="bg-amber-950/20 p-3 rounded-lg border border-amber-900/50">
                    <h4 class="text-sm font-semibold text-amber-300 mb-2">Mood Triggers (Link Functions)</h4>
                    {#if step.saveDeployMoods}
                        <div class="space-y-2">
                            {#each step.saveDeployMoods as mapping, mi}
                                <div class="flex items-center gap-2">
                                    <input type="text" bind:value={mapping.targetName} placeholder="Function (e.g. sleep)" class="w-1/2 text-xs bg-neutral-950 border border-neutral-800 rounded px-2 py-1 text-white" />
                                    <!-- arrow icon -->
                                    <span class="text-neutral-500">→</span>
                                    <select bind:value={mapping.mood} class="flex-1 text-xs bg-neutral-900 border border-neutral-700 text-amber-200 rounded px-2 py-1">
                                        {#each PET_MOODS as mood}
                                            <option value={mood}>{mood}</option>
                                        {/each}
                                    </select>
                                    <button onclick={() => step.saveDeployMoods?.splice(mi, 1)} class="text-neutral-500 hover:text-red-400">✕</button>
                                </div>
                            {/each}
                        </div>
                    {/if}
                    <button onclick={() => { if(!step.saveDeployMoods) step.saveDeployMoods = []; step.saveDeployMoods.push({targetName: '', mood: 'happy'}) }} class="text-xs text-amber-400 hover:text-amber-300 mt-2 block">+ Add Mood Link</button>
                </div>
            {:else if step.actionType === 'freeplay'}
                <p class="text-sm text-neutral-500 italic px-2">Sandbox unlocked.</p>
            {/if}
        {/if}
    </div>
</div>
