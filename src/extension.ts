import * as vscode from 'vscode';

// Typescript interfaces
interface ChangesLineOptions {
	changesAttributePrefix: string;
	changesStyleAttributeColor: string;
	areChangesActive: boolean;
	areOppositeChangesActive: boolean;
}

// Different changes states
/**
 * @constant ${string}
 */
const CHANGES_STATE_INCOMING_START = 'incomingStart';

/**
 * @constant ${string}
 */
const CHANGES_STATE_CONTENT = 'content';

/**
 * @constant ${string}
 */
const CHANGES_STATE_YOUR_START = 'yourStart';

/**
 * @constant ${string}
 */
const CHANGES_STATE_YOUR_END = 'yourEnd';

/**
 * @constant ${string}
 */
const CHANGES_STATE_ATTRIBUTE_KEY = 'data-changes-state';

/**
 * @constant ${string}
 */
const CONFLICT_START_LINE_NUMBER_ATTRIBUTE_KEY = 'data-conflict-start-line-number';

function getTextDocumentLines(textDocument: vscode.TextDocument): Array<string> {
	const lines = [];

	for (let i = 0; i < textDocument.lineCount; i++) {
		lines.push(textDocument.lineAt(i).text);
	}

	return lines;
}

function textDocumentLinesToHtml (lines: Array<string>) {
	// regexes to parse against for determining whether we are in a incoming changes, divider, or your changes line
	const incomingChangesStartRegex = /^<+\s{1}HEAD$/g;
	const dividerRegex = /^=+$/g;
	const yourChangesStartRegex = /^>+\s{1}[^>]+$/g;
	
	// flags to determine whether we are in incoming changes (left column), or your changes (right column) state
	let incomingChangesActive = false;
	let yourChangesActive = false;

	let changesState: string;

	// the start line number of the conflict so that we can reference it later to determine the merge replacment range
	let conflictStartLineNumber: number;
		
	function handleChangesStates(line: string) {
		if (line.match(incomingChangesStartRegex)) {
			incomingChangesActive = true;
			changesState = CHANGES_STATE_INCOMING_START;
		} else if (line.match(dividerRegex)) {
			incomingChangesActive = false;
			yourChangesActive = true;
			changesState = CHANGES_STATE_YOUR_START;
		} else if (line.match(yourChangesStartRegex)) {
			yourChangesActive = false;
			changesState = CHANGES_STATE_YOUR_END;
		} else {
			changesState = CHANGES_STATE_CONTENT;
		}

		return line;
	}

	function getChangesLineHtml(
		line: string,
		lineNumber: number,
		options: ChangesLineOptions,
	) {
		const {
			changesAttributePrefix,
			changesStyleAttributeColor,
			areChangesActive,
			areOppositeChangesActive,
		} = options;

		let styleAttribute = '';
		let buttonElement = '';
		let changesStateAttribute = '';
		let conflictStartLineNumberAttribute = '';
		const changesStyleAttribute = `style="color:${changesStyleAttributeColor}"`;

		// hide '<<< HEAD', '===' divider line, and '>>> {my_branch}'
		switch (changesState) {
			case CHANGES_STATE_INCOMING_START:
			case CHANGES_STATE_YOUR_START:
			case CHANGES_STATE_YOUR_END:
				line = '';
		}

		// the opposite changes are active, hide those lines from view
		if (areOppositeChangesActive) {
			line = '';
		} else {
			styleAttribute = (areChangesActive) ? changesStyleAttribute : '';

			if ([CHANGES_STATE_INCOMING_START, CHANGES_STATE_YOUR_START].includes(changesState)) {
				// if we are in 'incomingChanges', store the start line of the conflict
				if (changesAttributePrefix === 'incoming-changes') {
					conflictStartLineNumber = lineNumber;
				}

				// then, attach it as a reference attribute for both of the _START states
				// we really don't need to attach it for incomingChanges since it is inherently the start line of the conflict
				// but this way we relieve the view from having to know about this
				conflictStartLineNumberAttribute = `${CONFLICT_START_LINE_NUMBER_ATTRIBUTE_KEY}=${conflictStartLineNumber}`;
				
				const changesButtonElement = `<button id="${changesAttributePrefix}-button-${lineNumber}" ${conflictStartLineNumberAttribute} onclick="pickMergeColumnChange(this, \'${changesAttributePrefix}\')">B</button>`;
				buttonElement = changesButtonElement;
			}

			changesStateAttribute = `${CHANGES_STATE_ATTRIBUTE_KEY}="${changesState}"`;
		}

		const html = `<td ${styleAttribute}><span id="${changesAttributePrefix}-text-${lineNumber}" ${changesStateAttribute}>${line}</span> ${buttonElement}</td>`;

		return html;
	}
	
	function getMergeLineHtml(line: string, lineNumber: number) {
		const mergeAttributePrefix = 'merge';
		
		// for the middle merge column, show initial conflicted content
		const html = `<td><span id="${mergeAttributePrefix}-text-${lineNumber}">${line}</span></td>`;

		return html;
	}

	let html = '<table width="100%">';

	lines.forEach((line: string, lineNumber: number) => {
		html += '<tr>';

		line = handleChangesStates(line);

		// left column - incoming changes
		html += getChangesLineHtml(line, lineNumber, {
			changesAttributePrefix: 'your-changes',
			changesStyleAttributeColor: 'green',
			areChangesActive: yourChangesActive,
			areOppositeChangesActive: incomingChangesActive
		});

		// middle column
		html += getMergeLineHtml(line, lineNumber);

		// right column - your changes
		html += getChangesLineHtml(line, lineNumber, {
			changesAttributePrefix: 'incoming-changes',
			changesStyleAttributeColor: 'deepSkyBlue',
			areChangesActive: incomingChangesActive,
			areOppositeChangesActive: yourChangesActive
		});
		
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
			const conflictStartLineNumber = element.getAttribute('${CONFLICT_START_LINE_NUMBER_ATTRIBUTE_KEY}');

			let changesElementState = getChangesElementLineSpan(changesPrefix, conflictStartLineNumber).getAttribute('${CHANGES_STATE_ATTRIBUTE_KEY}');

			let counter = conflictStartLineNumber;

			// iterate from the conflict start line until the YOUR_END change state is reached
			while (changesElementState !== '${CHANGES_STATE_YOUR_END}') {
				const mergeElementLineSpan = document.getElementById('merge-text-' + counter); 
				const changesElementLineSpan = getChangesElementLineSpan(changesPrefix, counter);
				changesElementState = changesElementLineSpan.getAttribute('${CHANGES_STATE_ATTRIBUTE_KEY}'); 
				mergeElementLineSpan.innerText = changesElementLineSpan.innerText;
				counter++;
			}
		}
	</script>
</body>
</html>`;
}

export function deactivate() {}