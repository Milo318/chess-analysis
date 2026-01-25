
export interface EvaluationResult {
  score: number;
  bestMove: string;
  secondBestScore?: number;
}

interface ScoreEntry {
  move: string;
  score: number;
  depth: number;
  multipv: number;
}

export class StockfishEngine {
  private worker: Worker | null = null;

  constructor() {
    this.init();
  }

  private init() {
    if (typeof Worker !== 'undefined') {
      this.worker = new Worker('/stockfish.js');
      this.worker.postMessage('uci');
      // Set MultiPV to 2 to get second best move info
      this.worker.postMessage('setoption name MultiPV value 2');
      this.worker.postMessage('isready');
    }
  }

  public terminate() {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
  }

  public async evaluate(fen: string, depth: number = 12): Promise<EvaluationResult> {
    return new Promise((resolve, reject) => {
      if (!this.worker) {
        reject(new Error("Stockfish worker not initialized"));
        return;
      }

      const entries: ScoreEntry[] = [];
      let bestMove = '';

      const handler = (e: MessageEvent) => {
        const line = e.data;

        if (line.startsWith('bestmove')) {
            const parts = line.split(' ');
            bestMove = parts[1];

            this.worker?.removeEventListener('message', handler);

            const maxDepth = Math.max(...entries.map(e => e.depth), 0);
            const finalEntries = entries.filter(e => e.depth === maxDepth);

            const bestEntry = finalEntries.find(e => e.multipv === 1) || finalEntries[0];
            const secondEntry = finalEntries.find(e => e.multipv === 2);

            resolve({
                 score: bestEntry ? bestEntry.score : 0,
                 bestMove: bestMove,
                 secondBestScore: secondEntry ? secondEntry.score : undefined
             });
        }

        if (line.startsWith('info') && line.includes('score') && line.includes('pv')) {
             const depthMatch = line.match(/depth (\d+)/);
             const scoreMatch = line.match(/score cp (-?\d+)/);
             const mateMatch = line.match(/score mate (-?\d+)/);
             const multipvMatch = line.match(/multipv (\d+)/);

             if (depthMatch && (scoreMatch || mateMatch)) {
                 const currentDepth = parseInt(depthMatch[1]);
                 const multipv = multipvMatch ? parseInt(multipvMatch[1]) : 1;
                 let score = 0;

                 if (mateMatch) {
                     const mateIn = parseInt(mateMatch[1]);
                     // Convert mate to high score (max 10000)
                     score = mateIn > 0 ? 10000 - mateIn : -10000 - mateIn;
                 } else if (scoreMatch) {
                     score = parseInt(scoreMatch[1]);
                 }

                 entries.push({ move: '', score, depth: currentDepth, multipv });
             }
        }
      };

      this.worker.addEventListener('message', handler);

      this.worker.postMessage(`position fen ${fen}`);
      this.worker.postMessage(`go depth ${depth}`);
    });
  }
}
