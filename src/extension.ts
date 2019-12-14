import * as vscode from 'vscode';

export function activate(context: vscode.ExtensionContext) {
	console.log('ThreeWayMerge extension is activated');

	context.subscriptions.push(
		vscode.commands.registerCommand('extension.threeWayMerge', () => {
			const panel = vscode.window.createWebviewPanel(
				'threeWayMerge',
				'foo.js - merge',
				vscode.ViewColumn.One,
			);

			panel.webview.html = getWebviewContent();
		})
	);
}

function getWebviewContent() {
return `<!DOCTYPE html>
<html lang="en">
<head>
	<meta charset="UTF-8">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<title>foo.js - merge</title>
</head>
<body>
	<p>foo</p>
</body>
</html>`;
}

export function deactivate() {}