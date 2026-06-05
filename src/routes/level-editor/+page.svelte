<script lang="ts">
  import levelsData from '$lib/data/levels.json';
  import type { LevelDef, StageDef } from '$lib/utils/stageLoader';
  import Sidebar from './components/Sidebar.svelte';
  import GeneralSettings from './components/GeneralSettings.svelte';
  import TimelineBuilder from './components/TimelineBuilder.svelte';
  
  // Clone the JSON data to break references and make it reactive with Svelte 5's $state
  let levels: LevelDef[] = $state(JSON.parse(JSON.stringify(levelsData)).map((l: LevelDef) => ({
      ...l,
      stages: l.stages.map((s: StageDef) => ({
          ...s,
          isReplEnabled: s.isReplEnabled ?? true,
          steps: s.steps ?? []
      }))
  })));
  let selectedLevelIndex = $state(0);
  let selectedStageIndex = $state(0);
  
  let currentStage = $derived(levels[selectedLevelIndex]?.stages[selectedStageIndex]);
  
  let isSaving = $state(false);
  let saveMessage = $state('');

  async function saveStages() {
    isSaving = true;
    saveMessage = 'Saving...';
    try {
      const res = await fetch('/level-editor/api/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(levels)
      });
      const result = await res.json();
      if (result.success) {
        saveMessage = 'Saved Successfully!';
        setTimeout(() => saveMessage = '', 3000);
      } else {
        saveMessage = 'Error: ' + result.error;
      }
    } catch (err) {
      saveMessage = 'Failed to save!';
      console.error(err);
    } finally {
      isSaving = false;
    }
  }

  async function copyGlobalJSON() {
    try {
      await navigator.clipboard.writeText(JSON.stringify(levels, null, 2));
      saveMessage = 'JSON copied!';
      setTimeout(() => saveMessage = '', 2000);
    } catch {
      saveMessage = 'Copy Failed';
      setTimeout(() => saveMessage = '', 2000);
    }
  }

  async function pasteGlobalJSON() {
    try {
      const text = await navigator.clipboard.readText();
      const data = JSON.parse(text);
      if (Array.isArray(data)) {
        levels = data;
        saveMessage = 'JSON pasted!';
        setTimeout(() => saveMessage = '', 2000);
      } else {
        throw new Error();
      }
    } catch {
      saveMessage = 'Invalid JSON';
      setTimeout(() => saveMessage = '', 2000);
    }
  }

  function duplicateStage() {
    if (!currentStage || !levels[selectedLevelIndex]) return;
    const currentLevel = levels[selectedLevelIndex];
    const newId = currentLevel.stages.length > 0 ? Math.max(...currentLevel.stages.map(s => s.id)) + 1 : 0;
    const duplicated = JSON.parse(JSON.stringify(currentStage));
    duplicated.id = newId;
    duplicated.title += ' (Copy)';
    currentLevel.stages.push(duplicated);
    selectedStageIndex = currentLevel.stages.length - 1;
  }
</script>

<div class="fixed inset-0 bg-neutral-900 text-neutral-200 flex flex-col font-sans overflow-hidden">
  <!-- Top Bar -->
  <header class="h-16 flex items-center justify-between px-6 bg-neutral-950 border-b border-neutral-800 shadow-md z-10">
    <div class="flex items-center gap-4">
      <h1 class="text-xl font-bold bg-clip-text text-transparent bg-linear-to-r from-emerald-400 to-cyan-500">
         PyPet Level Editor
      </h1>
      <span class="px-2 py-1 text-xs font-semibold bg-neutral-800 text-neutral-400 rounded">DEV ONLY</span>
    </div>
    
    <div class="flex items-center gap-4">
      {#if saveMessage}
         <span class="text-sm font-medium {saveMessage.includes('Error') || saveMessage.includes('Failed') || saveMessage.includes('Invalid') ? 'text-red-400' : 'text-emerald-400'}">{saveMessage}</span>
      {/if}
      <button onclick={copyGlobalJSON} class="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 font-medium text-sm rounded shadow transition">Copy JSON</button>
      <button onclick={pasteGlobalJSON} class="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 font-medium text-sm rounded shadow transition">Paste JSON</button>
      <button 
         onclick={saveStages}
         disabled={isSaving}
         class="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-medium rounded shadow transition-all active:scale-95"
      >
         Save to Disk
      </button>
      <a href="/" class="text-sm text-neutral-400 hover:text-white transition">Exit</a>
    </div>
  </header>

  <div class="flex flex-1 overflow-hidden">
    <!-- Modular Sidebar Component -->
    <Sidebar bind:levels bind:selectedLevelIndex bind:selectedStageIndex />

    <!-- Main Editor -->
    <main class="flex-1 overflow-y-auto bg-neutral-900 p-8">
      {#if currentStage}
        <div class="max-w-4xl mx-auto space-y-8 pb-32">
           <GeneralSettings bind:stage={levels[selectedLevelIndex].stages[selectedStageIndex]} onDuplicate={duplicateStage} />
           <TimelineBuilder bind:stage={levels[selectedLevelIndex].stages[selectedStageIndex]} />
           <div class="h-12"><!-- Spacer --></div>
        </div>
      {:else}
        <div class="h-full flex flex-col items-center justify-center text-neutral-500">
           <div class="text-6xl mb-4">🎨</div>
           <h2 class="text-xl font-bold bg-clip-text text-transparent bg-linear-to-r from-emerald-400 to-cyan-500 mb-2">Visual Level Editor</h2>
           <p>Select a stage from the sidebar or create a new one.</p>
        </div>
      {/if}
    </main>
  </div>
</div>

<style>
   /* Custom scrollbar matching dark aesthetics */
   ::-webkit-scrollbar {
       width: 8px;
       height: 8px;
   }
   ::-webkit-scrollbar-track {
       background: transparent;
   }
   ::-webkit-scrollbar-thumb {
       background: rgba(255, 255, 255, 0.1);
       border-radius: 4px;
   }
   ::-webkit-scrollbar-thumb:hover {
       background: rgba(255, 255, 255, 0.2);
   }
</style>
