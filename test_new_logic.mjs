
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

// --- LOGIC FROM UTILS (Copy-pasted for standalone testing) ---
const getMaterialCount = (fen) => {
    const pieces = fen.split(' ')[0];
    let white = 0;
    let black = 0;

    const values = {
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

const determineMoveQuality = (
    cpLoss,
    isEngineMove,
    secondBestScore,
    scoreBefore,
    scoreAfter,
    prevFen,
    currentFen,
    isWhiteTurn
) => {
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

        // Debug output
        console.log(`Debug: MatLost: ${materialLost}, Gap: ${gapToSecondBest}`);

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

// --- SIMULATION ---

console.log("=== VERIFYING NEW BRILLIANT LOGIC ===\n");

// Scenario 1: Queen Sacrifice
// White Queen (9) takes on h7 protected by Knight. Queen is lost.
// Position: White mates in 3 (Score is High).
// Before: Normal Material. After: White down -9.

const fenBeforeSac = "rnbqk2r/pppp1ppp/8/8/4Q3/8/PPPP1PPP/RNB1KBNR w KQkq - 0 1"; // White has Queen
const fenAfterSac = "rnbqk2r/pppp1pQp/8/8/8/8/PPPP1PPP/RNB1KBNR b KQkq - 0 1"; // Mock FEN where Queen is gone (just theoretically)
// Actually let's just mock FEN strings that clearly show material drop.
// Simple way:
// FEN A: "Q... w" (White has Queen) -> Val: 9
// FEN B: "... w" (White has NO Queen) -> Val: 0
// Delta: 9 (Sacrifice!)

// Manual FENs for testing material count logic:
const fenWithQ = "4k3/8/8/8/8/8/4Q3/4K3 w - - 0 1"; // White: K(0)+Q(9)=9. Black: K=0.
const fenWithoutQ = "4k3/8/8/8/8/8/8/4K3 w - - 0 1"; // White: 0.

console.log("--- Test Case 1: Queen Sacrifice ---");
// isEngineMove: true
// SecondBest: 0 (Equal)
// ScoreBefore: 500 (Winning)
// ScoreAfter: 500 (Still Winning)
// Gap: 500 - 0 = 500 (>50)
// Material: Lost 9.

const resultSac = determineMoveQuality(
    0, // cpLoss
    true, // isEngineMove
    0, // secondBestScore (bad alternative)
    500, // scoreBefore
    500, // scoreAfter
    fenWithQ, // prevFen
    fenWithoutQ, // currentFen (Queen gone!)
    true // isWhiteTurn
);
console.log(`Expected: BRILLIANT. Actual: ${resultSac}`);


console.log("\n--- Test Case 2: Trade (Not Sacrifice) ---");
// Rook takes Bishop (5 vs 3). Net change is usually not a "sacrifice" unless we lose value.
// Let's say we trade Pawn for Pawn.
// FEN A: "P... w" (1)
// FEN B: "... w" (0)
// Wait, if I take a pawn, I lose my pawn, but I also gained a captured piece?
// Ah, my logic `myMatBefore - myMatAfter` ONLY counts pieces ON BOARD.
// If I capture a pawn (my pawn 1 -> my pawn still 1 at new square? No.)
// When I move:
// Move PxP:
//   My pawn at e4 (1) disappears.
//   My pawn appears at d5 (1).
//   Material change: 0.
//   So `materialLost` = 0. Not a sacrifice. Correct.

const fenPawn = "4k3/3p4/4P3/8/8/8/8/4K3 w - - 0 1"; // White has P on e6.
const fenPawnMoved = "4k3/3P4/8/8/8/8/8/4K3 w - - 0 1"; // White has P on d7.
// Material check:
const matA = getMaterialCount(fenPawn); // White: 1
const matB = getMaterialCount(fenPawnMoved); // White: 1
// Loss: 0.

const resultTrade = determineMoveQuality(
    0,
    true,
    0, // Gap 100
    100, // scoreBefore
    200, // score after
    fenPawn,
    fenPawnMoved,
    true
);
// Gap is 200 - 0 = 200 (>100).
// Not sacrifice.
// Should be GREAT.
console.log(`Expected: GREAT. Actual: ${resultTrade}`);

console.log("\n--- Test Case 3: False Positive Check ---");
// Previous logic failed here: "Capture is Brilliant".
// New logic: Capture is NOT brilliant unless own material drops.
// King takes Queen (Opponent blundered).
// My material: King (0). After: King (0). Loss: 0.
// Should be BEST (or Great if only move), but NEVER Brilliant.

const fenKing = "4k3/8/8/8/8/8/8/4K3 w - - 0 1";
const resultCapture = determineMoveQuality(
    0, true, 0, 900, 900, fenKing, fenKing, true
);
console.log(`Expected: GREAT (large gap) or BEST. Actual: ${resultCapture}`);

