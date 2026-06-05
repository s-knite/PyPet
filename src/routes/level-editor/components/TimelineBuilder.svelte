<script lang="ts">
  import type { StageDef, DialogueStepDef, ActionStepDef } from '$lib/utils/stageLoader';
  import StepBlock from './StepBlock.svelte';

  let { stage = $bindable() }: { stage: StageDef } = $props();

  if (!stage.steps) stage.steps = [];

  let draggedStepIndex: number | null = $state(null);

  function addStep(type: 'dialogue' | 'action') {
      if (!stage.steps) stage.steps = [];
      if (type === 'dialogue') {
          stage.steps.push({ type: 'dialogue', messages: ['New message...'], blockFinalMessage: true } as DialogueStepDef);
      } else {
          stage.steps.push({ type: 'action', actionType: 'codepad_test' } as ActionStepDef);
      }
  }

  function removeStep(idx: number) {
      if (!stage.steps) return;
      stage.steps.splice(idx, 1);
  }

  function handleDragStart(e: DragEvent, index: number) {
      draggedStepIndex = index;
      if (e.dataTransfer) {
          e.dataTransfer.effectAllowed = 'move';
          // Required for Firefox
          e.dataTransfer.setData('text/plain', index.toString());
          
          setTimeout(() => {
              if (e.target && e.target instanceof HTMLElement) {
                  e.target.classList.add('opacity-30', 'scale-[0.98]');
              }
          }, 0);
      }
  }

  function handleDrop(e: DragEvent, targetIndex: number) {
      e.preventDefault();
      if (draggedStepIndex === null || draggedStepIndex === targetIndex || !stage.steps) return;
      
      const items = stage.steps;
      const [reorderedItem] = items.splice(draggedStepIndex, 1);
      items.splice(targetIndex, 0, reorderedItem);
      
      draggedStepIndex = null;
  }

  function handleDragEnd(e: DragEvent) {
      draggedStepIndex = null;
      if (e.target && e.target instanceof HTMLElement) {
          e.target.classList.remove('opacity-30', 'scale-[0.98]');
      }
  }
</script>

<div class="bg-neutral-950 border border-neutral-800 rounded-xl p-6 shadow-sm space-y-4">
    <div class="flex justify-between items-center pb-2 border-b border-neutral-800">
        <h3 class="text-lg font-semibold text-neutral-200">Timeline Steps</h3>
        <div class="flex gap-2">
            <button onclick={() => addStep('dialogue')} class="px-3 py-1.5 text-xs font-semibold bg-cyan-900/30 hover:bg-cyan-900/50 text-cyan-300 rounded transition border border-cyan-800/50">+ Add Dialogue</button>
            <button onclick={() => addStep('action')} class="px-3 py-1.5 text-xs font-semibold bg-amber-900/30 hover:bg-amber-900/50 text-amber-300 rounded transition border border-amber-800/50">+ Add Action</button>
        </div>
    </div>
    
    {#if !stage.steps || stage.steps.length === 0}
        <div class="p-8 text-center text-neutral-500 border-2 border-dashed border-neutral-800 rounded-lg">
            No steps defined. Add a Dialogue or Action step to begin the timeline.
        </div>
    {:else}
        <div class="space-y-4 pt-2" role="list">
            {#each stage.steps as step, idx (step)}
                <div 
                    class="relative transition-all duration-200 cursor-grab active:cursor-grabbing"
                    role="listitem"
                    draggable="true"
                    ondragstart={(e) => handleDragStart(e, idx)}
                    ondragover={(e) => { e.preventDefault(); e.dataTransfer!.dropEffect = 'move'; }}
                    ondrop={(e) => handleDrop(e, idx)}
                    ondragend={handleDragEnd}
                >
                    <!-- Wrapper block to handle drag and drop target properly without inner blocks eating events -->
                    <StepBlock bind:step={stage.steps[idx]} {idx} onDelete={() => removeStep(idx)} />
                </div>
            {/each}
        </div>
    {/if}
</div>
