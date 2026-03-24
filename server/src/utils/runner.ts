/*---------------------------------------------------------------------------------------------
 *  Copyright (c) SWUpdate VS Code Support contributors.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

export function formatError(message: string, err: any): string {
	if (err instanceof Error) {
		let error = <Error>err;
		return `${message}: ${error.message}\n${error.stack}`;
	} else if (typeof err === 'string') {
		return `${message}: ${err}`;
	} else if (err) {
		return `${message}: ${err.toString()}`;
	}
	return message;
}
