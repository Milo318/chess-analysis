
import { Chess } from 'chess.js';

export const robustParseGame = (input: string): Chess | null => {
    const tempGame = new Chess();
    const trimmed = input.trim();
    if (!trimmed) return null;

    // 0. Try loading as FEN
    try {
      tempGame.load(trimmed);
      return tempGame;
    } catch (e) { }

    // 1. Try standard PGN loading
    try {
      const pgnGame = new Chess();
      pgnGame.loadPgn(trimmed);
      return pgnGame;
    } catch (e) { }

    // 2. Heavy Cleaning & Manual Move Loading
    try {
      const manualGame = new Chess();
      let moveText = trimmed.replace(/\[[^\]]*\]/g, ' ');

      moveText = moveText
        .replace(/\{[^\}]*\}/g, ' ')
        .replace(/\([^\)]*\)/g, ' ')
        .replace(/\[%clk\s+[^\]]+\]/g, ' ');

      moveText = moveText.replace(/[!?+#]+/g, (match) => {
        return match.replace(/[!?]+/g, '');
      });

      const tokens = moveText.split(/[\s\n\t]+/).filter(t => {
        if (!t) return false;
        if (t.match(/^\d+\.*$/)) return false;
        if (['1-0', '0-1', '1/2-1/2', '*', '½-½'].includes(t)) return false;
        return true;
      });

      let movesApplied = 0;
      for (const token of tokens) {
        try {
          const result = manualGame.move(token);
          if (result) movesApplied++;
        } catch (e) { }
      }

      if (movesApplied > 0) {
        return manualGame;
      }
    } catch (e) { }

    return null;
  };
