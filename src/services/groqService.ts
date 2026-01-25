
import { MoveQuality } from '../gameTypes';

interface MoveInfo {
  san: string;
  quality: MoveQuality;
  commentary: string;
}

export const rewriteCommentaryWithGroq = async (moves: MoveInfo[]): Promise<string[]> => {
  await new Promise(resolve => setTimeout(resolve, 500));
  return moves.map(m => m.commentary);
};
