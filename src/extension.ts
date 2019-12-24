import * as vscode from 'vscode';

function getTextDocumentLines(textDocument: vscode.TextDocument): Array<string> {
	const lines = [];

	for (let i = 0; i < textDocument.lineCount; i++) {
		lines.push(textDocument.lineAt(i).text);
	}

	return lines;
}

function textDocumentLinesToHtml (lines: Array<string>) {
	// regexes parse against to determine whether we are in a current changes or incoming changes state
	const currentChangesStartRegex = /^<+\s{1}HEAD$/g;
	const dividerRegex = /^=+$/g;
	const incomingChangesStartRegex = /^>+\s{1}[^>]+$/g;
	
	// flags to determine whether we are in current changes (left column), or incoming changes (right column) state
	let currentChangesActive = false;
	let incomingChangesActive = false;
		
	// CSS rules applying to each state
	const currentChangeCss = 'style=\'color:green\'';

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
		// if we are in a state of incomingChangeActive, hide this line
		}

		return line;
	}

	function getCurrentChangesLineHtml(line: string) {
		let style;
		const currentChangesCss = 'style=\'color:green\'';

		// if we are in a state of incomingChangeActive, hide this line from view
		if (incomingChangesActive) {
			line = '';
		// else, just show the regular line
		} else {
			style = (currentChangesActive) ? currentChangesCss : '';
		}

		const html = `<td ${style}>${line}</td>`;

		return html;
	}
	
	function getIncomingChangesLineHtml(line: string) {
		let style;
		const incomingChangesCss = 'style=\'color:green\'';

		// if we are in a state of currentChangeActive, hide this line from view
		if (currentChangesActive) {
			line = '';
		// else, just show the regular line
		} else {
			style = (incomingChangesActive) ? incomingChangesCss : '';
		}

		const html = `<td ${style}>${line}</td>`;

		return html;
	}
	
	function getMergeLineHtml(line: string) {
		// if we are in a state of currentChangeActive, hide this line from view
		if (currentChangesActive || incomingChangesActive) {
			line = '';
		// else, just show the regular line
		}
		const html = `<td>${line}</td>`;

		return html;
	}

	let html = '<table width="100%">';

	lines.forEach((line: string) => {
		html += '<tr>';

		line = handleChangesStates(line);

		// left column
		html += getCurrentChangesLineHtml(line);

		// middle column
		html += getMergeLineHtml(line);

		// right column
		html += getIncomingChangesLineHtml(line);
		
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
</body>
</html>`;
}

export function deactivate() {}