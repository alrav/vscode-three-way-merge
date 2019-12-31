import * as vscode from 'vscode';

function getTextDocumentLines(textDocument: vscode.TextDocument): Array<string> {
	const lines = [];

	for (let i = 0; i < textDocument.lineCount; i++) {
		lines.push(textDocument.lineAt(i).text);
	}

	return lines;
}

function textDocumentLinesToHtml (lines: Array<string>) {
	// regexes to parse against for determining whether we are in a current changes, divider, or incoming changes line
	const currentChangesStartRegex = /^<+\s{1}HEAD$/g;
	const dividerRegex = /^=+$/g;
	const incomingChangesStartRegex = /^>+\s{1}[^>]+$/g;
	
	// flags to determine whether we are in current changes (left column), or incoming changes (right column) state
	let currentChangesActive = false;
	let incomingChangesActive = false;
		
	function handleChangesStates(line: string) {
		// if we are on the '<<< HEAD' line, then hide this line and start the highlight
		if (line.match(currentChangesStartRegex)) {
			currentChangesActive = true;
			line = '';
		// if we are on the '====' divider line, then hide this line, end the current changes highlight, and start the incoming changes highlight
		} else if (line.match(dividerRegex)) {
			currentChangesActive = false;
			incomingChangesActive = true;
			line = '';
		// if we are on the '>>> {my_branch}' divider line, then hide this line and set the incoming changes active flag to false
		} else if (line.match(incomingChangesStartRegex)) {
			incomingChangesActive = false;
			line = '';
		}

		return line;
	}

	function getCurrentChangesLineHtml(line: string, lineNumber: number) {
		let style = '';
		let button = '';
		const currentChangesPrefix = 'current-changes';
		const currentChangesCss = 'style=\'color:green\'';
		const currentChangesButton = `<button id="${currentChangesPrefix}-button-${lineNumber}" onclick="updateTest(this, \'${currentChangesPrefix}\')">B</button>`;

		// if we are in a state of incomingChangeActive, hide this line from view
		if (incomingChangesActive) {
			line = '';
		// else, just show the regular line
		} else {
			style = (currentChangesActive) ? currentChangesCss : '';
			button = (currentChangesActive) ? currentChangesButton: '';
		}

		const html = `<td ${style}><span id="${currentChangesPrefix}-text-${lineNumber}">${line}</span> ${button}</td>`;

		return html;
	}
	
	function getIncomingChangesLineHtml(line: string, lineNumber: number) {
		let style = '';
		let button = '';
		const incomingChangesPrefix = 'incoming-changes';
		const incomingChangesCss = 'style=\'color:green\'';
		const incomingChangesButton = `<button id="${incomingChangesPrefix}-button-${lineNumber}" onclick="updateTest(this, \'${incomingChangesPrefix}\')">B</button>`;

		// if we are in a state of currentChangeActive, hide this line from view
		if (currentChangesActive) {
			line = '';
		// else, just show the regular line
		} else {
			style = (incomingChangesActive) ? incomingChangesCss : '';
			button = (incomingChangesActive) ? incomingChangesButton: '';
		}

		const html = `<td ${style}><span id="${incomingChangesPrefix}-text-${lineNumber}">${line}</span> ${button}</td>`;

		return html;
	}
	
	function getMergeLineHtml(line: string, lineNumber: number) {
		const mergePrefix = 'merge';
		
		// if we are in a state of currentChangeActive, hide this line from view
		if (currentChangesActive || incomingChangesActive) {
			line = '';
		// else, just show the regular line
		}
		const html = `<td><span id="${mergePrefix}-text-${lineNumber}">${line}</span></td>`;

		return html;
	}

	let html = '<table width="100%">';

	lines.forEach((line: string, lineNumber: number) => {
		html += '<tr>';

		line = handleChangesStates(line);

		// left column
		html += getCurrentChangesLineHtml(line, lineNumber);

		// middle column
		html += getMergeLineHtml(line, lineNumber);

		// right column
		html += getIncomingChangesLineHtml(line, lineNumber);
		
		html += '</tr>';
	});

	html += '</table>';

	return html;
}

export function activate(context: vscode.ExtensionContext) {
	console.log('ThreeWayMerge extension is activated');

	context.subscriptions.push(
		vscode.commands.registerTextEditorCommand('extension.threeWayMerge', (textEditor: vscode.TextEditor) => {
			const fileName = textEditor.document.fileName;
			const baseFileName = fileName.split('/').pop() || '';

			const panel = vscode.window.createWebviewPanel(
				'threeWayMerge',
				`${baseFileName} - merge`,
				vscode.ViewColumn.One,
				{ enableScripts: true },
			);

			panel.webview.html = getWebviewContent(
				baseFileName,
				textDocumentLinesToHtml(getTextDocumentLines(textEditor.document)),
				);
		})
	);
}

function getWebviewContent(baseFileName: string, textDocumentLinesAsHtml: string) {
return `<!DOCTYPE html>
<html lang="en">
<head>
	<meta charset="UTF-8">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<title>${baseFileName} - merge</title>
</head>
<body>
	${textDocumentLinesAsHtml}

	<script>
		function updateTest(element, changesPrefix) {
			const elementIndex = element.id.split('-').pop();
			document.getElementById('merge-text-' + elementIndex).innerText = document.getElementById(changesPrefix + '-text-' + elementIndex).innerText;
		}
	</script>
</body>
</html>`;
}

export function deactivate() {}