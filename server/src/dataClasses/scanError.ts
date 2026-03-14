'use strict';

export enum ScanError {
	None = 0,
	UnexpectedEndOfComment,
	UnexpectedEndOfString,
	UnexpectedEndOfNumber,
	InvalidUnicode,
	InvalidEscapeCharacter,
	InvalidCharacter,
	UnexpectedEndOfPropertyName
}
