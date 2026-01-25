
import { MoveQuality } from '../gameTypes';

export const cpToWinPercent = (cp: number): number => {
    return 50 + 50 * (2 / (1 + Math.exp(-0.00368208 * cp)) - 1);
};

export const calculateMoveAccuracy = (winPercentBefore: number, winPercentAfter: number): number => {
    const loss = winPercentBefore - winPercentAfter;
    if (loss <= 0) return 100;
    return Math.max(0, 103.1668 * Math.exp(-0.04354 * loss) - 3.1669);
};

const getMaterialCount = (fen: string) => {
    const pieces = fen.split(' ')[0];
    let white = 0;
    let black = 0;

    const values: Record<string, number> = {
        p: 1, n: 3, b: 3, r: 5, q: 9,
        P: 1, N: 3, B: 3, R: 5, Q: 9
    };

    for (const char of pieces) {
        if (values[char]) {
            if (char === char.toUpperCase()) {
                white += values[char];
            } else {
                black += values[char];
            }
        }
    }

    return { white, black };
};

export const determineMoveQuality = (
    cpLoss: number,
    isEngineMove: boolean,
    secondBestScore: number | undefined,
    scoreBefore: number,
    scoreAfter: number,
    prevFen: string,
    currentFen: string,
    isWhiteTurn: boolean
): MoveQuality => {
    // Brilliant Detection:
    if (
        isEngineMove &&
        secondBestScore !== undefined &&
        scoreAfter !== undefined &&
        scoreBefore !== undefined
    ) {
        const gapToSecondBest = scoreAfter - secondBestScore;

        // Calculate material delta
        const matBefore = getMaterialCount(prevFen);
        const matAfter = getMaterialCount(currentFen);

        const myMatBefore = isWhiteTurn ? matBefore.white : matBefore.black;
        const myMatAfter = isWhiteTurn ? matAfter.white : matAfter.black;

        // A sacrifice means we have LESS material now than before
        const materialLost = myMatBefore - myMatAfter;

        const isSacrifice = materialLost > 0;

        // "Brilliant":
        // 1. It is a sacrifice (we lost material value)
        // 2. The move is sound (cpLoss is very low, effectively 0)
        // 3. Large gap OR maintains winning position
        if (isSacrifice && cpLoss <= 25 && gapToSecondBest > 50) {
            return MoveQuality.BRILLIANT;
        }

        // "Great":
        if (gapToSecondBest >= 100 && cpLoss <= 0) {
            return MoveQuality.GREAT;
        }
    }

    // Standard Classifications
    if (isEngineMove || cpLoss <= 0) return MoveQuality.BEST;
    if (cpLoss <= 10) return MoveQuality.EXCELLENT;
    if (cpLoss <= 30) return MoveQuality.GOOD;
    if (cpLoss <= 80) return MoveQuality.INACCURACY;
    if (cpLoss <= 200) return MoveQuality.MISTAKE;
    return MoveQuality.BLUNDER;
};
