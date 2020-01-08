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
const CHANGES_STATE_CURRENT_START = 'currentStart';

/**
 * @constant ${string}
 */
const CHANGES_STATE_CONTENT = 'content';

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
		if (line.match(currentChangesStartRegex)) {
			currentChangesActive = true;
			changesState = CHANGES_STATE_CURRENT_START;
		} else if (line.match(dividerRegex)) {
			currentChangesActive = false;
			incomingChangesActive = true;
			changesState = CHANGES_STATE_INCOMING_START;
		} else if (line.match(incomingChangesStartRegex)) {
			incomingChangesActive = false;
			changesState = CHANGES_STATE_INCOMING_END;
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
		const changesStyleAttribute = `style="color:${changesStyleAttributeColor}"`;
		const changesButtonElement = `<button id="${changesAttributePrefix}-button-${lineNumber}" onclick="pickMergeColumnChange(this, \'${changesAttributePrefix}\')">B</button>`;

		// hide '<<< HEAD', '===' divider line, and '>>> {my_branch}'
		switch (changesState) {
			case CHANGES_STATE_CURRENT_START:
			case CHANGES_STATE_INCOMING_START:
			case CHANGES_STATE_INCOMING_END:
				line = '';
		}

		// the opposite changes are active, hide those lines from view
		if (areOppositeChangesActive) {
			line = '';
			// else, just show the regular line
		} else {
			styleAttribute = (areChangesActive) ? changesStyleAttribute : '';

			if ([CHANGES_STATE_CURRENT_START, CHANGES_STATE_INCOMING_START].includes(changesState)) {
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

		// left column - current changes
		html += getChangesLineHtml(line, lineNumber, {
			changesAttributePrefix: 'incoming-changes',
			changesStyleAttributeColor: 'green',
			areChangesActive: incomingChangesActive,
			areOppositeChangesActive: currentChangesActive
		});

		// middle column
		html += getMergeLineHtml(line, lineNumber);

		// right column - incoming changes
		html += getChangesLineHtml(line, lineNumber, {
			changesAttributePrefix: 'current-changes',
			changesStyleAttributeColor: 'deepSkyBlue',
			areChangesActive: currentChangesActive,
			areOppositeChangesActive: incomingChangesActive
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