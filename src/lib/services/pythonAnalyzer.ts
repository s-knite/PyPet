// src/lib/services/pythonAnalyzer.ts
// Handles running Python code and interpreting the raw result into clean,
// structured data for the orchestrator. The orchestrator decides what to do
// with the result — this service has no knowledge of game state or UI.
//
// Two separate functions because REPL execution and codepad deployment
// have fundamentally different concerns (single commands vs full blocks,
// <function detection, input flow, etc.).

import type { PythonEngine } from '../utils/pythonEngine';
import { translateError } from '../utils/errorTranslator';

export interface ExecutionResult {
	status: 'success' | 'warning' | 'error';
	/** The string representation of a successful return value, for display in the REPL. */
	output?: string;
	/** Kid-friendly dialogue lines, ready to pass to showInterruptGuide(). */
	friendlyMessage?: string[];
	/** The last line of the raw Python traceback, for display in the REPL log. */
	rawErrorLine?: string;
}

/**
 * Runs a single REPL command and interprets the result.
 * Handles the '<function' warning case (student forgot parentheses),
 * and translates Python errors into kid-friendly dialogue.
 */
export async function analyzeReplExecution(
	engine: PythonEngine,
	command: string
): Promise<ExecutionResult> {
	try {
		const result = await engine.runCode(command);

		if (result !== undefined && result !== null) {
			const resultString = String(result);

			// Student typed `greeting` instead of `greeting()` — give a targeted hint
			if (resultString.startsWith('<function ')) {
				return {
					status: 'warning',
					friendlyMessage: [
						"Hint: It looks like you're trying to call a function!",
						"Don't forget to add parentheses '()' to the end to run it. Example: teach_trick()"
					]
				};
			}

			return { status: 'success', output: resultString };
		}

		return { status: 'success' };
	} catch (error: unknown) {
		const errorStr = String(error);
		const rawErrorLine = errorStr.trim().split('\n').pop();
		const friendlyMessage = translateError(errorStr, 'repl', command);
		return {
			status: 'error',
			rawErrorLine,
			friendlyMessage
		};
	}
}

/**
 * Runs the complete code block (lockedCode + activeCode) for a Save & Deploy action.
 * Returns success or a translated error ready for the guide.
 */
export async function analyzeDeployment(
	engine: PythonEngine,
	fullCode: string
): Promise<ExecutionResult> {
	try {
		await engine.runCode(fullCode);
		return { status: 'success' };
	} catch (error: unknown) {
		const errorStr = String(error);
		const friendlyMessage = translateError(errorStr, 'deploy');
		return {
			status: 'error',
			friendlyMessage
		};
	}
}
