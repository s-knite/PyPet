// src/lib/utils/stageLoader.ts
// Pure utility: converts declarative JSON stage definitions into runtime StoryStage objects.
// Contains no reactive state. The storyLevels singleton at the bottom is the single
// source of truth for all stage data throughout the app.
//
// === SCRIPTED TIMELINE ARCHITECTURE ===
// Each stage is now a sequence of Steps: Dialogue steps and Action steps.
// The engine (gameState) walks through steps[] using a currentStepIndex.

import type { PythonEngine } from './pythonEngine';
import {
	functionExists,
	functionParamsCount,
	functionRunsWithoutError,
	functionOutputMatches,
	functionReturns,
	codeCompiles,
	variableValueMatches,
	type TestResult
} from './testRunner';
import type { PetMood } from '../state/uiState.svelte';

// =============================================================================
// JSON Definition Types (what lives in levels.json)
// =============================================================================

export interface StageTestDef {
	id: number;
	text: string;
	check: string;
	args: Record<string, unknown>;
	hint: string;
}

export interface MoodMappingDef {
	targetName: string;
	mood: PetMood;
}

export interface ReplCheckDef {
	type: 'exactMatch' | 'matchOutput' | 'commandContains';
	accept: string[];
	ignoreCase?: boolean;
}

// --- Step types ---

export interface DialogueStepDef {
	type: 'dialogue';
	messages: string[];
	blockFinalMessage?: boolean;
}

export interface ActionStepDef {
	type: 'action';
	actionType: 'open_codepad' | 'close_codepad' | 'save_and_deploy' | 'repl_test' | 'codepad_test' | 'click_target' | 'freeplay';
	tests?: StageTestDef[];
	replChecks?: ReplCheckDef[];
	targetClicks?: number;
	accumulateTests?: boolean;
	saveDeployMoods?: MoodMappingDef[];
}

export type StageStepDef = DialogueStepDef | ActionStepDef;

export interface StageDef {
	id: number;
	title: string;
	steps: StageStepDef[];
	activeCodeInitial?: string;
	lockedCodeInitial?: string;
	devSolutionCode?: string;
	isReplEnabled?: boolean;
}

export interface LevelDef {
	id: number;
	title: string;
	concept: string;
	stages: StageDef[];
}

// =============================================================================
// Runtime Types (what the engine uses)
// =============================================================================

export interface Requirement {
	id: number;
	text: string;
	passed: boolean;
}

export interface AssessmentResult {
	passed: boolean;
	requirements: Requirement[];
	/** An already-friendly message from a test primitive (e.g. "You defined 'Greeting' but Python needs lowercase"). */
	overrideHint?: string;
	/** A raw Python error string from a compile failure — the orchestrator is responsible for translating this. */
	rawCompileError?: string;
}

// --- Runtime Step types ---

export interface DialogueStep {
	type: 'dialogue';
	messages: string[];
	blockFinalMessage: boolean;
}

export interface ActionStep {
	type: 'action';
	actionType: 'open_codepad' | 'close_codepad' | 'save_and_deploy' | 'repl_test' | 'codepad_test' | 'click_target' | 'freeplay';
	saveDeployMoods?: MoodMappingDef[];
	// For repl_test:
	checkReplInteraction?: (command: string, result: string) => boolean;
	// For codepad_test:
	initialRequirements?: Requirement[];
	failureHints?: Record<string | number, string>;
	runTests?: (engine: PythonEngine, studentCode: string) => Promise<AssessmentResult>;
	accumulateTests?: boolean;
	// For click_target:
	targetClicks?: number;
}

export type StoryStep = DialogueStep | ActionStep;

export interface StoryStage {
	id: number;
	title: string;
	steps: StoryStep[];
	activeCodeInitial?: string;
	lockedCodeInitial?: string;
	devSolutionCode?: string;
	isReplEnabled?: boolean;
}

export interface StoryLevel {
	id: number;
	title: string;
	concept: string;
	stages: StoryStage[];
}

// =============================================================================
// Test Primitive Dispatcher
// =============================================================================

export async function runTestCheck(
	engine: PythonEngine,
	studentCode: string,
	check: string,
	args: Record<string, unknown>
): Promise<TestResult> {
	switch (check) {
		case 'functionExists':
			return functionExists(engine, args.name as string);

		case 'functionParamsCount':
			return functionParamsCount(
				engine,
				args.name as string,
				args.expectedCount as number
			);

		case 'functionRunsWithoutError':
			return functionRunsWithoutError(
				engine,
				args.name as string,
				(args.testArgs as unknown[] | undefined) ?? [],
				(args.mockInputs as string[] | undefined) ?? [],
				(args.mockRandoms as number[] | undefined) ?? []
			);

		case 'functionOutputMatches':
			return functionOutputMatches(
				engine,
				args.name as string,
				(args.testArgs as unknown[] | undefined) ?? [],
				(args.mockInputs as string[] | undefined) ?? [],
				(args.mockRandoms as number[] | undefined) ?? [],
				args.expectedOutput as string
			);

		case 'variableValueMatches':
			return variableValueMatches(
				engine,
				args.name as string,
				args.expectedValue
			);

		case 'functionReturns':
			return functionReturns(
				engine,
				args.name as string,
				(args.testArgs as unknown[] | undefined) ?? [],
				(args.mockInputs as string[] | undefined) ?? [],
				(args.mockRandoms as number[] | undefined) ?? [],
				args.expectedReturn
			);

		case 'codeCompiles':
			return codeCompiles(engine, studentCode);

		default:
			return { passed: false, reason: `Unknown test type: ${check}` };
	}
}

// =============================================================================
// Step Builders (turn JSON defs into runtime step objects)
// =============================================================================

function buildDialogueStep(def: DialogueStepDef): DialogueStep {
	return {
		type: 'dialogue',
		messages: def.messages,
		blockFinalMessage: def.blockFinalMessage ?? false
	};
}

function buildActionStep(def: ActionStepDef): ActionStep {
	const step: ActionStep = {
		type: 'action',
		actionType: def.actionType,
		saveDeployMoods: def.saveDeployMoods?.map((m) => {
			if ((m.mood as string) === 'sleep') m.mood = 'sleeping';
			return m;
		})
	};

	// REPL test matchers
	if (def.actionType === 'repl_test' && def.replChecks) {
		const matchers = def.replChecks.map(check => {
			if (check.type === 'exactMatch') {
				const acceptSet = new Set(check.accept.map((s) => s.replace(/\s+/g, '')));
				return (command: string, _result: string) => {
					const stripped = command.replace(/\s+/g, '');
					return acceptSet.has(stripped);
				};
			} else if (check.type === 'matchOutput') {
				const acceptArr = check.ignoreCase ? check.accept.map((s) => s.toLowerCase().trim()) : check.accept.map((s) => s.trim());
				return (_command: string, result: string) => {
					let out = result.trim();
					if (check.ignoreCase) out = out.toLowerCase();
					return acceptArr.includes(out);
				};
			} else if (check.type === 'commandContains') {
				const acceptArr = check.ignoreCase ? check.accept.map((s) => s.toLowerCase()) : check.accept;
				return (command: string, _result: string) => {
					const cmd = check.ignoreCase ? command.toLowerCase() : command;
					return acceptArr.some((s) => cmd.includes(s));
				};
			} else {
				throw new Error(`[stageLoader] Unknown replCheck type "${(check as any).type}".`);
			}
		});

		step.checkReplInteraction = (command: string, result: string) => {
			return matchers.every(matcher => matcher(command, result));
		};
	}

	// Codepad test runner
	if (def.actionType === 'codepad_test' && def.tests && def.tests.length > 0) {
		const uniquePrefix = Math.random().toString(36).substring(2, 9); // Ensure unique ID space per step

		step.initialRequirements = def.tests.map((t) => ({
			id: `${uniquePrefix}-${t.id}` as unknown as number, // Using string as unique key
			text: t.text,
			passed: false
		}));

		step.failureHints = {};
		for (const t of def.tests) {
			step.failureHints[`${uniquePrefix}-${t.id}`] = t.hint;
		}

		step.runTests = async (
			engine: PythonEngine,
			studentCode: string
		): Promise<AssessmentResult> => {
			const reqs: Requirement[] = def.tests!.map((t) => ({
				id: `${uniquePrefix}-${t.id}` as unknown as number,
				text: t.text,
				passed: false
			}));

			// First, try to compile the code
			const compileResult = await codeCompiles(engine, studentCode);
			if (!compileResult.passed) {
				return { passed: false, requirements: reqs, rawCompileError: compileResult.reason };
			}

			// Run each test in order, stopping at first failure
			for (let i = 0; i < def.tests!.length; i++) {
				const testDef = def.tests![i];
				const result = await runTestCheck(engine, studentCode, testDef.check, testDef.args);

				if (result.passed) {
					reqs[i].passed = true;
				} else {
					return { passed: false, requirements: reqs, overrideHint: result.reason };
				}
			}

			return { passed: true, requirements: reqs };
		};

		step.accumulateTests = def.accumulateTests ?? false;
	}

	// Click target
	if (def.actionType === 'click_target') {
		step.targetClicks = def.targetClicks;
	}

	return step;
}

// =============================================================================
// Level/Stage Loader
// =============================================================================

export function loadLevelsFromJSON(levelDefs: LevelDef[]): StoryLevel[] {
	// --- Validate: catch duplicate IDs early ---
	const seenLevelIds = new Set<number>();
	for (const level of levelDefs) {
		if (seenLevelIds.has(level.id)) {
			throw new Error(`[stageLoader] Duplicate level ID ${level.id} ("${level.title}"). Each level must have a unique ID.`);
		}
		seenLevelIds.add(level.id);

		const seenStageIds = new Set<number>();
		for (const stage of level.stages) {
			if (seenStageIds.has(stage.id)) {
				throw new Error(`[stageLoader] Duplicate stage ID ${stage.id} ("${stage.title}") in level ${level.id} ("${level.title}"). Each stage within a level must have a unique ID.`);
			}
			seenStageIds.add(stage.id);
		}
	}

	return levelDefs.map((levelDef) => ({
		id: levelDef.id,
		title: levelDef.title,
		concept: levelDef.concept,
		stages: levelDef.stages.map((def) => {
			const stage: StoryStage = {
				id: def.id,
				title: def.title,
				steps: def.steps.map((stepDef) => {
					if (stepDef.type === 'dialogue') {
						return buildDialogueStep(stepDef);
					} else {
						return buildActionStep(stepDef);
					}
				}),
				isReplEnabled: def.isReplEnabled
			};

			if (def.activeCodeInitial !== undefined) stage.activeCodeInitial = def.activeCodeInitial;
			if (def.lockedCodeInitial !== undefined) stage.lockedCodeInitial = def.lockedCodeInitial;
			if (def.devSolutionCode !== undefined) stage.devSolutionCode = def.devSolutionCode;

			return stage;
		})
	}));
}

// --- Singleton ---
// Import level data and build the runtime level objects once at module load time.
import levelData from '../data/levels.json';
export const storyLevels = loadLevelsFromJSON(levelData as LevelDef[]);
