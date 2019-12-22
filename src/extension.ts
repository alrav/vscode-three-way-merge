import * as vscode from 'vscode';

function getTextDocumentLines(textDocument: vscode.TextDocument): Array<string> {
	const lines = [];

	for (let i = 0; i < textDocument.lineCount; i++) {
		lines.push(textDocument.lineAt(i).text);
	}

	return lines;
}

function textDocumentLinesToHtml (lines: Array<string>) {
	let html = '<table width="100%">';

	lines.forEach((line: string) => {
		html += '<tr>';

		// left column
		html += `<td>${line}</td>`;

		// middle column
		html += `<td>${line}</td>`;

		// right column
		html += `<td>${line}</td>`;
		
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