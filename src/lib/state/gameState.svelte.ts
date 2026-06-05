// src/lib/state/gameState.svelte.ts
// The central orchestrator. Coordinates UIState, ProgressionState, PythonEngine,
// and the pythonAnalyzer service. Exposes a flat public API so that all Svelte
// components continue to read `gameState.xxx` without any path changes.
//
// === SCRIPTED TIMELINE ENGINE ===
// Each stage is a sequence of Steps (dialogue + actions). The engine walks
// through them using `currentStepIndex`, pausing at actions that require
// user interaction (REPL tests, codepad tests, clicks, etc.).

import { PythonEngine } from '../utils/pythonEngine';
import { UIState, type PetMood } from './uiState.svelte';
import { ProgressionState, type PetMemory } from './progressionState.svelte';
import { analyzeReplExecution, analyzeDeployment } from '../services/pythonAnalyzer';
import { translateError } from '../utils/errorTranslator';
import { extractMemory } from '../utils/pythonParser';
import {
	storyLevels,
	type StoryStage,
	type StoryStep,
	type DialogueStep,
	type ActionStep,
	type Requirement
} from '../utils/stageLoader';

type AppMode = 'play' | 'edit';

class GameState {
	// --- Private sub-state instances ---
	private ui = new UIState();
	private progression = new ProgressionState();

	// --- App-level state (belongs directly on the orchestrator) ---
	mode = $state<AppMode>('play');
	devMode = $state(import.meta.env.DEV);

	// Step tracking
	currentStepIndex = $state(0);

	// Codepad test results
	testsPassed = $state(false);
	testRequirements = $state<Requirement[]>([]);
	codeChangedSincePass = $state(false);

	// REPL history and log
	replLogs = $state<string[]>([]);
	replHistory = $state<string[]>([]);

	// Interactive input() state (driven by the Python worker)
	awaitingInput = $state(false);
	inputPrompt = $state('');

	// The Python Engine instance
	engine: PythonEngine;

	// -------------------------------------------------------------------------
	// Flat pass-through getters/setters for UIState
	// Components read these as if they were directly on gameState.
	// -------------------------------------------------------------------------

	get petMood(): PetMood {
		return this.ui.petMood;
	}
	set petMood(v: PetMood) {
		this.ui.petMood = v;
	}
	get isGuideVisible(): boolean {
		return this.ui.isGuideVisible;
	}
	get guideMessages(): string[] {
		return this.ui.guideMessages;
	}
	get currentMessageIndex(): number {
		return this.ui.currentMessageIndex;
	}
	get currentMessage(): string {
		return this.ui.currentMessage;
	}
	get savedGuideState(): { messages: string[]; index: number } | null {
		return this.ui.savedGuideState;
	}
	get petSpeechText(): string {
		return this.ui.petSpeechText;
	}

	showGuide(messages: string | string[]) {
		this.ui.showGuide(messages);
	}
	showInterruptGuide(messages: string | string[]) {
		this.ui.showInterruptGuide(messages);
	}

	get canAdvanceGuide(): boolean {
		if (this.ui.savedGuideState) return true; // Can always dismiss interrupts
		if (this.ui.currentMessageIndex < this.ui.guideMessages.length - 1) return true;
		return !this.ui.isGuideBlocked;
	}

	/**
	 * Called when the user clicks on the Guide dialogue box.
	 * Advances through messages, then triggers step progression when done.
	 */
	advanceGuide() {
		if (!this.canAdvanceGuide) return;

		if (this.ui.currentMessageIndex < this.ui.guideMessages.length - 1) {
			this.ui.currentMessageIndex++;
		} else {
			// We are on the last message.
			if (this.ui.savedGuideState) {
				// We've reached the end of an interrupt guide. Restore the saved guide sequence.
				this.ui.guideMessages = this.ui.savedGuideState.messages;
				this.ui.currentMessageIndex = this.ui.savedGuideState.index;
				this.ui.isGuideBlocked = this.ui.savedGuideState.isBlocked;
				this.ui.savedGuideState = null;
				if (this.ui.petMood === 'error') this.ui.petMood = 'idle';
			} else {
				// Normal guide progression complete. 
				// Since we got here (and canAdvanceGuide is true), isGuideBlocked must be FALSE.
				// So we hide the guide and tell the machine to advance.
				this.ui.hideGuide();
				this.advanceStep();
			}
		}
	}

	hideGuide() {
		this.ui.hideGuide();
	}
	petSpeak(text: string) {
		this.ui.petSpeak(text);
	}
	dismissPetSpeech() {
		this.ui.dismissPetSpeech();
	}

	// -------------------------------------------------------------------------
	// Flat pass-through getters/setters for ProgressionState
	// -------------------------------------------------------------------------

	get currentLevelIndex(): number {
		return this.progression.currentLevelIndex;
	}
	set currentLevelIndex(v: number) {
		this.progression.currentLevelIndex = v;
	}
	get currentStageIndex(): number {
		return this.progression.currentStageIndex;
	}
	set currentStageIndex(v: number) {
		this.progression.currentStageIndex = v;
	}
	get currentStage(): StoryStage {
		return this.progression.currentStage;
	}
	get activeCode(): string {
		return this.progression.activeCode;
	}
	set activeCode(v: string) {
		if (this.progression.activeCode !== v) {
			this.progression.activeCode = v;
			if (this.testsPassed) {
				this.codeChangedSincePass = true;
			}
			this.testsPassed = false;
			for (const req of this.testRequirements) {
				req.passed = false;
			}
		}
	}
	get petMemory() {
		return this.progression.petMemory;
	}
	get lockedCodeString(): string {
		return this.progression.lockedCodeString;
	}
	get petClicks(): number {
		return this.progression.petClicks;
	}
	set petClicks(v: number) {
		this.progression.petClicks = v;
	}

	// -------------------------------------------------------------------------
	// Step Helpers
	// -------------------------------------------------------------------------

	/** Returns the current step in the current stage, or null if out of bounds. */
	getCurrentStep(): StoryStep | null {
		const stage = this.progression.currentStage;
		if (!stage || !stage.steps || this.currentStepIndex >= stage.steps.length) return null;
		return stage.steps[this.currentStepIndex];
	}

	/** Returns the current step only if it is an ActionStep, otherwise null. */
	getCurrentAction(): ActionStep | null {
		const step = this.getCurrentStep();
		if (step && step.type === 'action') return step as ActionStep;
		return null;
	}

	// -------------------------------------------------------------------------
	// Constructor
	// -------------------------------------------------------------------------

	constructor() {
		this.engine = new PythonEngine();

		// Wire up engine output callbacks to the REPL log and speech bubble
		this.engine.onPrint = (text) => {
			this.addLog(text);
			this.ui.petSpeak(text);
		};
		this.engine.onSystemLog = (text) => {
			this.addLog(text);
		};
		this.engine.onInputRequest = (prompt) => {
			if (prompt) this.addLog(prompt);
			this.inputPrompt = prompt;
			this.awaitingInput = true;
			this.ui.petMood = 'processing';
		};

		this.progression.loadProgress();

		// If no save data found, start fresh at stage 0
		if (this.progression.currentLevelIndex === 0 && this.progression.currentStageIndex === 0 && !this.progression.lockedCodeString) {
			this.loadStage(0, 0);
		} else {
			if (this.progression.currentLevelIndex > 0 || this.progression.currentStageIndex > 0) {
				this.ui.petMood = 'idle';
			}
			this.loadStage(this.progression.currentLevelIndex, this.progression.currentStageIndex);
		}
	}

	// -------------------------------------------------------------------------
	// Utility
	// -------------------------------------------------------------------------

	addLog(message: string) {
		this.replLogs.push(message);
	}

	// -------------------------------------------------------------------------
	// Stage / Progression
	// -------------------------------------------------------------------------

	async loadStage(levelIndex: number, stageIndex: number, options: { preserveCode?: boolean; devSolutionCode?: boolean } = {}) {
		this.progression.currentLevelIndex = levelIndex;
		this.progression.currentStageIndex = stageIndex;
		const stage = this.progression.currentStage;

		// Override codepad initialization logic for Dev operations
		if (options.devSolutionCode && stage.devSolutionCode !== undefined) {
			this.progression.activeCode = stage.devSolutionCode;
		} else if (!options.preserveCode) {
			// Only overwrite code if the stage provides explicit initial values
			if (stage.activeCodeInitial !== undefined) {
				this.progression.activeCode = stage.activeCodeInitial;
			}
			if (stage.lockedCodeInitial !== undefined) {
				this.progression.petMemory = {
					...extractMemory(stage.lockedCodeInitial),
					moodTriggers: {}
				};
			}
		}

		// Re-execute all existing code silently so prior definitions remain available in the engine
		const allCode = (this.progression.lockedCodeString + '\n' + this.progression.activeCode).trim();
		if (allCode) {
			this.engine.runCodeSilent(allCode).catch(() => {});
		}

		// Reset test/step state
		this.testRequirements = [];
		this.testsPassed = false;
		this.currentStepIndex = 0;

		// Execute the first step
		this.executeCurrentStep();
	}

	/**
	 * The core step execution engine.
	 * Reads the current step and either:
	 * - Shows dialogue (then waits for user clicks)
	 * - Executes a system action (open_codepad, etc.) and auto-advances
	 * - Pauses at a test/interaction action and waits for completion
	 */
	executeCurrentStep() {
		const step = this.getCurrentStep();
		if (!step) {
			// Ran out of steps — this stage is complete, advance to next stage
			this.advanceStage();
			return;
		}

		if (step.type === 'dialogue') {
			const dialogueStep = step as DialogueStep;
			if (dialogueStep.messages.length > 0) {
				this.ui.showGuide(dialogueStep.messages, dialogueStep.blockFinalMessage);
				
				// A blocked dialogue is tied to an action. We immediately queue the action
				// by advancing the machine state behind the scenes. The UI guide stays rendered.
				if (dialogueStep.blockFinalMessage) {
					this.advanceStep();
				}
			} else {
				// Empty dialogue, skip it
				this.currentStepIndex++;
				this.executeCurrentStep();
			}
			// Guide clicks are handled by advanceGuide() which will call advanceStep()
		} else if (step.type === 'action') {
			const actionStep = step as ActionStep;
			this.executeAction(actionStep);
		}
	}

	/**
	 * Dispatches an action step. Some actions are instant (open_codepad),
	 * others pause and wait for user interaction (codepad_test, repl_test).
	 */
	executeAction(action: ActionStep) {
		switch (action.actionType) {
			case 'open_codepad':
				// Wait for the user to click the existing "Open Editor" button.
				// The button calls `enterEditMode()`, which will advance the step.
				break;

			case 'close_codepad':
				this.mode = 'play';
				this.ui.hideGuide();
				this.advanceStep();
				break;

			case 'save_and_deploy':
				// This is a "waiting" action — the user must click Save & Deploy.
				// saveAndDeployCode() will call advanceStep() when done.
				this.addLog('>>> Ready to deploy. Click Save & Deploy.');
				break;

			case 'codepad_test':
				// Populate the test checklist and wait for user to pass
				if (action.initialRequirements) {
					if (action.accumulateTests) {
						// Keep existing passed tests, append new ones
						const newReqs = action.initialRequirements.map((req: Requirement) => ({ ...req, passed: false }));
						this.testRequirements = [...this.testRequirements, ...newReqs];
					} else {
						this.testRequirements = action.initialRequirements.map((req: Requirement) => ({ ...req, passed: false }));
					}
				}
				this.testsPassed = false;
				// Pauses here — runMockTests() will call advanceStep() on pass
				break;

			case 'repl_test':
				// Pauses here — runReplCommand() will check and call advanceStep() on pass
				break;

			case 'click_target':
				// Pauses here — handlePetClick() will call advanceStep() when clicks are met
				this.progression.petClicks = 0;
				break;

			case 'freeplay':
				// Freeplay doesn't auto-advance; the user clicks a "Finish" button
				break;

			default:
				console.warn(`[gameState] Unknown action type: ${(action as unknown as Record<string, unknown>).actionType}`);
				this.advanceStep();
		}
	}

	/** Move to the next step in the current stage's timeline. */
	advanceStep() {
		this.currentStepIndex++;
		this.executeCurrentStep();
	}

	advanceStage() {
		const currentLevel = this.progression.currentLevel;
		if (this.progression.currentStageIndex < currentLevel.stages.length - 1) {
			// Advance stage within current level
			this.loadStage(this.progression.currentLevelIndex, this.progression.currentStageIndex + 1);
		} else if (this.progression.currentLevelIndex < storyLevels.length - 1) {
			// Advance to next level
			// Save the active code to locked code!
			if (this.progression.activeCode.trim()) {
				const fullCode = this.progression.lockedCodeString + '\n' + this.progression.activeCode;
				const parsed = extractMemory(fullCode) as PetMemory;
				parsed.moodTriggers = { ...this.progression.petMemory.moodTriggers };

				this.progression.petMemory = parsed;
			}
			this.progression.activeCode = '';
			this.mode = 'play';
			const nextLevelIndex = this.progression.currentLevelIndex + 1;
			this.addLog(`>>> Advancing to: ${storyLevels[nextLevelIndex].title}`);
			this.loadStage(nextLevelIndex, 0);
		} else {
			this.ui.showGuide(["You've finished all currently available stages! Great job!"]);
		}

		this.progression.saveProgress();
	}

	jumpToStage(levelIndex: number, stageIndex: number, options: { preserveCode?: boolean; devSolutionCode?: boolean } = {}) {
		// Full reset — used by the dev panel for testing
		this.mode = 'play';
		this.ui.petMood = (levelIndex === 0 && stageIndex === 0) ? 'egg' : 'idle';
		this.progression.petClicks = 0;
		this.replLogs = [];
		this.replHistory = [];
		if (!options.preserveCode && !options.devSolutionCode) {
			this.progression.activeCode = '';
			this.progression.petMemory = { variables: {}, functions: {}, moodTriggers: {} };
		}
		this.ui.savedGuideState = null;
		this.ui.dismissPetSpeech();
		this.engine.reboot();
		this.loadStage(levelIndex, stageIndex, options);
	}

	handlePetClick() {
		const action = this.getCurrentAction();
		if (action && action.actionType === 'click_target' && action.targetClicks) {
			this.progression.petClicks++;
			if (this.progression.petClicks >= action.targetClicks) {
				if (this.ui.petMood === 'egg') this.ui.petMood = 'idle';
				this.advanceStep();
			}
		}
	}

	// -------------------------------------------------------------------------
	// Mode (still needed for manual "Open Editor" button on non-scripted stages)
	// -------------------------------------------------------------------------

	enterEditMode() {
		// In the new timeline, open_codepad actions wait for this manual trigger.
		this.mode = 'edit';

		// If we were explicitly waiting on an open_codepad action step, advance it!
		const action = this.getCurrentAction();
		if (action && action.actionType === 'open_codepad') {
			this.advanceStep();
		}
	}

	exitEditMode() {
		this.mode = 'play';
		this.ui.hideGuide();
	}

	// -------------------------------------------------------------------------
	// REPL
	// -------------------------------------------------------------------------

	/**
	 * Provide a response to a pending input() call from the Python worker.
	 */
	provideInputResponse(text: string) {
		this.addLog(text);
		this.awaitingInput = false;
		this.inputPrompt = '';
		this.ui.petMood = 'idle';
		this.engine.provideInput(text);
	}

	async runReplCommand(command: string) {
		if (!command.trim()) return;

		// If the engine is awaiting input(), feed it directly
		if (this.awaitingInput) {
			this.provideInputResponse(command);
			return;
		}

		this.ui.dismissPetSpeech();
		this.addLog(`>>> ${command}`);

		const prevLogCount = this.replLogs.length;

		const result = await analyzeReplExecution(this.engine, command);

		if (result.status === 'success') {
			if (result.output) this.addLog(result.output);

			// Detect function calls mapped to mood triggers
			const match = command.trim().match(/^([a-zA-Z_][a-zA-Z0-9_]*)\s*\(/);
			if (match) {
				const fnName = match[1];
				if (this.progression.petMemory.moodTriggers[fnName]) {
					this.ui.petMood = this.progression.petMemory.moodTriggers[fnName];
				}
			}
		} else if (result.status === 'warning') {
			// Student typed a function name without calling it
			this.addLog('>>> [HINT] See Guide.');
			this.ui.showInterruptGuide(result.friendlyMessage!);
			this.ui.petMood = 'error';
			return; // Skip stage-trigger check for warnings
		} else if (result.status === 'error') {
			if (result.rawErrorLine) this.addLog(`[Python] ${result.rawErrorLine}`);
			this.ui.petMood = 'error';
		}

		// Calculate combined output (anything printed to logs during execution + return value)
		const newlyPrinted = this.replLogs.slice(prevLogCount).join('\\n');
		const outputToCheck = newlyPrinted + (result.output ? '\\n' + result.output : '');

		// Check if this REPL command satisfies the current action's repl_test
		const action = this.getCurrentAction();
		if (action && action.actionType === 'repl_test' && action.checkReplInteraction) {
			const isTriggered = action.checkReplInteraction(command, outputToCheck);
			if (isTriggered) {
				// Dismiss old dialogue immediately so it doesn't flash during the delay
				this.ui.hideGuide();
				setTimeout(() => this.advanceStep(), 1000);
				return;
			}
		}

		if (result.status === 'error') {
			this.addLog('>>> [ERROR] See Guide.');
			this.ui.showInterruptGuide(result.friendlyMessage!);
		}
	}

	// -------------------------------------------------------------------------
	// Codepad
	// -------------------------------------------------------------------------

	async runMockTests(codeToTest?: string) {
		this.ui.dismissPetSpeech();
		this.codeChangedSincePass = false;
		const code = codeToTest !== undefined ? codeToTest : this.progression.activeCode;

		this.ui.petMood = 'processing';
		this.addLog('>>> Running functional requirements tests...');

		const action = this.getCurrentAction();

		if (!action || action.actionType !== 'codepad_test' || !action.runTests) {
			this.addLog('>>> No tests defined for this step.');
			this.testsPassed = true;
			this.ui.petMood = 'happy';
			return;
		}

		await this.engine.wipeEnvironment();
		const result = await action.runTests(this.engine, code);
		
		if (action.accumulateTests) {
			const oldTestCount = this.testRequirements.length - action.initialRequirements!.length;
			const oldTests = this.testRequirements.slice(0, oldTestCount);
			this.testRequirements = [...oldTests, ...result.requirements];
		} else {
			this.testRequirements = result.requirements;
		}

		if (result.passed) {
			this.testsPassed = true;
			this.ui.petMood = 'happy';
			this.addLog('>>> All tests passed!');

			// (Mood triggers are now processed strictly during save_and_deploy)
			
			// Hide the stale guide so it's clear the state is advancing
			this.ui.hideGuide();

			// Auto-advance to next step after a brief celebration
			setTimeout(() => this.advanceStep(), 1500);
		} else {
			this.testsPassed = false;
			this.ui.petMood = 'idle';

			const firstFail = result.requirements.find((r: Requirement) => !r.passed);

			if (result.rawCompileError) {
				// Raw Python compile error — translate it here at the orchestrator layer
				const translated = translateError(result.rawCompileError, 'deploy');
				this.ui.showInterruptGuide([
					...translated,
					"Fix your code and click 'Run Tests' again."
				]);
			} else if (result.overrideHint) {
				// Already-friendly message from a test primitive
				this.ui.showInterruptGuide([
					result.overrideHint,
					"Fix your code and click 'Run Tests' again."
				]);
			} else if (firstFail && action.failureHints && action.failureHints[firstFail.id]) {
				this.ui.showInterruptGuide([
					action.failureHints[firstFail.id],
					"Fix your code and click 'Run Tests' again."
				]);
			} else if (firstFail) {
				this.ui.showInterruptGuide([
					'Not quite! Keep trying.',
					"Fix your code and click 'Run Tests' again."
				]);
			} else {
				this.addLog('>>> Some tests failed. Keep trying!');
			}
		}
	}

	async saveAndDeployCode(code: string) {
		if (!this.testsPassed) {
			this.ui.showInterruptGuide("You need to pass all the tests first! Click 'Run Tests'.");
			return;
		}

		this.ui.dismissPetSpeech();
		this.ui.petMood = 'processing';
		this.addLog('>>> Deploying code to PyPet...');
		this.progression.activeCode = code;

		const fullCode = this.progression.lockedCodeString + '\n' + this.progression.activeCode;
		const result = await analyzeDeployment(this.engine, fullCode);

		if (result.status === 'success') {
			this.ui.petMood = 'happy';
			this.addLog('>>> Code deployed successfully.');

			// Persist mood triggers specified in the action definition
			const action = this.getCurrentAction();
			if (action && action.actionType === 'save_and_deploy' && action.saveDeployMoods) {
				action.saveDeployMoods.forEach(mapping => {
					if (mapping.targetName && mapping.mood) {
						this.progression.petMemory.moodTriggers[mapping.targetName] = mapping.mood;
					}
				});
			}

			this.exitEditMode();
			this.advanceStep(); // Move past the save_and_deploy action
		} else {
			this.ui.petMood = 'error';
			this.addLog('>>> [ERROR] Deployment failed. See Guide.');
			this.ui.showInterruptGuide(result.friendlyMessage!);
		}
	}
}

export const gameState = new GameState();
