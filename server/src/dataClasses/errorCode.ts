/**
 * Error codes used by diagnostics
 */
const enum ErrorCodeGroup {
	Scanner = 0x100,
	Parser = 0x200,
	Terminator = 0x300
}

export enum ErrorCode {
	Undefined = 0,
	EnumValueMismatch = 1,
	UnexpectedEndOfComment = ErrorCodeGroup.Scanner + 0x01,
	UnexpectedEndOfString,
	UnexpectedEndOfNumber,
	InvalidUnicode,
	InvalidEscapeCharacter,
	InvalidCharacter,
	PropertyExpected = ErrorCodeGroup.Parser + 0x01,
	CommaExpected,
	ColonExpected,
	ValueExpected,
	CommaOrCloseBacketExpected,
	CommaOrCloseBraceExpected,
	TrailingComma,
	DuplicateKey,
	CommentNotPermitted,
	SemicolonExpected = ErrorCodeGroup.Terminator,
	TrailingCommaCompatibility
}
