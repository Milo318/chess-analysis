
import React from 'react';
import { MoveQuality } from '../gameTypes';

interface MoveBadgeProps {
  quality: MoveQuality;
}

const MoveBadge: React.FC<MoveBadgeProps> = ({ quality }) => {
  const getBadgeStyle = (q: MoveQuality) => {
    switch (q) {
      case MoveQuality.BRILLIANT: return 'badge-brilliant text-white';
      case MoveQuality.GREAT: return 'badge-great text-white';
      case MoveQuality.BEST: return 'badge-best text-white';
      case MoveQuality.EXCELLENT: return 'badge-best text-white opacity-80';
      case MoveQuality.GOOD: return 'bg-green-700 text-gray-200';
      case MoveQuality.INACCURACY: return 'badge-inaccuracy text-black';
      case MoveQuality.MISTAKE: return 'badge-mistake text-white';
      case MoveQuality.BLUNDER: return 'badge-blunder text-white';
      case MoveQuality.BOOK: return 'bg-yellow-800 text-white';
      default: return 'bg-gray-700 text-gray-400';
    }
  };

  const getLabel = (q: MoveQuality) => {
      switch(q) {
          case MoveQuality.BRILLIANT: return '!!';
          case MoveQuality.GREAT: return '!';
          case MoveQuality.BEST: return '★';
          case MoveQuality.EXCELLENT: return '✓';
          case MoveQuality.GOOD: return 'good';
          case MoveQuality.INACCURACY: return '?!';
          case MoveQuality.MISTAKE: return '?';
          case MoveQuality.BLUNDER: return '??';
          case MoveQuality.BOOK: return 'book';
          default: return '';
      }
  };

  if (quality === MoveQuality.NONE) return null;

  return (
    <span className={`inline-flex items-center justify-center px-2 py-0.5 rounded text-[10px] font-bold tracking-wider uppercase shadow-sm ${getBadgeStyle(quality)}`}>
      {getLabel(quality) || quality}
    </span>
  );
};

export default MoveBadge;
