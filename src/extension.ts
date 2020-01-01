import * as vscode from 'vscode';

// Different changes states

/**
 * @constant ${string}
 */
const CHANGES_STATE_CURRENT_START = 'currentStart';

/**
 * @constant ${string}
 */
const CHANGES_STATE_CONTENT = 'currentContent';

/**
 * @constant ${string}
 */
const CHANGES_STATE_INCOMING_START = 'incomingStart';

/**
 * @constant ${string}
 */
const CHANGES_STATE_INCOMING_END = 'incomingEnd';

/**
 * @constant ${string}
 */
const CHANGES_STATE_ATTRIBUTE_KEY = 'data-changes-state';

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

	let changesState: string;
		
	function handleChangesStates(line: string) {
		// if we are on the '<<< HEAD' line, then hide this line and start the highlight
		if (line.match(currentChangesStartRegex)) {
			currentChangesActive = true;
			changesState = CHANGES_STATE_CURRENT_START;
			line = '';
		// if we are on the '====' divider line, then hide this line, end the current changes highlight, and start the incoming changes highlight
		} else if (line.match(dividerRegex)) {
			currentChangesActive = false;
			incomingChangesActive = true;
			changesState = CHANGES_STATE_INCOMING_START;
			line = '';
		// if we are on the '>>> {my_branch}' divider line, then hide this line and set the incoming changes active flag to false
		} else if (line.match(incomingChangesStartRegex)) {
			incomingChangesActive = false;
			changesState = CHANGES_STATE_INCOMING_END;
			line = '';
		} else {
			changesState = CHANGES_STATE_CONTENT;
		}

		return line;
	}

	function getCurrentChangesLineHtml(line: string, lineNumber: number) {
		let style = '';
		let button = '';
		let changesStateAttribute = '';
		const currentChangesPrefix = 'current-changes';
		const currentChangesCss = 'style=\'color:green\'';
		const currentChangesButton = `<button id="${currentChangesPrefix}-button-${lineNumber}" onclick="pickMergeColumnChange(this, \'${currentChangesPrefix}\')">B</button>`;

		// if we are in a state of incomingChangeActive, hide this line from view
		if (incomingChangesActive) {
			line = '';
		// else, just show the regular line
		} else {
			style = (currentChangesActive) ? currentChangesCss : '';

			if ([CHANGES_STATE_CURRENT_START, CHANGES_STATE_INCOMING_START].includes(changesState)) {
				button = currentChangesButton;
			}				

			changesStateAttribute = `${CHANGES_STATE_ATTRIBUTE_KEY}="${changesState}"`;
		}

		const html = `<td ${style}><span id="${currentChangesPrefix}-text-${lineNumber}" ${changesStateAttribute}>${line}</span> ${button}</td>`;

		return html;
	}
	
	function getIncomingChangesLineHtml(line: string, lineNumber: number) {
		let style = '';
		let button = '';
		let changesStateAttribute = '';
		const incomingChangesPrefix = 'incoming-changes';
		const incomingChangesCss = 'style=\'color:deepSkyBlue\'';
		const incomingChangesButton = `<button id="${incomingChangesPrefix}-button-${lineNumber}" onclick="pickMergeColumnChange(this, \'${incomingChangesPrefix}\')">B</button>`;

		// if we are in a state of incomingChangesActive, hide this line from view
		if (currentChangesActive) {
			line = '';
		// else, just show the regular line
		} else {
			style = (incomingChangesActive) ? incomingChangesCss : '';

			if ([CHANGES_STATE_CURRENT_START, CHANGES_STATE_INCOMING_START].includes(changesState)) {
				button = incomingChangesButton;
			}				

			changesStateAttribute = `${CHANGES_STATE_ATTRIBUTE_KEY}="${changesState}"`;
		}

		const html = `<td ${style}><span id="${incomingChangesPrefix}-text-${lineNumber}" ${changesStateAttribute}>${line}</span> ${button}</td>`;

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
		function getChangesElementLineSpan(changesPrefix, changesElementIndex) {
			return document.getElementById(changesPrefix + '-text-' + changesElementIndex);
		}

		function pickMergeColumnChange(element, changesPrefix) {
			let changesElementIndex = element.id.split('-').pop();

			// increment one to get into the content state
			changesElementIndex++;

			let changesElementState = getChangesElementLineSpan(changesPrefix, changesElementIndex).getAttribute('${CHANGES_STATE_ATTRIBUTE_KEY}');


			while (changesElementState === '${CHANGES_STATE_CONTENT}') {
				const mergeElementLineSpan = document.getElementById('merge-text-' + changesElementIndex); 
				const changesElementLineSpan = getChangesElementLineSpan(changesPrefix, changesElementIndex);
				changesElementState = changesElementLineSpan.getAttribute('${CHANGES_STATE_ATTRIBUTE_KEY}'); 
				mergeElementLineSpan.innerText = changesElementLineSpan.innerText;
				changesElementIndex++;
			}
		}
	</script>
</body>
</html>`;
}

export function deactivate() {}