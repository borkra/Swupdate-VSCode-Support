'use strict';

export enum SyntaxKind {
	OpenBraceToken = 1,
	CloseBraceToken = 2,
	OpenParenToken = 3,
	CloseParenToken = 4,
	OpenBracketToken = 5,
	CloseBracketToken = 6,
	CommaToken = 7,
	ColonToken = 8,
	EqualToken = 9,
	SemicolonToken = 10,
	TrueKeyword = 11,
	FalseKeyword = 12,
	StringLiteral = 13,
	NumericLiteral = 14,
	PropertyName = 15,
	IncludeDirective = 16,
	LineCommentTrivia = 17,
	BlockCommentTrivia = 18,
	LineBreakTrivia = 19,
	Trivia = 20,
	Unknown = 21,
	EOF = 22
}
