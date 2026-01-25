
export enum MoveQuality {
  BRILLIANT = 'BRILLIANT',
  GREAT = 'GREAT',
  BEST = 'BEST',
  EXCELLENT = 'EXCELLENT',
  GOOD = 'GOOD',
  BOOK = 'BOOK',
  INACCURACY = 'INACCURACY',
  MISTAKE = 'MISTAKE',
  BLUNDER = 'BLUNDER',
  NONE = 'NONE'
}

export interface MoveAnalysis {
  san: string;
  quality: MoveQuality;
  evaluation: number; // Centipawns or mate (e.g. 1000 for M1)
  commentary: string;
  bestMove?: string;
}

export interface GameReview {
  moves: MoveAnalysis[];
  summary: string;
  accuracyWhite: number;
  accuracyBlack: number;
}
