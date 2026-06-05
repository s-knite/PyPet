// src/lib/state/uiState.svelte.ts
// Owns all UI feedback state: pet mood, guide navigation, and speech bubble.
// Has no knowledge of game progression, Python execution, or save/load logic.

export const PET_MOODS = [
	'egg',
	'idle',
	'happy',
	'sad',
	'processing',
	'error',
	'confused',
	'sleeping',
	'level_up',
	'recharging',
	'cube',
	'triangle'
] as const;

export type PetMood = typeof PET_MOODS[number];

export class UIState {
	// --- Pet Mood ---
	private _petMood = $state<PetMood>('egg');
	private petMoodTimer: ReturnType<typeof setTimeout> | null = null;

	get petMood(): PetMood {
		return this._petMood;
	}

	set petMood(value: PetMood) {
		this._petMood = value;
		// Clear any existing timer so we don't accidentally revert a fresh state change
		if (this.petMoodTimer) {
			clearTimeout(this.petMoodTimer);
			this.petMoodTimer = null;
		}
		// Automatically revert 'error' or 'happy' back to 'idle'
		if (value === 'error' || value === 'happy') {
			const delay = value === 'error' ? 1500 : 2500;
			this.petMoodTimer = setTimeout(() => {
				if (this._petMood === value) {
					this._petMood = 'idle';
				}
			}, delay);
		}
	}

	// --- Guide ---
	isGuideVisible = $state(true);
	isGuideBlocked = $state(false);
	guideMessages = $state<string[]>(['... [loading] ....']);
	currentMessageIndex = $state(0);
	// Saved state for interrupt-guides (e.g. error messages that overlay the main guide)
	savedGuideState = $state<{ messages: string[]; index: number; isBlocked: boolean } | null>(null);

	get currentMessage(): string {
		return this.guideMessages[this.currentMessageIndex] || '';
	}

	showGuide(messages: string | string[], isBlocked: boolean = false) {
		const msgs = typeof messages === 'string' ? [messages] : messages;
		if (!msgs || msgs.length === 0) {
			this.isGuideVisible = false;
			return;
		}
		this.guideMessages = msgs;
		this.currentMessageIndex = 0;
		this.isGuideVisible = true;
		this.isGuideBlocked = isBlocked;
		this.savedGuideState = null; // Clear any pending interrupts when installing a new main guide
	}

	/**
	 * Shows a temporary guide sequence, saving the current one to restore afterward.
	 * Used for error messages and hints that interrupt the main tutorial flow.
	 */
	showInterruptGuide(messages: string | string[]) {
		if (!this.savedGuideState) {
			this.savedGuideState = {
				messages: [...this.guideMessages],
				index: this.currentMessageIndex,
				isBlocked: this.isGuideBlocked
			};
		}
		this.guideMessages = typeof messages === 'string' ? [messages] : messages;
		this.currentMessageIndex = 0;
		this.isGuideVisible = true;
		this.isGuideBlocked = false;
	}

	/**
	 * Advances the guide to the next message. When an interrupt-guide is dismissed,
	 * it restores the previously saved guide state.
	 * @param requiresAction - If true, the guide will not auto-close on the final message.
	 */
	advanceGuide(requiresAction: boolean) {
		if (this.currentMessageIndex < this.guideMessages.length - 1) {
			this.currentMessageIndex++;
		} else {
			if (this.savedGuideState) {
				// Restore the interrupted guide sequence
				this.guideMessages = this.savedGuideState.messages;
				this.currentMessageIndex = this.savedGuideState.index;
				this.savedGuideState = null;
				// Always revert error mood when dismissing an interrupt-guide
				if (this._petMood === 'error') {
					this._petMood = 'idle';
				}
			} else if (!requiresAction) {
				this.hideGuide();
			}
		}
	}

	hideGuide() {
		this.isGuideVisible = false;
	}

	// --- Speech Bubble ---
	petSpeechText = $state('');
	private petSpeechTimer: ReturnType<typeof setTimeout> | null = null;

	/**
	 * Displays text in the pet's speech bubble.
	 * If a bubble is already active, appends the new text on a new line.
	 * Resets the 8-second auto-dismiss countdown on each call.
	 */
	petSpeak(text: string) {
		if (text === undefined || text === null) return;

		if (this.petSpeechText && this.petSpeechTimer) {
			this.petSpeechText += '\n' + text.trim();
		} else {
			this.petSpeechText = text.trim();
		}

		if (this.petSpeechTimer) clearTimeout(this.petSpeechTimer);
		this.petSpeechTimer = setTimeout(() => {
			this.petSpeechText = '';
			this.petSpeechTimer = null;
		}, 8000);
	}

	dismissPetSpeech() {
		if (this.petSpeechTimer) clearTimeout(this.petSpeechTimer);
		this.petSpeechTimer = null;
		this.petSpeechText = '';
	}
}
