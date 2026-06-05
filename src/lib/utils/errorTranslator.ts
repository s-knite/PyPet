// src/lib/utils/errorTranslator.ts

interface ErrorRule {
	match: (errorType: string, errorMessage: string, rawError: string, codeCmd: string) => boolean;
	handle: (errorMessage: string, rawError: string, codeCmd: string) => string[];
}

const ERROR_RULES: ErrorRule[] = [
	// --- SYNTAX ERRORS --- //
	{
		match: (type, msg, raw) => type === 'SyntaxError' && (
			msg.includes("'(' was never closed") || 
			msg.includes("expected '('") || 
			msg.includes("unmatched ')'") ||
			(msg.includes("invalid syntax") && (raw.includes("(:") || raw.match(/\(\s*:/) !== null))
		),
		handle: () => [
			"Oops! There's a problem with your brackets '()'.",
			"For example, if you are defining a function, make sure you open with '(' and close with ')' correctly before the colon. Like this: def greeting():"
		]
	},
	{
		// Escaped closing quote
		match: (type, msg, raw, codeCmd) => type === 'SyntaxError' && msg.includes('unterminated string literal') && (codeCmd.includes('\\"') || codeCmd.includes("\\'")),
		handle: () => [
			'Oops! It looks like you put a backslash (\\) right before your quotation mark.',
			'In Python, a backslash "escapes" the next character. This means Python thinks your quotation mark is just part of the text, not the end of the text!',
			'Check your text and make sure your closing quote actually closes the text. Check if you accidentally typed \\ instead of a regular slash!'
		]
	},
	{
		match: (type, msg) => type === 'SyntaxError' && msg.includes('unterminated string literal'),
		handle: () => [
			'Oops! It looks like you forgot to close your quotation marks.',
			'Whenever you use text, make sure it starts and ends with a quote mark, like "this".'
		]
	},
	{
		match: (type, msg, raw) =>
			type === 'SyntaxError' && msg.includes('invalid syntax') && raw.includes('print('),
		handle: () => [
			'You might have forgotten to put quotation marks around your text!',
			'If you want to print words, they need to be wrapped in quotes like this: print("this")'
		]
	},
	{
		match: (type, msg, raw) =>
			type === 'SyntaxError' && (
				msg.includes("expected ':'") || 
				(msg.includes('invalid syntax') && (raw.includes("def ") || raw.includes("if ") || raw.includes("while ") || raw.includes("for ")))
			),
		handle: () => [
			"You might have forgotten a colon ':' or spelled a command wrong!",
			"Remember, lines that start with 'def', 'if', 'while', or 'for' must always end with a ':'"
		]
	},
	{
		match: (type) => type === 'SyntaxError',
		handle: (msg) => [
			"Syntax Error! This means there is a typo in your code that Python doesn't understand.",
			`Python said: "${msg}"`
		]
	},

	// --- INDENTATION --- //
	{
		match: (type, msg) => (type === 'IndentationError' || type === 'TabError') && msg.includes('expected an indented block'),
		handle: () => [
			"You started a block (like a function or a loop) but didn't put anything inside it!",
			"Python needs it to have some code in it, indented with the Tab key."
		]
	},
	{
		match: (type) => type === 'IndentationError' || type === 'TabError',
		handle: () => [
			'Python is very picky about spacing!',
			'Make sure the code inside your function is indented (pushed in) using the tab key.'
		]
	},

	// --- NAME ERRORS (VARIABLES/FUNCTIONS) --- //
	{
		// Catch capitalization errors for known names (print, greeting, etc.)
		match: (type, msg, raw, codeCmd) => {
			if (type !== 'NameError') return false;
			const nameMatch = msg.match(/name '([^']+)' is not defined/);
			if (!nameMatch) return false;
			const varName = nameMatch[1];
			// Known names that students commonly capitalise wrong
			const knownNames = ['print', 'greeting', 'input', 'str', 'int', 'float', 'len', 'range', 'list', 'def', 'return'];
			const lower = varName.toLowerCase();
			return varName !== lower && (knownNames.includes(lower) || raw.includes(lower) || codeCmd.includes(lower));
		},
		handle: (msg) => {
			const nameMatch = msg.match(/name '([^']+)' is not defined/);
			const varName = nameMatch ? nameMatch[1] : 'that';
			const correct = varName.toLowerCase();
			return [
				"Be careful! Python is case-sensitive — capital letters matter!",
				`You wrote '${varName}' but Python needs it in lowercase: '${correct}'`
			];
		}
	},
	{
		// Unquoted text inside print() — e.g. print(Hello) or print(Hello World)
		// Only triggers when there are NO quotes inside the print() at all,
		// meaning the student doesn't understand they need strings.
		// If quotes ARE present (e.g. print("Hi " + name)), the student knows
		// about strings and the undefined name is a real variable error.
		match: (type, msg, _raw, codeCmd) => {
			if (type !== 'NameError') return false;
			const nameMatch = msg.match(/name '([^']+)' is not defined/);
			if (!nameMatch) return false;
			const varName = nameMatch[1];
			const printMatch = codeCmd.match(/print\s*\(([^)]*)\)/);
			if (!printMatch) return false;
			const insidePrint = printMatch[1];
			// Only suggest "forgot quotes" if there are NO quotes inside print() at all
			return insidePrint.includes(varName) && !insidePrint.includes('"') && !insidePrint.includes("'");
		},
		handle: (msg) => {
			const nameMatch = msg.match(/name '([^']+)' is not defined/);
			const varName = nameMatch ? nameMatch[1] : 'that';
			return [
				`It looks like you wrote print(${varName}) — but Python thinks "${varName}" is a variable name, not text!`,
				`If you want to print the word "${varName}", you need to wrap it in quotation marks like this: print("${varName}")`
			];
		}
	},
	{
		// Rule for undefined functions (e.g. they typed `greeting()` but didn't define it)
		match: (type, msg, raw, codeCmd) => {
			if (type !== 'NameError') return false;
			const nameMatch = msg.match(/name '([^']+)' is not defined/);
			if (!nameMatch) return false;
			const varName = nameMatch[1];
			return raw.includes(`${varName}(`) || codeCmd.includes(`${varName}(`);
		},
		handle: (msg) => {
			const nameMatch = msg.match(/name '([^']+)' is not defined/);
			const varName = nameMatch ? nameMatch[1] : 'it';
			return [
				`Name Error! You tried to call a function named "${varName}()", but Python doesn't know what that is!`,
				`Did you forget to define it in your codepad? Or maybe you spelled it wrong?`
			];
		}
	},
	{
		// Fallback for NameError (Variables)
		match: (type) => type === 'NameError',
		handle: (msg) => {
			const nameMatch = msg.match(/name '([^']+)' is not defined/);
			if (nameMatch) {
				const varName = nameMatch[1];
				return [
					`Name Error! Python doesn't know what "${varName}" means.`,
					`Did you misspell a variable name? Or did you forget to put quote marks around "${varName}"?`
				];
			} else {
				return [
					"Name Error! Python doesn't recognize a name you used.",
					'Did you misspell a variable name? Or did you forget to put quote marks around a piece of text?'
				];
			}
		}
	},

	// --- TYPE ERRORS --- //
	{
		// Parameter Count Errors
		match: (type, msg) =>
			type === 'TypeError' &&
			msg.includes('positional argument') &&
			(msg.includes('takes') || msg.includes('missing') || msg.includes('given')),
		handle: (msg) => [
			'Type Error! You passed the wrong number of arguments to this function!',
			`Python said: "${msg}"`,
			'Check how the function is defined and make sure you are giving it exactly what it asks for!'
		]
	},
	{
		match: (type) => type === 'TypeError',
		handle: () => [
			"Type Error! You are trying to mix two things that don't go together.",
			"For example, you can't add a Number to a String (text) without converting it first!"
		]
	}
];

export function translateError(
	rawError: string,
	source: 'deploy' | 'repl' = 'deploy',
	codeCmd: string = ''
): string[] {
	// 1. Break the giant error block into individual lines
	const lines = rawError.split('\n').filter((line) => line.trim() !== '');

	// 2. Grab the very last line (which is where Python puts the real error)
	const lastLine = lines[lines.length - 1] || '';

	// 3. Extract the Error Type and the Message
	const errorMatch = lastLine.match(/^([A-Za-z]+Error):\s*(.*)/);
	const errorType = errorMatch ? errorMatch[1] : 'UnknownError';
	const errorMessage = errorMatch ? errorMatch[2] : 'Something went wrong.';

	// 4. Start building Professor CHU's dialogue
	const dialogue = [
		source === 'repl'
			? 'BZZT! There was a problem with the command you typed!'
			: 'BZZT! Python ran into a problem running the code!'
	];

	// 5. Find a matching rule
	for (const rule of ERROR_RULES) {
		if (rule.match(errorType, errorMessage, rawError, codeCmd)) {
			dialogue.push(...rule.handle(errorMessage, rawError, codeCmd));
			return dialogue;
		}
	}

	// 6. Fallback if no rules matched
	dialogue.push(`Here is the raw error:\n${lastLine}`);
	dialogue.push('Ask your teacher if you need help decoding this one!');

	return dialogue;
}
