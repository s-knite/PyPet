// src/lib/state/progressionState.svelte.ts
// Owns the persistent game progression data: which stage the student is on,
// their active and locked code, pet clicks, and save/load from localStorage.
// Contains NO game flow logic — loading stages, advancing, etc. stays in the orchestrator.

import { storyLevels, type StoryLevel, type StoryStage } from '../utils/stageLoader';
import type { PetMood } from './uiState.svelte';

export interface PetMemory {
	variables: Record<string, string>;
	functions: Record<string, string>;
	moodTriggers: Record<string, PetMood>;
}

export class ProgressionState {
	currentLevelIndex = $state(0);
	currentStageIndex = $state(0);

	get currentLevel(): StoryLevel {
		return storyLevels[this.currentLevelIndex];
	}

	get currentStage(): StoryStage {
		return this.currentLevel.stages[this.currentStageIndex];
	}

	// The code currently in the codepad's editable area
	activeCode = $state('');
	// Structured memory of all locked code/skills
	petMemory = $state<PetMemory>({
		variables: {},
		functions: {},
		moodTriggers: {}
	});

	// Helper to generate a flat string of all locked code for the python engine
	get lockedCodeString(): string {
		const lines: string[] = [];
		for (const v in this.petMemory.variables) lines.push(this.petMemory.variables[v]);
		for (const f in this.petMemory.functions) lines.push(this.petMemory.functions[f]);
		return lines.join('\n\n');
	}

	// Pet click counter (used for stages that require clicking the pet to hatch)
	petClicks = $state(0);

	saveProgress() {
		const saveData = {
			levelIndex: this.currentLevelIndex,
			stageIndex: this.currentStageIndex,
			petMemory: this.petMemory,
			activeCode: this.activeCode
		};
		localStorage.setItem('pypet_save', JSON.stringify(saveData));
	}

	loadProgress() {
		const saved = localStorage.getItem('pypet_save');
		if (saved) {
			try {
				const data = JSON.parse(saved);
				this.currentLevelIndex = data.levelIndex || 0;
				this.currentStageIndex = data.stageIndex || 0;
				this.petMemory = data.petMemory || { variables: {}, functions: {}, moodTriggers: {} };
				this.activeCode = data.activeCode || '';
				
				// Ensure loaded indexes are valid against the new nested levels schema
				if (!this.currentLevel) {
					this.currentLevelIndex = 0;
					this.currentStageIndex = 0;
				} else if (!this.currentStage) {
					this.currentLevelIndex = 0;
					this.currentStageIndex = 0;
				}
			} catch {
				console.error('Save file corrupted.');
			}
		}
	}
}
