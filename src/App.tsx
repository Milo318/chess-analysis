
import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { Chess } from 'chess.js';
import { Chessboard } from 'react-chessboard';
import { StockfishEngine } from './services/stockfishService';
import { GameReview, MoveAnalysis, MoveQuality } from './gameTypes';
import MoveBadge from './components/MoveBadge';
import { cpToWinPercent, calculateMoveAccuracy, determineMoveQuality } from './utils/evaluationUtils';
import { robustParseGame } from './utils/pgnUtils';
import {
  Play,
  Pause,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
  Search,
  Trophy,
  Activity,
  Loader2,
  AlertCircle,
  FileText,
  Cpu
} from 'lucide-react';

const App: React.FC = () => {
  const [game, setGame] = useState(new Chess());
  const [pgnInput, setPgnInput] = useState('');
  const [analysis, setAnalysis] = useState<GameReview | null>(null);
  const [currentMoveIndex, setCurrentMoveIndex] = useState(-1);
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [moveFrom, setMoveFrom] = useState<string | null>(null);

  const engineRef = useRef<StockfishEngine | null>(null);
  const playIntervalRef = useRef<number | null>(null);

  useEffect(() => {
    engineRef.current = new StockfishEngine();
    return () => engineRef.current?.terminate();
  }, []);

  const moveHistoryDetailed = useMemo(() => {
    const parsed = robustParseGame(pgnInput);
    return parsed ? parsed.history({ verbose: true }) : [];
  }, [pgnInput]);

  const moveHistory = useMemo(() => {
    if (analysis) return analysis.moves;
    return moveHistoryDetailed.map(m => ({
      san: m.san,
      quality: MoveQuality.NONE,
      commentary: '',
      evaluation: 0
    }));
  }, [moveHistoryDetailed, analysis]);

  const goToMove = useCallback((index: number) => {
    if (index < -1) index = -1;
    if (index >= moveHistoryDetailed.length) index = moveHistoryDetailed.length - 1;

    const newGame = new Chess();
    const historyGame = robustParseGame(pgnInput);
    if (!historyGame) return;

    const moves = historyGame.history();
    for (let i = 0; i <= index && i < moves.length; i++) {
      newGame.move(moves[i]);
    }
    setGame(newGame);
    setCurrentMoveIndex(index);
  }, [pgnInput, moveHistoryDetailed.length]);

  useEffect(() => {
    if (isPlaying) {
      playIntervalRef.current = window.setInterval(() => {
        setCurrentMoveIndex((prev) => {
          const next = prev + 1;
          if (next >= moveHistory.length) {
            setIsPlaying(false);
            return prev;
          }
          goToMove(next);
          return next;
        });
      }, 1500);
    } else {
      if (playIntervalRef.current) clearInterval(playIntervalRef.current);
    }
    return () => { if (playIntervalRef.current) clearInterval(playIntervalRef.current); };
  }, [isPlaying, moveHistory.length, goToMove]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLTextAreaElement) return;

      switch (e.key) {
        case 'ArrowLeft':
          e.preventDefault();
          setIsPlaying(false);
          goToMove(Math.max(-1, currentMoveIndex - 1));
          break;
        case 'ArrowRight':
          e.preventDefault();
          setIsPlaying(false);
          goToMove(Math.min(moveHistory.length - 1, currentMoveIndex + 1));
          break;
        case ' ':
          e.preventDefault();
          setIsPlaying(!isPlaying);
          break;
        case 'Home':
          e.preventDefault();
          setIsPlaying(false);
          goToMove(-1);
          break;
        case 'End':
          e.preventDefault();
          setIsPlaying(false);
          goToMove(moveHistory.length - 1);
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentMoveIndex, moveHistory.length, goToMove, isPlaying]);

  const generateCommentary = (quality: MoveQuality, cpLoss: number, bestMove?: string): string => {
    switch (quality) {
      case MoveQuality.BRILLIANT:
        return 'Brillant!! Großartiges Opfer, das die Position verbessert!';
      case MoveQuality.GREAT:
        return 'Großartiger Zug! Der einzige Weg zum Vorteil.';
      case MoveQuality.BLUNDER:
        return `Grober Fehler! Verliert ${(cpLoss / 100).toFixed(1)} Bauern.${bestMove ? ` Besser: ${bestMove}` : ''}`;
      case MoveQuality.MISTAKE:
        return `Ein Fehler.${bestMove ? ` ${bestMove} war stärker.` : ''}`;
      case MoveQuality.INACCURACY:
        return `Ungenau.${bestMove ? ` ${bestMove} war präziser.` : ''}`;
      case MoveQuality.GOOD:
        return 'Solider Zug.';
      case MoveQuality.EXCELLENT:
        return 'Exzellenter Zug!';
      case MoveQuality.BEST:
        return 'Der beste Zug in dieser Position.';
      default:
        return 'Strategische Fortsetzung.';
    }
  };

  const generateSummary = (moves: MoveAnalysis[], accWhite: number, accBlack: number): string => {
    const blunders = moves.filter(m => m.quality === MoveQuality.BLUNDER).length;
    const mistakes = moves.filter(m => m.quality === MoveQuality.MISTAKE).length;
    const brilliantMoves = moves.filter(m => m.quality === MoveQuality.BRILLIANT).length;

    let summary = `Weiß: ${accWhite}% Genauigkeit, Schwarz: ${accBlack}% Genauigkeit. `;

    if (blunders > 0) {
      summary += `${blunders} grobe Fehler. `;
    }
    if (mistakes > 0) {
      summary += `${mistakes} Fehler. `;
    }
    if (brilliantMoves > 0) {
      summary += `${brilliantMoves} brillante Züge! `;
    }

    if (accWhite > 90 && accBlack > 90) {
      summary += 'Sehr präzise Partie von beiden Seiten.';
    } else if (accWhite > accBlack + 10) {
      summary += 'Weiß spielte deutlich präziser.';
    } else if (accBlack > accWhite + 10) {
      summary += 'Schwarz spielte deutlich präziser.';
    }

    return summary;
  };

  const startAnalysis = async () => {
    if (!pgnInput.trim() || !engineRef.current) {
      setError("Please enter a game to analyze.");
      return;
    }

    setIsLoading(true);
    setProgress(0);
    setError(null);
    setAnalysis(null);

    try {
      const parsedGame = robustParseGame(pgnInput);
      if (!parsedGame) {
        throw new Error("Unable to parse the game. Please ensure the move text is correct.");
      }

      const moves = parsedGame.history({ verbose: true });
      if (moves.length === 0) {
        throw new Error("The game appears to be empty or contains no valid moves.");
      }

      const engineResults: MoveAnalysis[] = [];
      const analysisGame = new Chess();

      let lastEval = await engineRef.current.evaluate(analysisGame.fen(), 12);
      let totalAccuracyWhite = 0;
      let totalAccuracyBlack = 0;
      let whiteMoves = 0;
      let blackMoves = 0;

      for (let i = 0; i < moves.length; i++) {
        const move = moves[i];
        const isWhite = move.color === 'w';
        const bestMoveFromLastPos = lastEval.bestMove;

        const fenBefore = analysisGame.fen();
        const winPercentBefore = cpToWinPercent(lastEval.score);
        const scoreBefore = lastEval.score;

        analysisGame.move(move.san);
        const fenAfter = analysisGame.fen();

        const currentEval = await engineRef.current.evaluate(analysisGame.fen(), 12);

        const winPercentAfter = cpToWinPercent(-currentEval.score);
        const scoreAfter = -currentEval.score;

        const cpLoss = Math.max(0, scoreBefore - scoreAfter);
        const moveAccuracy = calculateMoveAccuracy(winPercentBefore, winPercentAfter);

        if (isWhite) {
          totalAccuracyWhite += moveAccuracy;
          whiteMoves++;
        } else {
          totalAccuracyBlack += moveAccuracy;
          blackMoves++;
        }

        const secondBestScore = lastEval.secondBestScore !== undefined
          ? lastEval.secondBestScore
          : undefined;

        const quality = determineMoveQuality(
          cpLoss,
          move.lan === bestMoveFromLastPos,
          secondBestScore,
          scoreBefore,
          scoreAfter,
          fenBefore,
          fenAfter,
          isWhite
        );

        engineResults.push({
          san: move.san,
          quality,
          evaluation: scoreAfter,
          commentary: generateCommentary(quality, cpLoss, bestMoveFromLastPos),
          bestMove: bestMoveFromLastPos
        });

        lastEval = currentEval;
        setProgress(Math.round(((i + 1) / moves.length) * 95));
      }

      const calculatedAccuracyWhite = whiteMoves > 0 ? Math.round(totalAccuracyWhite / whiteMoves) : 100;
      const calculatedAccuracyBlack = blackMoves > 0 ? Math.round(totalAccuracyBlack / blackMoves) : 100;

      setProgress(100);

      setAnalysis({
        moves: engineResults,
        summary: generateSummary(engineResults, calculatedAccuracyWhite, calculatedAccuracyBlack),
        accuracyWhite: calculatedAccuracyWhite,
        accuracyBlack: calculatedAccuracyBlack
      });
      setProgress(100);
      goToMove(engineResults.length - 1);
    } catch (err: any) {
      console.error("Analysis Error:", err);
      setError(err.message || "An unexpected error occurred during analysis.");
    } finally {
      setIsLoading(false);
    }
  };

  const currentAnalysis = useMemo(() => {
    if (!analysis || currentMoveIndex < 0) return null;
    return analysis.moves[currentMoveIndex];
  }, [analysis, currentMoveIndex]);

  const customSquareStyles = useMemo(() => {
    const styles: Record<string, any> = {};

    if (moveFrom) {
      styles[moveFrom] = { backgroundColor: 'rgba(255, 255, 0, 0.5)' };
    }

    if (currentMoveIndex >= 0 && currentMoveIndex < moveHistoryDetailed.length) {
      const move = moveHistoryDetailed[currentMoveIndex];
      if (move) {
        styles[move.from] = { backgroundColor: 'rgba(120, 180, 0, 0.4)' };
        styles[move.to] = { backgroundColor: 'rgba(120, 180, 0, 0.4)' };
      }
    }
    return styles;
  }, [currentMoveIndex, moveHistoryDetailed, moveFrom]);

  const customArrows = useMemo(() => {
    if (!currentAnalysis?.bestMove || currentAnalysis.quality === MoveQuality.BEST) return [];
    try {
      const from = currentAnalysis.bestMove.substring(0, 2);
      const to = currentAnalysis.bestMove.substring(2, 4);
      return [{ startSquare: from, endSquare: to, color: 'rgba(0, 180, 255, 0.7)' }];
    } catch {
      return [];
    }
  }, [currentAnalysis]);

  const evalPercentage = useMemo(() => {
    const score = currentAnalysis?.evaluation || 0;
    const capped = Math.max(-1000, Math.min(1000, score));
    return 50 + (capped / 20);
  }, [currentAnalysis]);

  const makeMove = useCallback((move: { from: string; to: string; promotion?: string }) => {
    try {
      const tempGame = new Chess();
      if (game.pgn()) {
          tempGame.loadPgn(game.pgn());
      } else {
          tempGame.load(game.fen());
      }

      const result = tempGame.move(move);

      if (result) {
        setGame(tempGame);
        setPgnInput(tempGame.pgn());
        setCurrentMoveIndex(tempGame.history().length - 1);
        return true;
      }
    } catch (e) {
      return false;
    }
    return false;
  }, [game]);

  const onPieceDrop = ({ sourceSquare, targetSquare }: { sourceSquare: string, targetSquare: string }) => {
    const move = {
      from: sourceSquare,
      to: targetSquare,
      promotion: 'q',
    };
    return makeMove(move);
  };

  const onSquareClick = ({ square }: { square: string }) => {
      if (!moveFrom) {
        const piece = game.get(square as any);
        if (piece && piece.color === game.turn()) {
          setMoveFrom(square);
        }
        return;
      }

      const move = {
        from: moveFrom,
        to: square,
        promotion: 'q',
      };

      if (makeMove(move)) {
          setMoveFrom(null);
      } else {
          const piece = game.get(square as any);
          if (piece && piece.color === game.turn()) {
              setMoveFrom(square);
          } else {
              setMoveFrom(null);
          }
      }
  };

  return (
    <div className="min-h-screen circuit-pattern flex flex-col items-center p-4 lg:p-8">
      <header className="w-full max-w-7xl mb-8 flex items-center justify-between pb-4">
        <div className="flex items-center gap-4">
          <div className="bg-gradient-to-br from-green-500 to-green-600 p-3 rounded-2xl neon-glow-green float-animation">
            <Activity className="text-white w-7 h-7" />
          </div>
          <div>
            <h1 className="text-2xl font-black uppercase tracking-tight text-white neon-text-green">
              GM Analysis Pro
            </h1>
            <p className="text-xs text-gray-500 font-medium">Professional Chess Analysis</p>
          </div>
        </div>
        <div className="hidden sm:flex items-center gap-3">
          <div className="glass-card flex items-center gap-2 px-4 py-2">
            <Cpu size={14} className="text-cyan-400" />
            <span className="font-mono text-[10px] text-cyan-300">STOCKFISH 10</span>
          </div>
        </div>
      </header>

      <main className="w-full max-w-7xl grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-7 flex flex-col gap-6">
          <div className="flex gap-4">
            <div className="w-8 h-[400px] sm:h-[600px] glass-card overflow-hidden relative">
              <div
                className="absolute bottom-0 w-full eval-bar-glow transition-all duration-1000 ease-out"
                style={{ height: `${Math.min(Math.max(evalPercentage, 5), 95)}%` }}
              />
              <div className="absolute inset-0 flex flex-col justify-between items-center py-6 text-[11px] font-black">
                <span className="text-gray-500">–</span>
                <span className="text-white neon-text-green text-sm">{((currentAnalysis?.evaluation || 0) / 100).toFixed(1)}</span>
                <span className="text-gray-500">+</span>
              </div>
            </div>

            <div className="flex-1 max-w-[600px]">
              <div className="board-container border-4 border-gray-800/50 neon-glow-green">
                <Chessboard
                  options={{
                    position: game.fen(),
                    onPieceDrop: onPieceDrop,
                    onSquareClick: onSquareClick,
                    darkSquareStyle: { backgroundColor: '#779556' },
                    lightSquareStyle: { backgroundColor: '#ebecd0' },
                    squareStyles: customSquareStyles,
                    arrows: customArrows as any,
                    animationDurationInMs: 300
                  }}
                />
              </div>

              <div className="mt-6 flex items-center justify-between glass-card p-4">
                <div className="flex gap-2">
                  <button
                    onClick={() => { setIsPlaying(false); goToMove(-1); }}
                    className="p-3 hover:bg-white/10 rounded-xl transition-all text-gray-400 hover:text-green-400 hover:neon-glow-green"
                    title="Reset Board"
                  ><RotateCcw size={20} /></button>
                  <button
                    onClick={() => { setIsPlaying(false); goToMove(currentMoveIndex - 1); }}
                    disabled={currentMoveIndex < 0}
                    className="p-3 hover:bg-white/10 rounded-xl transition-all disabled:opacity-20 text-gray-400 hover:text-white"
                  ><ChevronLeft size={24} /></button>
                </div>

                <button
                  onClick={() => setIsPlaying(!isPlaying)}
                  className={`flex items-center gap-3 px-8 py-3 rounded-2xl font-black text-xs tracking-widest transition-all active:scale-95 ${isPlaying ? 'bg-gradient-to-r from-orange-500 to-red-500 text-white shadow-[0_0_30px_rgba(249,115,22,0.5)]' : 'btn-premium text-white'}`}
                >
                  {isPlaying ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" />}
                  {isPlaying ? "STOP" : "REVIEW"}
                </button>

                <div className="flex gap-2">
                  <button
                    onClick={() => { setIsPlaying(false); goToMove(currentMoveIndex + 1); }}
                    disabled={currentMoveIndex >= moveHistory.length - 1}
                    className="p-3 hover:bg-white/10 rounded-xl transition-all disabled:opacity-20 text-gray-400 hover:text-white"
                  ><ChevronRight size={24} /></button>
                </div>
              </div>
            </div>
          </div>

          {currentAnalysis ? (
            <div className="glass-card-strong p-8 relative overflow-hidden group">
              <div className="absolute inset-0 bg-gradient-to-br from-green-500/5 to-cyan-500/5"></div>
              <div className="relative flex items-center gap-6 mb-6">
                <div className={`w-16 h-16 rounded-2xl flex items-center justify-center text-xl font-black ${currentAnalysis.evaluation >= 0 ? 'bg-gradient-to-br from-white to-gray-100 text-black neon-glow-green' : 'bg-gradient-to-br from-gray-700 to-gray-800 text-white border border-gray-600'}`}>
                  {((currentAnalysis.evaluation || 0) / 100).toFixed(1)}
                </div>
                <div>
                  <h3 className="font-black text-2xl flex items-center gap-4 text-white">
                    {currentMoveIndex + 1}. {currentAnalysis.san}
                    <div className="scale-125"><MoveBadge quality={currentAnalysis.quality} /></div>
                  </h3>
                  <p className="text-xs text-green-400/70 uppercase font-black tracking-[0.2em] mt-1">Move Insight</p>
                </div>
              </div>
              <div className="relative bg-black/30 p-6 rounded-2xl border border-white/10 backdrop-blur-sm">
                <p className="text-gray-200 leading-relaxed text-lg font-medium">
                  "{currentAnalysis.commentary}"
                </p>
              </div>
            </div>
          ) : (
            <div className="glass-card border-dashed border-2 border-gray-700 p-12 text-center">
              <Activity className="mx-auto mb-4 text-green-500/20" size={48} />
              <p className="uppercase tracking-[0.3em] font-black text-xs text-gray-500">Import a game to start analysis</p>
            </div>
          )}
        </div>

        <div className="lg:col-span-5 flex flex-col gap-6">
          <div className="glass-card-strong p-6">
            <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-green-400/70 mb-4 flex items-center gap-2">
              <Search size={14} /> Import Game
            </h3>
            <div className="relative">
              <textarea
                value={pgnInput}
                onChange={(e) => { setPgnInput(e.target.value); setAnalysis(null); }}
                placeholder="Paste PGN, raw moves, or FEN..."
                className="w-full h-28 bg-black/40 border border-white/10 rounded-2xl p-4 text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500 focus:outline-none resize-none font-mono text-gray-300 transition-all pl-12 placeholder-gray-600"
              />
              <FileText className="absolute top-4 left-4 text-gray-600" size={18} />
            </div>
            {error && (
              <div className="mt-4 p-4 bg-red-500/10 border border-red-500/30 rounded-xl flex items-center gap-3 text-red-400 text-sm backdrop-blur-sm">
                <AlertCircle size={18} />
                <span>{error}</span>
              </div>
            )}

            <button
              onClick={startAnalysis}
              disabled={isLoading || !pgnInput.trim()}
              className="w-full mt-5 btn-premium disabled:bg-gray-800 disabled:shadow-none text-white font-black py-4 rounded-2xl flex flex-col items-center justify-center gap-2 active:scale-[0.98]"
            >
              {isLoading ? (
                <div className="w-full space-y-3 px-8">
                  <div className="h-2 bg-black/30 rounded-full overflow-hidden">
                    <div className="h-full bg-white/90 transition-all duration-300 rounded-full" style={{ width: `${progress}%` }}></div>
                  </div>
                  <div className="flex items-center justify-center gap-2">
                    <Loader2 size={12} className="animate-spin" />
                    <span className="text-[10px] uppercase tracking-widest">
                      {`ANALYZING GAME... ${progress}%`}
                    </span>
                  </div>
                </div>
              ) : (
                <span className="tracking-[0.15em] text-sm uppercase">Launch Full Game Review</span>
              )}
            </button>
          </div>

          {analysis && (
            <div className="glass-card p-6 relative overflow-hidden group">
              <div className="absolute inset-0 bg-gradient-to-br from-yellow-500/5 to-orange-500/5"></div>
              <div className="absolute top-0 right-0 p-4">
                <Trophy className="text-yellow-500/30 group-hover:text-yellow-500/50 transition-colors" size={36} />
              </div>
              <h3 className="relative font-black text-[10px] uppercase tracking-[0.3em] text-yellow-400/70 mb-4">Game Performance</h3>
              <div className="relative flex gap-4 mb-6">
                <div className="flex-1 bg-white/5 p-5 rounded-2xl border border-white/10 text-center backdrop-blur-sm">
                  <span className="block text-[10px] text-gray-500 font-black mb-1 uppercase">WHITE</span>
                  <span className="text-3xl font-black text-white">{analysis.accuracyWhite}%</span>
                </div>
                <div className="flex-1 bg-white/5 p-5 rounded-2xl border border-white/10 text-center backdrop-blur-sm">
                  <span className="block text-[10px] text-gray-500 font-black mb-1 uppercase">BLACK</span>
                  <span className="text-3xl font-black text-white">{analysis.accuracyBlack}%</span>
                </div>
              </div>
              <p className="relative text-sm text-gray-400 leading-relaxed border-l-2 border-green-500 pl-4">
                {analysis.summary}
              </p>
            </div>
          )}

          <div className="flex-1 glass-card flex flex-col min-h-[350px] overflow-hidden">
            <div className="flex-1 overflow-y-auto p-2 custom-scrollbar">
              {Array.from({ length: Math.ceil(moveHistory.length / 2) }).map((_, pairIdx) => {
                const whiteIdx = pairIdx * 2;
                const blackIdx = pairIdx * 2 + 1;
                const whiteMove = moveHistory[whiteIdx];
                const blackMove = moveHistory[blackIdx];

                const getMoveColor = (quality: MoveQuality) => {
                  switch (quality) {
                    case MoveQuality.BRILLIANT: return 'bg-cyan-300/20 border-cyan-300/50';
                    case MoveQuality.GREAT: return 'bg-blue-500/20 border-blue-500/50';
                    case MoveQuality.BEST: return 'bg-green-500/20 border-green-500/50';
                    case MoveQuality.EXCELLENT: return 'bg-green-600/20 border-green-600/50';
                    case MoveQuality.GOOD: return 'bg-green-700/20 border-green-700/50';
                    case MoveQuality.INACCURACY: return 'bg-yellow-500/20 border-yellow-500/50';
                    case MoveQuality.MISTAKE: return 'bg-orange-500/20 border-orange-500/50';
                    case MoveQuality.BLUNDER: return 'bg-red-500/20 border-red-500/50';
                    default: return 'border-transparent';
                  }
                };

                return (
                  <div key={pairIdx} className="flex items-stretch gap-1 mb-1">
                    <div className="w-8 flex items-center justify-center text-xs text-gray-500 font-mono">
                      {pairIdx + 1}.
                    </div>

                    <div
                      onClick={() => { setIsPlaying(false); goToMove(whiteIdx); }}
                      className={`flex-1 flex items-center gap-2 px-3 py-2 rounded cursor-pointer transition-all border
                        ${currentMoveIndex === whiteIdx
                          ? 'bg-[#81b64c] text-white border-[#81b64c] font-bold'
                          : `hover:bg-gray-700/50 text-gray-200 ${getMoveColor(whiteMove?.quality)}`
                        }`}
                    >
                      <span className="font-mono text-sm">{whiteMove?.san}</span>
                      {whiteMove && <MoveBadge quality={whiteMove.quality} />}
                    </div>

                    {blackMove ? (
                      <div
                        onClick={() => { setIsPlaying(false); goToMove(blackIdx); }}
                        className={`flex-1 flex items-center gap-2 px-3 py-2 rounded cursor-pointer transition-all border
                          ${currentMoveIndex === blackIdx
                            ? 'bg-[#81b64c] text-white border-[#81b64c] font-bold'
                            : `hover:bg-gray-700/50 text-gray-200 ${getMoveColor(blackMove.quality)}`
                          }`}
                      >
                        <span className="font-mono text-sm">{blackMove.san}</span>
                        <MoveBadge quality={blackMove.quality} />
                      </div>
                    ) : (
                      <div className="flex-1" />
                    )}
                  </div>
                );
              })}
              {moveHistory.length === 0 && (
                <div className="h-full flex flex-col items-center justify-center text-gray-600 py-16">
                  <Activity size={48} strokeWidth={1} className="mb-4 opacity-20" />
                  <p className="text-xs text-gray-500">No moves loaded</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default App;
