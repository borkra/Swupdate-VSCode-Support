'use strict';

import { LibConfigScanner } from '../libConfigScanner';
import { SyntaxKind } from '../../dataClasses/syntaxKind';
import { ScanError } from '../../dataClasses/scanError';
import { CharacterCodes } from '../characterCodes';

/**
 * Creates a libconfig scanner on the given text.
 * If ignoreTrivia is set, whitespaces or comments are ignored.
 */
export function CreateDefaultScanner(text: string, ignoreTrivia: boolean = false): LibConfigScanner {

	const len = text.length;

	let pos = 0,
		value: string = '',
		tokenOffset = 0,
		token: SyntaxKind = SyntaxKind.Unknown,
		lineNumber = 0,
		lineStartOffset = 0,
		tokenLineStartOffset = 0,
		prevTokenLineStartOffset = 0,
		scanError: ScanError = ScanError.None;

	function scanHexDigits(count: number, exact?: boolean): number {
		let digits = 0;
		let value = 0;
		while (digits < count || !exact) {
			let ch = text.charCodeAt(pos);
			if (ch >= CharacterCodes._0 && ch <= CharacterCodes._9) {
				value = value * 16 + ch - CharacterCodes._0;
			}
			else if (ch >= CharacterCodes.A && ch <= CharacterCodes.F) {
				value = value * 16 + ch - CharacterCodes.A + 10;
			}
			else if (ch >= CharacterCodes.a && ch <= CharacterCodes.f) {
				value = value * 16 + ch - CharacterCodes.a + 10;
			}
			else {
				break;
			}
			pos++;
			digits++;
		}
		if (digits < count) {
			value = -1;
		}
		return value;
	}

	function setPosition(newPosition: number) {
		pos = newPosition;
		value = '';
		tokenOffset = 0;
		token = SyntaxKind.Unknown;
		scanError = ScanError.None;
	}

	function scanNumber(): string {
		let start = pos;
		const firstCh = text.charCodeAt(pos);

		// Detect base prefix: 0b, 0B (binary), 0o/0O/0q/0Q (octal), 0x/0X (hex)
		if (firstCh === CharacterCodes._0 && pos + 1 < text.length) {
			const nextCh = text.charCodeAt(pos + 1);
			if (nextCh === CharacterCodes.x || nextCh === CharacterCodes.X) {
				// Hexadecimal
				pos += 2;
				while (pos < text.length && isHexDigit(text.charCodeAt(pos))) {
					pos++;
				}
				// optional L or LL suffix
				if (pos < text.length && (text.charCodeAt(pos) === CharacterCodes.L)) {
					pos++;
					if (pos < text.length && text.charCodeAt(pos) === CharacterCodes.L) { pos++; }
				}
				return text.substring(start, pos);
			}
			if (nextCh === CharacterCodes.b || nextCh === CharacterCodes.B) {
				// Binary
				pos += 2;
				while (pos < text.length && (text.charCodeAt(pos) === CharacterCodes._0 || text.charCodeAt(pos) === CharacterCodes._1)) {
					pos++;
				}
				if (pos < text.length && (text.charCodeAt(pos) === CharacterCodes.L)) {
					pos++;
					if (pos < text.length && text.charCodeAt(pos) === CharacterCodes.L) { pos++; }
				}
				return text.substring(start, pos);
			}
			if (nextCh === CharacterCodes.o || nextCh === CharacterCodes.O ||
				nextCh === CharacterCodes.q || nextCh === CharacterCodes.Q) {
				// Octal
				pos += 2;
				while (pos < text.length && text.charCodeAt(pos) >= CharacterCodes._0 && text.charCodeAt(pos) <= CharacterCodes._7) {
					pos++;
				}
				if (pos < text.length && (text.charCodeAt(pos) === CharacterCodes.L)) {
					pos++;
					if (pos < text.length && text.charCodeAt(pos) === CharacterCodes.L) { pos++; }
				}
				return text.substring(start, pos);
			}
		}

		// Leading-dot float: .digits
		if (firstCh === CharacterCodes.dot) {
			pos++;
			while (pos < text.length && isDigit(text.charCodeAt(pos))) {
				pos++;
			}
			// exponent
			if (pos < text.length && (text.charCodeAt(pos) === CharacterCodes.E || text.charCodeAt(pos) === CharacterCodes.e)) {
				pos++;
				if (pos < text.length && (text.charCodeAt(pos) === CharacterCodes.plus || text.charCodeAt(pos) === CharacterCodes.minus)) {
					pos++;
				}
				if (pos < text.length && isDigit(text.charCodeAt(pos))) {
					while (pos < text.length && isDigit(text.charCodeAt(pos))) { pos++; }
				} else {
					scanError = ScanError.UnexpectedEndOfNumber;
				}
			}
			return text.substring(start, pos);
		}

		// Decimal integer or float
		pos++;
		while (pos < text.length && isDigit(text.charCodeAt(pos))) {
			pos++;
		}
		if (pos < text.length && text.charCodeAt(pos) === CharacterCodes.dot) {
			pos++;
			if (pos < text.length && isDigit(text.charCodeAt(pos))) {
				pos++;
				while (pos < text.length && isDigit(text.charCodeAt(pos))) {
					pos++;
				}
			} else {
				scanError = ScanError.UnexpectedEndOfNumber;
				return text.substring(start, pos);
			}
		}
		let end = pos;
		if (pos < text.length && (text.charCodeAt(pos) === CharacterCodes.E || text.charCodeAt(pos) === CharacterCodes.e)) {
			pos++;
			if (pos < text.length && (text.charCodeAt(pos) === CharacterCodes.plus || text.charCodeAt(pos) === CharacterCodes.minus)) {
				pos++;
			}
			if (pos < text.length && isDigit(text.charCodeAt(pos))) {
				pos++;
				while (pos < text.length && isDigit(text.charCodeAt(pos))) {
					pos++;
				}
				end = pos;
			} else {
				scanError = ScanError.UnexpectedEndOfNumber;
			}
		} else {
			// optional L or LL suffix for integers
			if (pos < text.length && text.charCodeAt(pos) === CharacterCodes.L) {
				pos++;
				if (pos < text.length && text.charCodeAt(pos) === CharacterCodes.L) { pos++; }
				end = pos;
			}
		}
		return text.substring(start, end);
	}

	function scanString(): string {
		let result = '',
			start = pos;

		while (true) {
			if (pos >= len) {
				result += text.substring(start, pos);
				scanError = ScanError.UnexpectedEndOfString;
				break;
			}
			const ch = text.charCodeAt(pos);
			if (ch === CharacterCodes.doubleQuote) {
				result += text.substring(start, pos);
				pos++;
				break;
			}
			if (ch === CharacterCodes.backslash) {
				result += text.substring(start, pos);
				pos++;
				if (pos >= len) {
					scanError = ScanError.UnexpectedEndOfString;
					break;
				}
				const ch2 = text.charCodeAt(pos++);
				switch (ch2) {
					case CharacterCodes.doubleQuote:
						result += '\"';
						break;
					case CharacterCodes.backslash:
						result += '\\';
						break;
					case CharacterCodes.b:
						result += '\b';
						break;
					case CharacterCodes.f:
						result += '\f';
						break;
					case CharacterCodes.n:
						result += '\n';
						break;
					case CharacterCodes.r:
						result += '\r';
						break;
					case CharacterCodes.t:
						result += '\t';
						break;
					case CharacterCodes.a:
						result += '\x07'; // BEL
						break;
					case CharacterCodes.v:
						result += '\x0B'; // VT
						break;
					case CharacterCodes.x:
					case CharacterCodes.X:
						// \xNN — exactly 2 hex digits
						const ch3 = scanHexDigits(2, true);
						if (ch3 >= 0) {
							result += String.fromCharCode(ch3);
						} else {
							// Preserve unsupported escape literally for compatibility with libconfig scanner behavior
							result += '\\' + String.fromCharCode(ch2);
						}
						break;
					default:
						// Preserve unsupported escapes literally (e.g. \u, \/)
						result += '\\' + String.fromCharCode(ch2);
				}
				start = pos;
				continue;
			}
			if (ch >= 0 && ch <= 0x1f) {
				if (isLineBreak(ch)) {
					result += text.substring(start, pos);
					scanError = ScanError.UnexpectedEndOfString;
					break;
				} else {
					scanError = ScanError.InvalidCharacter;
					// mark as error but continue with string
				}
			}
			pos++;
		}
		return result;
	}

	function scanPropertyName(): string {
		let result = text.charAt(pos - 1),
			start = pos - 1;

		while (isValidPropertyCharacter(text.charCodeAt(pos))) {
			result += text.charAt(pos);
			pos++;
		}
		return result;
	}

	function scanNext(): SyntaxKind {

		value = '';
		scanError = ScanError.None;

		tokenOffset = pos;
		lineStartOffset = lineNumber;
		prevTokenLineStartOffset = tokenLineStartOffset;

		if (pos >= len) {
			// at the end
			tokenOffset = len;
			return token = SyntaxKind.EOF;
		}

		let code = text.charCodeAt(pos);
		// trivia: whitespace
		if (isWhiteSpace(code)) {
			do {
				pos++;
				value += String.fromCharCode(code);
				code = text.charCodeAt(pos);
			} while (isWhiteSpace(code));

			return token = SyntaxKind.Trivia;
		}

		// trivia: newlines
		if (isLineBreak(code)) {
			pos++;
			value += String.fromCharCode(code);
			if (code === CharacterCodes.carriageReturn && text.charCodeAt(pos) === CharacterCodes.lineFeed) {
				pos++;
				value += '\n';
			}
			lineNumber++;
			tokenLineStartOffset = pos;
			return token = SyntaxKind.LineBreakTrivia;
		}

		switch (code) {
			case CharacterCodes.openBrace:
				pos++;
				return token = SyntaxKind.OpenBraceToken;
			case CharacterCodes.closeBrace:
				pos++;
				return token = SyntaxKind.CloseBraceToken;
			case CharacterCodes.openParen:
				pos++;
				return token = SyntaxKind.OpenParenToken;
			case CharacterCodes.closeParen:
				pos++;
				return token = SyntaxKind.CloseParenToken;
			case CharacterCodes.openBracket:
				pos++;
				return token = SyntaxKind.OpenBracketToken;
			case CharacterCodes.closeBracket:
				pos++;
				return token = SyntaxKind.CloseBracketToken;
			case CharacterCodes.colon:
				pos++;
				return token = SyntaxKind.ColonToken;
			case CharacterCodes.comma:
				pos++;
				return token = SyntaxKind.CommaToken;
			case CharacterCodes.equals:
				pos++;
				return token = SyntaxKind.EqualToken;
			case CharacterCodes.semicolon:
				pos++;
				return token = SyntaxKind.SemicolonToken;
			case CharacterCodes.at: {
				// @include "path" — consume the keyword and let the parser handle it
				pos++;
				let kwStart = pos;
				while (pos < len && isValidPropertyCharacter(text.charCodeAt(pos))) {
					pos++;
				}
				value = '@' + text.substring(kwStart, pos);
				if (value === '@include') {
					return token = SyntaxKind.IncludeDirective;
				}
				return token = SyntaxKind.Unknown;
			}
			// strings
			case CharacterCodes.doubleQuote:
				pos++;
				value = scanString();
				return token = SyntaxKind.StringLiteral;
			// comments
			case CharacterCodes.slash:
				const start = pos - 1;
				// Single-line comment
				if (text.charCodeAt(pos + 1) === CharacterCodes.slash) {
					pos += 2;

					while (pos < len) {
						if (isLineBreak(text.charCodeAt(pos))) {
							break;
						}
						pos++;

					}
					value = text.substring(start, pos);
					return token = SyntaxKind.LineCommentTrivia;
				}

				// Multi-line comment
				if (text.charCodeAt(pos + 1) === CharacterCodes.asterisk) {
					pos += 2;

					const safeLength = len - 1; // For lookahead.
					let commentClosed = false;
					while (pos < safeLength) {
						const ch = text.charCodeAt(pos);

						if (ch === CharacterCodes.asterisk && text.charCodeAt(pos + 1) === CharacterCodes.slash) {
							pos += 2;
							commentClosed = true;
							break;
						}

						pos++;

						if (isLineBreak(ch)) {
							if (ch === CharacterCodes.carriageReturn && text.charCodeAt(pos) === CharacterCodes.lineFeed) {
								pos++;
							}

							lineNumber++;
							tokenLineStartOffset = pos;
						}
					}

					if (!commentClosed) {
						pos++;
						scanError = ScanError.UnexpectedEndOfComment;
					}

					value = text.substring(start, pos);
					return token = SyntaxKind.BlockCommentTrivia;
				}
				// just a single slash
				value += String.fromCharCode(code);
				pos++;
				return token = SyntaxKind.Unknown;
			case CharacterCodes.hash:
				const s2 = pos - 1;
				pos++;
				while (pos < len) {
					if (isLineBreak(text.charCodeAt(pos))) {
						break;
					}
					pos++;
				}
				value = text.substring(s2, pos);
				return token = SyntaxKind.LineCommentTrivia;
			case CharacterCodes.minus:
				value += String.fromCharCode(code);
				pos++;
				if (pos === len || !isDigit(text.charCodeAt(pos))) {
					return token = SyntaxKind.Unknown;
				}
				if (pos + 1 < len && text.charCodeAt(pos) === CharacterCodes._0 && isBasePrefix(text.charCodeAt(pos + 1))) {
					const invalidStart = pos;
					pos += 2;
					while (pos < len && isAlphaNumeric(text.charCodeAt(pos))) {
						pos++;
					}
					value += text.substring(invalidStart, pos);
					return token = SyntaxKind.Unknown;
				}
			// found a minus, followed by a number so
			// we fall through to proceed with scanning
			// numbers
			case CharacterCodes.plus:
				value += String.fromCharCode(code);
				pos++;
				if (pos === len || (!isDigit(text.charCodeAt(pos)) && text.charCodeAt(pos) !== CharacterCodes.dot)) {
					return token = SyntaxKind.Unknown;
				}
				if (pos + 1 < len && text.charCodeAt(pos) === CharacterCodes._0 && isBasePrefix(text.charCodeAt(pos + 1))) {
					const invalidStart = pos;
					pos += 2;
					while (pos < len && isAlphaNumeric(text.charCodeAt(pos))) {
						pos++;
					}
					value += text.substring(invalidStart, pos);
					return token = SyntaxKind.Unknown;
				}
			// found a plus, followed by a digit or dot — fall through to scan number
			case CharacterCodes._0:
			case CharacterCodes._1:
			case CharacterCodes._2:
			case CharacterCodes._3:
			case CharacterCodes._4:
			case CharacterCodes._5:
			case CharacterCodes._6:
			case CharacterCodes._7:
			case CharacterCodes._8:
			case CharacterCodes._9:
				value += scanNumber();
				return token = SyntaxKind.NumericLiteral;
			case CharacterCodes.dot:
				// Leading-dot float: .digits
				if (pos + 1 < len && isDigit(text.charCodeAt(pos + 1))) {
					value += scanNumber();
					return token = SyntaxKind.NumericLiteral;
				}
				value += String.fromCharCode(code);
				pos++;
				return token = SyntaxKind.Unknown;
			// literals and unknown symbols
			default:
				if (isValidPropertyCharacterStart(code)) {
					pos++;
					value = scanPropertyName();
					// keywords: true, false
					const lcValue = value.toLowerCase();
					switch (lcValue) {
						case 'true':
							return token = SyntaxKind.TrueKeyword;
						case 'false':
							return token = SyntaxKind.FalseKeyword;
					}
					return token = SyntaxKind.PropertyName;
				}

				// is a literal? Read the full word.
				while (pos < len && isUnknownContentCharacter(code)) {
					pos++;
					code = text.charCodeAt(pos);
				}
				if (tokenOffset !== pos) {
					value = text.substring(tokenOffset, pos);
					// keywords: true, false, null
					switch (value) {
						case 'true': return token = SyntaxKind.TrueKeyword;
						case 'false': return token = SyntaxKind.FalseKeyword;
					}
					return token = SyntaxKind.Unknown;
				}
				}
				// Handle case-insensitive booleans that start with upper-case letters
				// (already handled above via isValidPropertyCharacterStart, but keep fallthrough clean)
				{
				// some
				value += String.fromCharCode(code);
				pos++;
				return token = SyntaxKind.Unknown;
		}
	}

	function isUnknownContentCharacter(code: CharacterCodes) {
		if (isWhiteSpace(code) || isLineBreak(code)) {
			return false;
		}
		switch (code) {
			case CharacterCodes.closeBrace:
			case CharacterCodes.closeBracket:
			case CharacterCodes.openBrace:
			case CharacterCodes.openBracket:
			case CharacterCodes.doubleQuote:
			case CharacterCodes.colon:
			case CharacterCodes.comma:
			case CharacterCodes.slash:
				return false;
		}
		return true;
	}

	function scanNextNonTrivia(): SyntaxKind {
		let result: SyntaxKind;
		do {
			result = scanNext();
		} while (result >= SyntaxKind.LineCommentTrivia && result <= SyntaxKind.Trivia);
		return result;
	}

	return {
		setPosition: setPosition,
		getPosition: () => pos,
		scan: ignoreTrivia ? scanNextNonTrivia : scanNext,
		getToken: () => token,
		getTokenValue: () => value,
		getTokenOffset: () => tokenOffset,
		getTokenLength: () => pos - tokenOffset,
		getTokenStartLine: () => lineStartOffset,
		getTokenStartCharacter: () => tokenOffset - prevTokenLineStartOffset,
		getTokenError: () => scanError,
	};
}

function isWhiteSpace(ch: number): boolean {
	switch (ch) {
		case CharacterCodes.space:
		case CharacterCodes.tab:
		case CharacterCodes.verticalTab:
		case CharacterCodes.formFeed:
		case CharacterCodes.nonBreakingSpace:
		case CharacterCodes.ogham:
		case CharacterCodes.enQuad:
		case CharacterCodes.zeroWidthSpace:
		case CharacterCodes.narrowNoBreakSpace:
		case CharacterCodes.mathematicalSpace:
		case CharacterCodes.ideographicSpace:
		case CharacterCodes.byteOrderMark:
			return true;
		default:
			return false;
	}
}

function isLineBreak(ch: number): boolean {
	switch (ch) {
		case CharacterCodes.lineFeed:
		case CharacterCodes.carriageReturn:
		case CharacterCodes.lineSeparator:
		case CharacterCodes.paragraphSeparator:
			return true;
		default:
			return false;
	}
}

function isDigit(ch: number): boolean {
	return ch >= CharacterCodes._0 && ch <= CharacterCodes._9;
}

function isValidPropertyCharacterStart(ch: number): boolean {
	// Per spec: name starts with letter or '*'
	return (ch >= CharacterCodes.A && ch <= CharacterCodes.Z) ||
		(ch >= CharacterCodes.a && ch <= CharacterCodes.z) ||
		(ch === CharacterCodes.asterisk);
}

function isValidPropertyCharacter(ch: number): boolean {
	// Per spec: name continues with letter, digit, '-', or '*'
	return (ch >= CharacterCodes.A && ch <= CharacterCodes.Z) ||
		(ch >= CharacterCodes.a && ch <= CharacterCodes.z) ||
		isDigit(ch) ||
		(ch === CharacterCodes.minus) ||
		(ch === CharacterCodes.asterisk) ||
		(ch === CharacterCodes.underscore);
}

function isHexDigit(ch: number): boolean {
	return (ch >= CharacterCodes._0 && ch <= CharacterCodes._9) ||
		(ch >= CharacterCodes.A && ch <= CharacterCodes.F) ||
		(ch >= CharacterCodes.a && ch <= CharacterCodes.f);
}

function isAlphaNumeric(ch: number): boolean {
	return (ch >= CharacterCodes._0 && ch <= CharacterCodes._9) ||
		(ch >= CharacterCodes.A && ch <= CharacterCodes.Z) ||
		(ch >= CharacterCodes.a && ch <= CharacterCodes.z);
}

function isBasePrefix(ch: number): boolean {
	return ch === CharacterCodes.x ||
		ch === CharacterCodes.X ||
		ch === CharacterCodes.b ||
		ch === CharacterCodes.B ||
		ch === CharacterCodes.o ||
		ch === CharacterCodes.O ||
		ch === CharacterCodes.q ||
		ch === CharacterCodes.Q;
}
