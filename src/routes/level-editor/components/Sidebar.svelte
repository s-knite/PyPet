<script lang="ts">
  import type { LevelDef, StageDef } from '$lib/utils/stageLoader';
  
  let { 
    levels = $bindable(), 
    selectedLevelIndex = $bindable(),
    selectedStageIndex = $bindable() 
  }: { 
    levels: LevelDef[], 
    selectedLevelIndex: number,
    selectedStageIndex: number
  } = $props();

  function reindexAll() {
    levels.forEach((l: LevelDef, i: number) => {
      l.id = i;
      l.stages.forEach((s: StageDef, j: number) => {
        s.id = j;
      });
    });
  }

  function addLevel() {
    const newId = levels.length > 0 ? Math.max(...levels.map((l: LevelDef) => l.id)) + 1 : 0;
    levels.push({
      id: newId,
      title: 'New Level',
      concept: 'New Concept',
      stages: []
    });
    selectedLevelIndex = levels.length - 1;
    selectedStageIndex = 0;
    reindexAll();
  }

  function addStage(levelIndex: number) {
    const level = levels[levelIndex];
    if (!level) return;
    const newId = level.stages.length > 0 ? Math.max(...level.stages.map((s: StageDef) => s.id)) + 1 : 0;
    level.stages.push({
      id: newId,
      title: 'New Stage',
      steps: [
        { type: 'dialogue', messages: ['Welcome to the new stage!'], blockFinalMessage: true }
      ]
    });
    selectedLevelIndex = levelIndex;
    selectedStageIndex = level.stages.length - 1;
    reindexAll();
  }

  function removeLevel(index: number) {
    if (confirm('Are you sure you want to delete this entire level and all its stages?')) {
      levels.splice(index, 1);
      if (selectedLevelIndex >= levels.length) {
        selectedLevelIndex = Math.max(0, levels.length - 1);
        selectedStageIndex = 0;
      }
      reindexAll();
    }
  }

  function removeStage(lIndex: number, sIndex: number) {
    if (confirm('Are you sure you want to delete this stage?')) {
      levels[lIndex].stages.splice(sIndex, 1);
      if (selectedLevelIndex === lIndex && selectedStageIndex >= levels[lIndex].stages.length) {
        selectedStageIndex = Math.max(0, levels[lIndex].stages.length - 1);
      }
      reindexAll();
    }
  }

  function moveLevel(index: number, direction: 'up' | 'down') {
    if (direction === 'up' && index > 0) {
      const temp = levels[index];
      levels[index] = levels[index - 1];
      levels[index - 1] = temp;
      if (selectedLevelIndex === index) selectedLevelIndex = index - 1;
      else if (selectedLevelIndex === index - 1) selectedLevelIndex = index;
    } else if (direction === 'down' && index < levels.length - 1) {
      const temp = levels[index];
      levels[index] = levels[index + 1];
      levels[index + 1] = temp;
      if (selectedLevelIndex === index) selectedLevelIndex = index + 1;
      else if (selectedLevelIndex === index + 1) selectedLevelIndex = index;
    }
    reindexAll();
  }

  function moveStage(lIndex: number, sIndex: number, direction: 'up' | 'down') {
    const level = levels[lIndex];
    if (direction === 'up' && sIndex > 0) {
      const temp = level.stages[sIndex];
      level.stages[sIndex] = level.stages[sIndex - 1];
      level.stages[sIndex - 1] = temp;
      if (selectedLevelIndex === lIndex) {
        if (selectedStageIndex === sIndex) selectedStageIndex = sIndex - 1;
        else if (selectedStageIndex === sIndex - 1) selectedStageIndex = sIndex;
      }
    } else if (direction === 'down' && sIndex < level.stages.length - 1) {
      const temp = level.stages[sIndex];
      level.stages[sIndex] = level.stages[sIndex + 1];
      level.stages[sIndex + 1] = temp;
      if (selectedLevelIndex === lIndex) {
        if (selectedStageIndex === sIndex) selectedStageIndex = sIndex + 1;
        else if (selectedStageIndex === sIndex + 1) selectedStageIndex = sIndex;
      }
    }
    reindexAll();
  }
</script>

<aside class="w-80 bg-neutral-950/50 border-r border-neutral-800 flex flex-col overflow-hidden">
    <div class="p-4 border-b border-neutral-800 flex justify-between items-center bg-neutral-900/50 shrink-0">
        <h2 class="font-semibold text-neutral-300">Levels ({levels.length})</h2>
        <button onclick={addLevel} class="w-8 h-8 flex items-center justify-center bg-neutral-800 hover:bg-neutral-700 rounded text-xl" title="Add Level">+</button>
    </div>
    <div class="flex-1 overflow-y-auto p-2 space-y-3">
        {#each levels as level, lIndex (level.id)}
            <div class="border border-neutral-800 rounded bg-neutral-900/30 overflow-hidden">
                <div class="p-2 bg-neutral-800/50 flex justify-between items-center border-b border-neutral-800">
                    <div class="font-bold text-emerald-400 text-sm truncate flex-1 flex gap-2 items-center">
                        <span class="text-xs bg-emerald-900/50 text-emerald-200 px-1 rounded">L{level.id}</span>
                        {level.title}
                    </div>
                    <div class="flex gap-1 shrink-0">
                        <input bind:value={level.title} class="sr-only" />
                        <button onclick={(e) => { e.stopPropagation(); moveLevel(lIndex, 'up'); }} disabled={lIndex === 0} class="w-6 h-6 flex items-center justify-center bg-neutral-700 hover:bg-neutral-600 disabled:opacity-30 rounded text-xs font-mono" title="Move Up">↑</button>
                        <button onclick={(e) => { e.stopPropagation(); moveLevel(lIndex, 'down'); }} disabled={lIndex === levels.length - 1} class="w-6 h-6 flex items-center justify-center bg-neutral-700 hover:bg-neutral-600 disabled:opacity-30 rounded text-xs font-mono" title="Move Down">↓</button>
                        <button onclick={(e) => { e.stopPropagation(); addStage(lIndex); }} class="w-6 h-6 flex items-center justify-center bg-cyan-900/40 hover:bg-cyan-800/60 text-cyan-400 rounded text-xs ml-1" title="Add Stage">+</button>
                        <button onclick={(e) => { e.stopPropagation(); removeLevel(lIndex); }} class="w-6 h-6 flex items-center justify-center bg-red-900/30 hover:bg-red-800/50 text-red-400 rounded text-xs" title="Delete Level">✕</button>
                    </div>
                </div>
                <div class="p-1 space-y-1">
                    {#if level.stages && level.stages.length > 0}
                        {#each level.stages as stage, sIndex (stage.id)}
                            <button 
                                onclick={() => { selectedLevelIndex = lIndex; selectedStageIndex = sIndex; }}
                                class="w-full text-left px-2 py-2 rounded flex items-center gap-2 transition-colors group {selectedLevelIndex === lIndex && selectedStageIndex === sIndex ? 'bg-cyan-900/40 border border-cyan-800/50 text-white' : 'hover:bg-neutral-800/50 text-neutral-400'}"
                            >
                                <div class="w-5 h-5 rounded-full bg-neutral-800 flex items-center justify-center text-[10px] font-mono shrink-0 group-hover:bg-neutral-700 {selectedLevelIndex === lIndex && selectedStageIndex === sIndex ? 'bg-cyan-800 text-cyan-200' : ''}">
                                    {stage.id}
                                </div>
                                <span class="truncate text-sm flex-1">{stage.title}</span>
                                <div class="opacity-0 group-hover:opacity-100 hidden group-hover:flex items-center transition-opacity shrink-0 gap-1" title="Actions">
                                    <div role="button" tabindex="0" aria-label="Move Up" onclick={(e) => { e.stopPropagation(); if(sIndex > 0) moveStage(lIndex, sIndex, 'up'); }} onkeydown={(e) => { e.stopPropagation(); if(e.key === 'Enter' && sIndex > 0) moveStage(lIndex, sIndex, 'up'); }} class="text-neutral-400 hover:text-white text-xs px-1 {sIndex === 0 ? 'opacity-30 cursor-not-allowed' : ''}">↑</div>
                                    <div role="button" tabindex="0" aria-label="Move Down" onclick={(e) => { e.stopPropagation(); if(sIndex < level.stages.length - 1) moveStage(lIndex, sIndex, 'down'); }} onkeydown={(e) => { e.stopPropagation(); if(e.key === 'Enter' && sIndex < level.stages.length - 1) moveStage(lIndex, sIndex, 'down'); }} class="text-neutral-400 hover:text-white text-xs px-1 {sIndex === level.stages.length - 1 ? 'opacity-30 cursor-not-allowed' : ''}">↓</div>
                                    <div role="button" tabindex="0" aria-label="Delete" onclick={(e) => { e.stopPropagation(); removeStage(lIndex, sIndex); }} onkeydown={(e) => { e.stopPropagation(); if(e.key === 'Enter') removeStage(lIndex, sIndex); }} class="text-red-400 hover:text-red-300 text-xs px-1 ml-1 border-l border-neutral-700">✕</div>
                                </div>
                            </button>
                        {/each}
                    {:else}
                        <div class="text-xs text-neutral-600 italic p-2 text-center">No stages</div>
                    {/if}
                </div>
            </div>
        {/each}
    </div>
</aside>
