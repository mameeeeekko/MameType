export interface EvaluationResult {
  success: boolean;
  isMiss: boolean;
  isComplete: boolean;
  isFinished: boolean;
  charCount: number;
  key: string;
  ignored?: boolean;
  typed: string;
  inputedRomaji: string;
  pos: number;
}

export interface TypingSessionOptions {
  finalNMode?: 'nn' | 'n';
}

export interface TypingProgress {
  pos: number;
  textLength: number;
  typedLength: number;
  isFinished: boolean;
}

export interface TypingState {
  text: string;
  pos: number;
  typed: string;
  inputedRomaji: string;
}

export declare const VERSION: string;
export declare const ROMA_TABLE: Record<string, string[]>;
export declare const SYMBOL_TABLE: Record<string, string>;

export declare function toHalfWidthAlpha(str: string): string;
export declare function normalizeInputKey(key: string): { key: string; isValid: boolean };

export declare function isSmallTsu(kana: string): boolean;
export declare function isSymbol(kana: string): boolean;
export declare function isN(kana: string): boolean;
export declare function isNaRow(kana: string): boolean;

export declare function getKana(text: string, pos: number): string | null;
export declare function getRomajiCandidates(
  kana: string,
  prevKana?: string | null,
  nextKana?: string | null,
  finalNMode?: 'nn' | 'n'
): string[];
export declare function getSokuonCandidates(nextKana: string | null): string[];
export declare function getCandidatesForKana(
  text: string,
  pos: number,
  options?: TypingSessionOptions
): string[];

export declare function getDisplayFullRoma(params: {
  text: string;
  pos?: number;
  typed?: string;
  inputedRomaji?: string;
  finalNMode?: 'nn' | 'n';
}): string;

export declare function buildBaseRomaji(text: string, options?: TypingSessionOptions): string;
export declare function buildRemainingRomajiDynamic(
  text: string,
  pos: number,
  typed: string,
  options?: TypingSessionOptions
): string;

export declare function evaluateKey(
  rawKey: string,
  state: TypingState,
  options?: TypingSessionOptions
): EvaluationResult;

export declare class TypingSession {
  text: string;
  pos: number;
  typed: string;
  inputedRomaji: string;
  options: TypingSessionOptions;
  isFinished: boolean;

  constructor(text: string, options?: TypingSessionOptions);
  input(keyOrEvent: string | KeyboardEvent | { key: string }): EvaluationResult;
  getDisplayRoma(): string;
  getCurrentKana(): string | null;
  getCurrentCandidates(): string[];
  getProgress(): TypingProgress;
  reset(text?: string): void;
}

