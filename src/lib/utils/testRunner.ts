// src/lib/utils/testRunner.ts
// Composable test primitives for evaluating student code in the codepad.
// This module has no dependency on error translation — it returns raw reasons
// and the orchestrator (gameState) decides when to translate Python errors.

import type { PythonEngine } from './pythonEngine';

export interface TestResult {
	passed: boolean;
	reason?: string;
}

/**
 * Check if a name exists and is callable (i.e. a function).
 */
export async function functionExists(engine: PythonEngine, name: string): Promise<TestResult> {
	try {
		await engine.runCodeSilent(`assert '${name}' in dir() and callable(${name})`);
		return { passed: true };
	} catch {
		// If exact match fails, check for a case-insensitive match!
		try {
			const checkVarsCode = `
import sys
funcs = [k for k, v in locals().items() if callable(v) and k.lower() == '${name.toLowerCase()}']
funcs[0] if funcs else ""
`;
			const found = await engine.runCodeSilent(checkVarsCode);
			if (found && String(found).trim() !== '') {
				return {
					passed: false,
					reason: `Be careful! Python is case-sensitive. You defined '${found}' but the test needs it in lowercase: '${name}'`
				};
			}
		} catch {
			/* ignore non-matching names */
		}

		return {
			passed: false,
			reason: `Python doesn't know what '${name}' is. Did you define it with 'def ${name}():'? (Careful: If you did define it, check your indentation to make sure it's not accidentally indented inside another function!)`
		};
	}
}

/**
 * Dynamically counts parameters of a function using inspect.
 */
export async function functionParamsCount(
	engine: PythonEngine,
	name: string,
	expectedCount: number
): Promise<TestResult> {
	try {
		const code = `
import inspect
len(inspect.signature(globals()['${name}']).parameters)
`;
		const count = await engine.runCodeSilent(code);
		if (Number(count) === expectedCount) {
			return { passed: true };
		} else {
			return {
				passed: false,
				reason: `Your function '${name}' expects ${count} parameter(s), but we need it to ask for exactly ${expectedCount}. Check the variables inside your brackets ()!`
			};
		}
	} catch (err) {
		if (String(err).includes(`KeyError: '${name}'`)) {
			return {
				passed: false,
				reason: `We can't find a function named '${name}'. If you defined it, check your indentation! Make sure it's not accidentally indented inside another function.`
			};
		}
		return {
			passed: false,
			reason: `Couldn't check parameters for ${name}. Did you delete the function?`
		};
	}
}

/**
 * Unified Internal Python Execution Wrapper
 * Mocks sys.stdout, builtins.input, and random.randint
 * Returns a JSON string of {ret, out} or throws raw python string error
 */
async function executeWithMocks(
	engine: PythonEngine,
	name: string,
	args: unknown[],
	mockInputs: string[],
	mockRandoms: number[]
): Promise<{ passed: boolean; reason?: string; ret?: unknown; out?: string }> {
	const argsStr = JSON.stringify(args);
	const mockInputsStr = JSON.stringify(mockInputs);
	const mockRandomsStr = JSON.stringify(mockRandoms);

	const pyCode = `
import sys, io, json
from unittest.mock import patch
import random

def __run_test():
    _mock_inputs = ${mockInputsStr}
    def _mock_input_impl(*_args):
        if len(_mock_inputs) > 0:
            return _mock_inputs.pop(0)
        raise Exception("Too many input() calls! We didn't type that many answers.")
    
    _mock_randoms = ${mockRandomsStr}
    def _mock_randint_impl(*_args):
        if len(_mock_randoms) > 0:
            return _mock_randoms.pop(0)
        raise Exception("Too many random.randint() calls!")

    _test_stdout = io.StringIO()
    sys.stdout = _test_stdout
    
    try:
        with patch('builtins.input', side_effect=_mock_input_impl), \\
             patch('random.randint', side_effect=_mock_randint_impl):
            _ret = globals()['${name}'](*${argsStr})
            return json.dumps({"ret": _ret, "out": _test_stdout.getvalue()})
    finally:
        sys.stdout = sys.__stdout__

__run_test()
`;

	try {
		const pyResult = await engine.runCodeSilent(pyCode);
		const parsed = JSON.parse(String(pyResult));
		return { passed: true, ret: parsed.ret, out: parsed.out };
	} catch (err) {
		const errStr = String(err);
		if (errStr.includes('takes 0 positional arguments')) {
			return { passed: false, reason: `${name} needs a parameter inside its brackets.` };
		}
		if (errStr.includes('missing') && errStr.includes('argument')) {
			return {
				passed: false,
				reason: `${name} is missing an argument. Check how many parameters your function expects.`
			};
		}
		if (errStr.includes(`KeyError: '${name}'`)) {
			return {
				passed: false,
				reason: `We can't find a function named '${name}'. If you defined it, check your indentation! Make sure it's not accidentally indented inside another function.`
			};
		}

		// Return the most readable line of the traceback as a concise reason.
		// The orchestrator will decide whether to translate it further.
		const lastErrorLine = errStr.trim().split('\n').pop() || errStr;
		return { passed: false, reason: lastErrorLine };
	}
}

/**
 * Ensures the function runs mathematically without throwing exceptions.
 */
export async function functionRunsWithoutError(
	engine: PythonEngine,
	name: string,
	args: unknown[],
	mockInputs: string[],
	mockRandoms: number[]
): Promise<TestResult> {
	const result = await executeWithMocks(engine, name, args, mockInputs, mockRandoms);
	if (!result.passed) return { passed: false, reason: result.reason };
	return { passed: true };
}

/**
 * Evaluates function execution output against an expected string.
 */
export async function functionOutputMatches(
	engine: PythonEngine,
	name: string,
	args: unknown[],
	mockInputs: string[],
	mockRandoms: number[],
	expectedOutput: string
): Promise<TestResult> {
	const result = await executeWithMocks(engine, name, args, mockInputs, mockRandoms);
	if (!result.passed) return { passed: false, reason: result.reason };

	if (!result.out) {
		return {
			passed: false,
			reason: `Calling ${name} didn't print anything. Did you use print() inside your function?`
		};
	}

	const trimmedOut = result.out.trim();
	if (trimmedOut === expectedOutput.trim()) {
		return { passed: true };
	}

	// Attempt a fuzzy helpful message if close
	if (trimmedOut.toLowerCase() === expectedOutput.toLowerCase().trim()) {
		return {
			passed: false,
			reason: `So close! You printed "${trimmedOut}" but the test needed exactly "${expectedOutput}". Check your capitalization!`
		};
	}

	return {
		passed: false,
		reason: `We expected "${expectedOutput}" but your function printed "${trimmedOut}".`
	};
}

/**
 * Evaluates function execution return value against expected return.
 */
export async function functionReturns(
	engine: PythonEngine,
	name: string,
	args: unknown[],
	mockInputs: string[],
	mockRandoms: number[],
	expectedReturn: unknown
): Promise<TestResult> {
	const result = await executeWithMocks(engine, name, args, mockInputs, mockRandoms);
	if (!result.passed) return { passed: false, reason: result.reason };

	if (result.ret === expectedReturn) {
		return { passed: true };
	}

	return {
		passed: false,
		reason: `We expected your function to return ${JSON.stringify(expectedReturn)} but it returned ${JSON.stringify(result.ret)}.`
	};
}

/**
 * Try to load student code into the engine. Returns pass if no syntax errors.
 */
export async function codeCompiles(engine: PythonEngine, code: string): Promise<TestResult> {
	try {
		await engine.runCodeSilent(code);
		return { passed: true };
	} catch (err) {
		// Return the raw Python error string. stageLoader surfaces this as
		// AssessmentResult.rawCompileError so the orchestrator can translate it.
		return { passed: false, reason: String(err) };
	}
}

/**
 * Evaluates if a global variable exists and matches the expected value.
 */
export async function variableValueMatches(
	engine: PythonEngine,
	varName: string,
	expectedValue: unknown
): Promise<TestResult> {
	try {
		const checkCode = `
import json
def __check_var():
    val = globals().get('${varName}')
    return json.dumps({"exists": '${varName}' in globals(), "val": val})
__check_var()
`;
		const result = await engine.runCodeSilent(checkCode);
		const parsed = JSON.parse(String(result));

		if (!parsed.exists) {
			return {
				passed: false,
				reason: `Python doesn't know about a variable named '${varName}'. Check your spelling!`
			};
		}
		if (parsed.val === expectedValue) {
			return { passed: true };
		}
		return {
			passed: false,
			reason: `We expected '${varName}' to be ${JSON.stringify(expectedValue)} (a ${typeof expectedValue}), but it was ${JSON.stringify(parsed.val)}.`
		};
	} catch {
		return { passed: false, reason: `Could not check variable '${varName}'.` };
	}
}
