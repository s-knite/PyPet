// src/lib/workers/python.worker.ts
// Runs Pyodide in a Web Worker with SharedArrayBuffer-based stdin support for input().

import { loadPyodide } from 'pyodide';

// --- Shared buffer protocol ---
// Int32Array view of the SharedArrayBuffer:
//   [0] = signal flag: 0 = waiting, 1 = data ready
//   [1] = byte length of the UTF-8 encoded response string
// Remaining bytes (offset 8+) = the UTF-8 string data

// The current SharedArrayBuffer for the active execution (set per-message)
let currentInputBuffer: SharedArrayBuffer | null = null;

/**
 * Reads input from the SharedArrayBuffer by blocking with Atomics.wait().
 * Called from the patched Python input() function.
 */
function waitForInput(): string {
    if (!currentInputBuffer) {
        throw new Error('input() is not supported in this context.');
    }

    const signalView = new Int32Array(currentInputBuffer, 0, 2);

    // Reset the signal flag to 0 (waiting)
    Atomics.store(signalView, 0, 0);

    // Tell the main thread we need input
    self.postMessage({ type: 'input_request' });

    // Block this thread until the main thread sets signalView[0] to 1
    Atomics.wait(signalView, 0, 0);

    // Read the response length and decode the string
    // TextDecoder cannot operate on SharedArrayBuffer-backed views, so copy first
    const byteLength = Atomics.load(signalView, 1);
    const sharedBytes = new Uint8Array(currentInputBuffer, 8, byteLength);
    const localBytes = new Uint8Array(byteLength);
    localBytes.set(sharedBytes);
    const decoder = new TextDecoder();
    return decoder.decode(localBytes);
}

// Expose waitForInput to the global scope so Python can call it
(self as unknown as Record<string, unknown>).waitForInput = waitForInput;

async function setupPyodide() {
    self.postMessage({ type: 'status', status: 'Loading Python Environment...' });

    const pyodide = await loadPyodide({
        indexURL: 'https://cdn.jsdelivr.net/pyodide/v0.29.3/full/',
        stdout: (text: string) => {
            self.postMessage({ type: 'stdout', text });
        },
        stderr: (text: string) => {
            self.postMessage({ type: 'stderr', text });
        }
        // NOTE: We do NOT use Pyodide's stdin option. Instead we patch input() in Python
        // to call our JS waitForInput() function directly. This avoids issues with
        // Pyodide's internal stdin buffering and the TextDecoder SharedArrayBuffer bug.
    });

    // Override Python's built-in input() to:
    // 1. Flush stdout (so any pending print output appears before the prompt)
    // 2. Send the prompt text via stdout (so it appears immediately in the terminal)
    // 3. Call our JS waitForInput() which blocks with Atomics.wait()
    await pyodide.runPythonAsync(`
import builtins as __builtins_mod
import sys as __sys
from js import waitForInput as __js_waitForInput
from js import postMessage as __js_postMessage
from pyodide.ffi import to_js as __to_js

def __patched_input(__prompt=''):
    __sys.stdout.flush()
    if __prompt:
        __js_postMessage(__to_js({"type": "stdout", "text": str(__prompt)}))
    __result = str(__js_waitForInput())
    return __result

__builtins_mod.input = __patched_input
`);

    self.postMessage({ type: 'status', status: 'Ready' });
    return pyodide;
}

const pyodideReadyPromise = setupPyodide();

// Listen for messages (code to execute) from the main thread
self.onmessage = async (event: MessageEvent) => {
    const { id, code, inputBuffer } = event.data;

    // Store the SharedArrayBuffer for this execution so waitForInput can use it
    if (inputBuffer instanceof SharedArrayBuffer) {
        currentInputBuffer = inputBuffer;
    }

    try {
        const pyodide = await pyodideReadyPromise;

        // Execute the Python code!
        const result = await pyodide.runPythonAsync(code);

        let safeResult: string | undefined = undefined;
        if (result !== undefined) {
            safeResult = result.toString();
        }

        // Let the main thread know this specific task finished successfully
        self.postMessage({ type: 'done', id, result: safeResult });
    } catch (error: unknown) {
        // If Python throws a traceback (SyntaxError, NameError, etc.), catch it
        self.postMessage({ type: 'error', id, error: String(error) });
    } finally {
        // Clear the buffer reference when execution completes
        currentInputBuffer = null;
    }
};