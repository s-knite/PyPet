export function extractMemory(code: string): { variables: Record<string, string>, functions: Record<string, string> } {
	const result = { variables: {} as Record<string, string>, functions: {} as Record<string, string> };
	const lines = code.split('\n');
	
	let currentFnName: string | null = null;
	let currentFnLines: string[] = [];
	
	for (const line of lines) {
		const fnMatch = line.match(/^def\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*\(/);
		if (fnMatch) {
			if (currentFnName) {
				result.functions[currentFnName] = currentFnLines.join('\n').trim();
			}
			currentFnName = fnMatch[1];
			currentFnLines = [line];
			continue;
		}
		
		if (currentFnName) {
			// If line is indented or empty, it matches the function
			if (line.match(/^\s+/) || line.trim() === '') {
				currentFnLines.push(line);
			} else {
				// Function ended
				result.functions[currentFnName] = currentFnLines.join('\n').trim();
				currentFnName = null;
				// IMPORTANT: we do NOT continue here, because the un-indented line might be a variable!
			}
		}
		
		if (!currentFnName) {
			const varMatch = line.match(/^([a-zA-Z_][a-zA-Z0-9_]*)\s*=(.*)/);
			if (varMatch) {
				result.variables[varMatch[1].trim()] = line; // Store whole line
			}
		}
	}
	// Flush last fn
	if (currentFnName) {
		result.functions[currentFnName] = currentFnLines.join('\n').trim();
	}
	
	return result;
}
