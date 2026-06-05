<script lang="ts">
    import { gameState } from '../../state/gameState.svelte';
    import { onMount, tick } from 'svelte';

    let currentCommand = $state('');
    let logContainer: HTMLDivElement;
    let inputElement: HTMLInputElement;

    let historyIndex = $state(gameState.replHistory.length);

    async function handleSubmit(event: Event) {
        event.preventDefault();
        const cmd = currentCommand;
        
        if (cmd.trim()) {
            gameState.replHistory.push(cmd);
            historyIndex = gameState.replHistory.length;
        }

        currentCommand = '';

        if (gameState.awaitingInput) {
            // Feed input directly — don't run as a REPL command
            gameState.provideInputResponse(cmd);
        } else {
            await gameState.runReplCommand(cmd);
        }
        scrollToBottom();
    }

    async function scrollToBottom() {
        await tick();
        if (logContainer) {
            logContainer.scrollTop = logContainer.scrollHeight;
        }
    }

    // Attempt to watch the replLogs length so we can scroll whenever it updates
    let logCount = $derived(gameState.replLogs.length);
    $effect(() => {
        if (logCount) {
            scrollToBottom();
        }
    });

    // Auto-focus the input when awaiting input
    $effect(() => {
        if (gameState.awaitingInput && inputElement) {
            inputElement.focus();
            scrollToBottom();
        }
    });

    function handleKeyDown(event: KeyboardEvent) {
        if (event.key === 'ArrowUp') {
            event.preventDefault();
            if (historyIndex > 0) {
                historyIndex--;
                currentCommand = gameState.replHistory[historyIndex];
            }
        } else if (event.key === 'ArrowDown') {
            event.preventDefault();
            if (historyIndex < gameState.replHistory.length - 1) {
                historyIndex++;
                currentCommand = gameState.replHistory[historyIndex];
            } else {
                historyIndex = gameState.replHistory.length;
                currentCommand = '';
            }
        }
    }

    onMount(() => {
        scrollToBottom();
    });
</script>

<div
    class="flex flex-col overflow-hidden rounded-xl border-[#32539a] bg-[#e3dfd3] shadow-lg transition-all duration-700 ease-in-out {gameState.mode === 'play'
        ? 'mt-4 flex-[0_0_40%] border-4 p-4 opacity-100'
        : 'mt-0 flex-[0_0_0px] border-0 p-0 opacity-0'}"
>
    <!-- Inner wrapper to maintain content shape while outer shrinks -->
    <div class="flex h-full min-h-[150px] w-full min-w-[300px] flex-col">
        <h2 class="mb-2 text-sm font-bold text-[#32539a] uppercase">/// Terminal</h2>
        <div
            bind:this={logContainer}
            onclick={() => inputElement?.focus()}
            role="presentation"
            class="flex-1 overflow-y-auto rounded-md border-2 border-[#0f0b02] bg-[#0f0b02] p-3 font-mono text-base text-[#adf18a] shadow-inner cursor-text"
        >
            {#each gameState.replLogs as log, index (index)}
                <pre class="m-0 whitespace-pre-wrap wrap-break-word min-h-[1.5em]">{log || ' '}</pre>
            {/each}
            <form onsubmit={handleSubmit} class="mt-2 flex items-center">
                <span class="mr-2 {gameState.awaitingInput ? 'text-[#f0c040] animate-pulse' : 'text-[#57eb58]'}">
                    {gameState.awaitingInput ? '?' : '>>>'}
                </span>
                <input
                    bind:this={inputElement}
                    type="text"
                    bind:value={currentCommand}
                    onkeydown={handleKeyDown}
                    disabled={gameState.currentStage.isReplEnabled === false}
                    class="flex-1 bg-transparent outline-none placeholder-[#57eb58]/30 disabled:cursor-not-allowed disabled:opacity-50 {gameState.awaitingInput ? 'text-[#f0c040]' : 'text-[#57eb58]'}"
                    placeholder={gameState.awaitingInput ? 'Type your answer...' : (gameState.currentStage.isReplEnabled === false ? 'Terminal offline...' : 'Type command...')}
                    autocomplete="off"
                    spellcheck="false"
                />
            </form>
        </div>
    </div>
</div>
