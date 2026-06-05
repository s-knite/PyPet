// src/lib/utils/pythonEngine.ts
// Manages the Pyodide Web Worker and provides an API for running Python code.
// Supports interactive input() via SharedArrayBuffer + Atomics.

// Size of the SharedArrayBuffer for input communication (4KB)
const INPUT_BUFFER_SIZE = 4096;

export class PythonEngine {
    private worker: Worker | null = null;
    private messageCounter = 0;
    private isSilent = false;

    // The SharedArrayBuffer used for the current execution's input() calls
    private inputBuffer: SharedArrayBuffer | null = null;
    private pendingPrompt = '';

    // Callbacks provided by our UI to handle outputs
    public onPrint: (text: string) => void = () => {};
    public onSystemLog: (text: string) => void = () => {};
    public onInputRequest: (prompt: string) => void = () => {};

    constructor() {
        this.initWorker();
    }

    private initWorker() {
        if (typeof window === 'undefined') return;

        // In Vite, appending '?worker' tells the bundler to compile this as a Web Worker
        this.worker = new Worker(new URL('../workers/python.worker.ts', import.meta.url), {
            type: 'module'
        });

        this.worker.onmessage = (event) => {
            // Always let input_request through, even in silent mode
            if (this.isSilent && event.data.type !== 'done' && event.data.type !== 'error'
                && event.data.type !== 'input_request') return;

            const { type, text, status } = event.data;
            if (type === 'stdout') {
                this.onPrint(text);
            } else if (type === 'stderr') {
                this.onSystemLog(`[ERROR] ${text}`);
            } else if (type === 'status') {
                this.onSystemLog(`[SYSTEM] ${status}`);
            } else if (type === 'input_request') {
                // The worker is now blocked on Atomics.wait() — trigger the UI.
                this.onInputRequest('');
            }
        };
    }

    /**
     * Check whether SharedArrayBuffer is available in this browser context.
     * Requires Cross-Origin Isolation (COOP + COEP headers).
     */
    public static isInputSupported(): boolean {
        return typeof SharedArrayBuffer !== 'undefined';
    }

    /**
     * Provide input text back to a blocking input() call in the worker.
     * Writes the string into the SharedArrayBuffer and wakes the worker.
     */
    public provideInput(text: string): void {

        if (!this.inputBuffer) {
            console.warn('provideInput called but no inputBuffer is active.');
            return;
        }

        const encoder = new TextEncoder();
        const encoded = encoder.encode(text);

        // Write the string bytes into the buffer starting at offset 8
        const dataView = new Uint8Array(this.inputBuffer, 8);
        dataView.set(encoded);

        // Write the byte length into signalView[1]
        const signalView = new Int32Array(this.inputBuffer, 0, 2);
        Atomics.store(signalView, 1, encoded.byteLength);

        // Set the signal flag to 1 (data ready) and wake the worker
        Atomics.store(signalView, 0, 1);
        Atomics.notify(signalView, 0);

    }

    // Runs code and returns a Promise that resolves when done, or rejects on Python error
    public runCode(code: string): Promise<unknown> {
        return new Promise((resolve, reject) => {
            if (!this.worker) {
                reject(new Error('Worker not initialized'));
                return;
            }

            const messageId = this.messageCounter++;

            // Create a fresh SharedArrayBuffer for this execution's input() calls
            if (PythonEngine.isInputSupported()) {
                this.inputBuffer = new SharedArrayBuffer(INPUT_BUFFER_SIZE);
            }

            // Create a temporary listener for THIS specific code execution
            const responseHandler = (event: MessageEvent) => {
                const { type, id, error } = event.data;
                if (id === messageId) {
                    if (type === 'done') {

                        this.worker?.removeEventListener('message', responseHandler);
                        this.inputBuffer = null;
                        resolve(event.data.result);
                    } else if (type === 'error') {

                        this.worker?.removeEventListener('message', responseHandler);
                        this.inputBuffer = null;
                        reject(error);
                    }
                }
            };

            this.worker.addEventListener('message', responseHandler);

            // Send the code + the input buffer to the worker
            this.worker.postMessage({
                id: messageId,
                code,
                inputBuffer: this.inputBuffer
            });
        });
    }

    public async runCodeSilent(code: string): Promise<unknown> {
        this.isSilent = true;
        try {
            return await this.runCode(code);
        } finally {
            this.isSilent = false;
        }
    }

    // In an infinite loop, we demolish the room and rebuild it
    public reboot() {
        this.onSystemLog('[SYSTEM] Force rebooting Python Engine...');
        this.worker?.terminate();
        this.inputBuffer = null;
        this.initWorker();
    }

    /**
     * Wipes the global execution context in Pyodide without restarting the worker.
     * Removes user-defined variables/functions and clears type annotations.
     */
    public async wipeEnvironment() {
        const cleanupCode = `
import sys
current_module = sys.modules[__name__]
if hasattr(current_module, '__annotations__'):
    current_module.__annotations__.clear()
for key in list(globals().keys()):
    if not key.startswith('__') and key not in ['sys', 'io', '_test_stdout']:
        del globals()[key]
`;
        await this.runCodeSilent(cleanupCode);
    }
}