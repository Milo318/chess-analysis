
// Mock MoveQuality to avoid importing TypeScript
const MoveQuality = {
    BRILLIANT: 'BRILLIANT',
    GREAT: 'GREAT',
    BEST: 'BEST',
    EXCELLENT: 'EXCELLENT',
    GOOD: 'GOOD',
    BOOK: 'BOOK',
    INACCURACY: 'INACCURACY',
    MISTAKE: 'MISTAKE',
    BLUNDER: 'BLUNDER',
    NONE: 'NONE'
};

// Extracted logic from App.tsx
const cpToWinPercent = (cp) => {
    return 50 + 50 * (2 / (1 + Math.exp(-0.00368208 * cp)) - 1);
};

const calculateMoveAccuracy = (winPercentBefore, winPercentAfter) => {
    const loss = winPercentBefore - winPercentAfter;
    if (loss <= 0) return 100;
    return Math.max(0, 103.1668 * Math.exp(-0.04354 * loss) - 3.1669);
};

const determineMoveQuality = (
    cpLoss,
    isEngineMove,
    secondBestScore,
    scoreBefore,
    scoreAfter,
    move
) => {
    // Brilliant: Opfer das die Position verbessert und schwer zu finden ist
    if (isEngineMove && secondBestScore !== undefined && scoreBefore !== undefined && scoreAfter !== undefined) {
        const gapToSecondBest = (scoreAfter || 0) - (secondBestScore || 0);
        const positionImproved = scoreAfter > scoreBefore;

        // Materialopfer erkennen (capture mit höherwertigem Material)
        const isCapture = move?.captured !== undefined;
        const isSacrifice = isCapture && move?.piece &&
            ['q', 'r', 'b', 'n'].includes(move.piece.toLowerCase());

        console.log(`Checking Brilliant/Great:
        Gap: ${gapToSecondBest}
        Imp: ${positionImproved} (${scoreBefore} -> ${scoreAfter})
        IsCapture: ${isCapture}
        Piece: ${move?.piece}
        IsSacrifice (Logic): ${isSacrifice}
      `);

        // Brilliant: Große Lücke zum zweitbesten Zug (>150cp) UND Position verbessert UND schwer zu finden
        if (gapToSecondBest >= 150 && positionImproved && isSacrifice) {
            return MoveQuality.BRILLIANT;
        }

        // Great: Große Lücke zum zweitbesten Zug (>100cp) aber kein Opfer
        if (gapToSecondBest >= 100 && cpLoss <= 0) {
            return MoveQuality.GREAT;
        }
    }

    // Standard Bewertungen
    if (isEngineMove || cpLoss <= 0) return MoveQuality.BEST;
    if (cpLoss <= 10) return MoveQuality.EXCELLENT;
    if (cpLoss <= 30) return MoveQuality.GOOD;
    if (cpLoss <= 80) return MoveQuality.INACCURACY;
    if (cpLoss <= 200) return MoveQuality.MISTAKE;
    return MoveQuality.BLUNDER;
};

// Test Runner
console.log("=== RUNNING MOVE EVALUATION TESTS ===\n");

// Test 1: Accuracy Calculation for varying CP losses
console.log("--- Test 1: Accuracy Calculation ---");
const testCpLosses = [0, 10, 30, 50, 100, 200, 500];
testCpLosses.forEach(loss => {
    const startProp = cpToWinPercent(100);
    const endProp = cpToWinPercent(100 - loss);
    const acc = calculateMoveAccuracy(startProp, endProp);
    console.log(`CP Loss: ${loss}, Win% Loss: ${(startProp - endProp).toFixed(2)}, Accuracy: ${acc.toFixed(1)}`);
});

// Test 2: Classification Logic
console.log("\n--- Test 2: Classification Logic ---");

// Case A: Best Move (Engine Match)
const resBest = determineMoveQuality(0, true, 40, 50, 50, { piece: 'p' });
console.log(`Case A (Best Move): ${resBest}`);

// Case B: Great Move Candidate
// Gap > 100, cpLoss <= 0
// Engine found best move, second best is bad.
console.log("\nCase B (Checking 'Great'):");
// scoreAfter = 200, secondBest = 50. Gap = 150.
const resGreat = determineMoveQuality(0, true, 50, 200, 200, { piece: 'p' });
console.log(`Result: ${resGreat}`);

// Case C: Brilliant Move Candidate
// Gap > 150, Position Improved, "Sacrifice" (capture with major piece)
console.log("\nCase C (Checking 'Brilliant'):");
// scoreBefore = 100, scoreAfter = 300 (Improved). SecondBest = 100. Gap = 200.
// Move is Q captures...
const resBrilliant = determineMoveQuality(0, true, 100, 100, 300, { piece: 'q', captured: 'p' });
console.log(`Result: ${resBrilliant}`);

// Case D: 'Brilliant' but NOT a capture
console.log("\nCase D (GAP > 150 but no capture):");
const resBrilliantFail = determineMoveQuality(0, true, 100, 100, 300, { piece: 'q' });
console.log(`Result: ${resBrilliantFail}`);

// Case E: Blunder
console.log("\nCase E (Blunder 300cp loss):");
const resBlunder = determineMoveQuality(300, false, undefined, undefined, undefined, undefined);
console.log(`Result: ${resBlunder}`);
