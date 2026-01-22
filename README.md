# GM Analysis Pro

Professional chess game analysis powered by Stockfish. Get Chess.com-style accuracy ratings, move quality badges, and detailed game reviews.

![GM Analysis Pro](https://img.shields.io/badge/version-1.0.0-green) ![Stockfish](https://img.shields.io/badge/engine-Stockfish%2010-blue)

## Features

- 📊 **Chess.com-Style Accuracy** – Win percentage based accuracy calculation
- 🏆 **Move Quality Badges** – Brilliant, Great, Best, Excellent, Good, Inaccuracy, Mistake, Blunder
- ♟️ **PGN Import** – Paste any PGN, raw moves, or FEN position
- 🔍 **Move-by-Move Review** – Navigate through games with keyboard or buttons
- 📝 **Auto-Generated Commentary** – Context-aware explanations for each move
- 📈 **Game Summary** – Overall performance statistics

## Run Locally

**Prerequisites:** Node.js 18+

```bash
# Install dependencies
npm install

# Start development server
npm run dev
```

## Production Build

```bash
# Build for production
npm run build

# Preview production build
npm run preview
```

## Deploy

This app is optimized for static hosting:

- **Vercel**: Connect repo → Auto-deploys
- **Netlify**: Connect repo → Build command: `npm run build` → Publish: `dist`
- **GitHub Pages**: Use `gh-pages` branch with `dist` folder

## Tech Stack

- React 19 + TypeScript
- Vite
- Tailwind CSS
- chess.js
- react-chessboard
- Stockfish.js (Web Worker)

## License

MIT
