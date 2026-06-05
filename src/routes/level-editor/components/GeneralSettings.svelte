<script lang="ts">
  import type { StageDef } from '$lib/utils/stageLoader';
  
  let { 
    stage = $bindable(),
    onDuplicate
  }: { 
    stage: StageDef,
    onDuplicate: () => void 
  } = $props();
</script>

<div class="bg-neutral-950 border border-neutral-800 rounded-xl p-6 shadow-sm">
    <div class="flex justify-between items-start mb-6 border-b border-neutral-800 pb-4">
    <h2 class="text-2xl font-bold bg-clip-text text-transparent bg-linear-to-r from-white to-neutral-400">Stage Details</h2>
    <div class="flex gap-2">
        <button onclick={onDuplicate} class="px-3 py-1 bg-neutral-800 hover:bg-neutral-700 text-sm rounded transition">Duplicate</button>
        <span class="px-3 py-1 bg-neutral-800/50 text-neutral-400 font-mono text-sm rounded">ID: {stage.id}</span>
    </div>
    </div>
    
    <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
    <div>
        <label class="block text-sm font-medium text-neutral-400 mb-2">Stage Title
            <input type="text" bind:value={stage.title} class="w-full mt-2 bg-neutral-900 border border-neutral-700 rounded px-3 py-2 text-white focus:outline-none focus:border-cyan-500 transition" />
        </label>
    </div>
    
    <div class="flex flex-col gap-3 justify-center">
        <label class="flex items-center gap-3 cursor-pointer group">
            <input type="checkbox" bind:checked={stage.isReplEnabled} class="w-4 h-4 rounded border-neutral-700 text-cyan-500 focus:ring-cyan-500 focus:ring-offset-neutral-950 bg-neutral-900" />
            <span class="text-sm font-medium text-neutral-300 group-hover:text-white transition">Enable REPL Interactivity</span>
        </label>

        <div class="text-xs text-neutral-500 italic mt-1">
            Steps: {stage.steps?.length ?? 0} ({stage.steps?.filter(s => s.type === 'dialogue').length ?? 0} dialogue, {stage.steps?.filter(s => s.type === 'action').length ?? 0} actions)
        </div>
    </div>
    </div>
    
    <!-- Initial Settings -->
    <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6 pt-6 border-t border-neutral-800/50">
    <div>
        <label class="block text-sm font-medium text-neutral-400 mb-2">Initial Active Code
        <textarea bind:value={stage.activeCodeInitial} rows="3" class="w-full mt-2 bg-neutral-900 border border-neutral-700 rounded px-3 py-2 text-white font-mono text-sm focus:outline-none focus:border-cyan-500 transition" placeholder="Code loaded into editor"></textarea>
        </label>
    </div>
    <div>
        <label class="block text-sm font-medium text-neutral-400 mb-2">Initial Locked Code
        <textarea bind:value={stage.lockedCodeInitial} rows="3" class="w-full mt-2 bg-neutral-900 border border-neutral-700 rounded px-3 py-2 text-white font-mono text-sm focus:outline-none focus:border-cyan-500 transition" placeholder="Hidden code running before student code"></textarea>
        </label>
    </div>
    <div>
        <label class="block text-sm font-medium text-emerald-500/80 mb-2">Dev Solution Code
        <textarea bind:value={stage.devSolutionCode} rows="3" class="w-full mt-2 bg-neutral-900 border border-emerald-900/50 rounded px-3 py-2 text-emerald-200 font-mono text-sm focus:outline-none focus:border-emerald-500 transition" placeholder="Code auto-loaded when testing via DevPanel"></textarea>
        </label>
    </div>
    </div>
</div>
