// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function addStringItem(arr: any, prop: string, defaultValue = '') {
    if (!arr[prop]) arr[prop] = [];
    arr[prop].push(defaultValue);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function removeStringItem(arr: any, prop: string, idx: number) {
    arr[prop].splice(idx, 1);
    if (arr[prop].length === 0) delete arr[prop];
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function copyJson(data: any) {
    try {
        await navigator.clipboard.writeText(JSON.stringify(data, null, 2));
        alert('Copied to clipboard!');
    } catch {
        alert('Failed to copy. Make sure you have clipboard permissions.');
    }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function pasteJson(callback: (data: any) => void) {
    try {
        const text = await navigator.clipboard.readText();
        callback(JSON.parse(text));
    } catch {
        const text = prompt('Paste JSON here:');
        if (text) {
            try {
                callback(JSON.parse(text));
            } catch {
                alert('Invalid JSON');
            }
        }
    }
}
