'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Book } from '@/lib/api';

interface BookSpineProps {
  book: Book;
  onSelect: (book: Book) => void;
}

export function getBookProportions(book: Book) {
  const id = book.id || 1;
  const heights = [175, 190, 205, 220, 235, 180, 195, 215, 230];
  const spine_height = heights[id % heights.length];

  const widths = [18, 26, 34, 42, 22, 30, 38, 46, 20, 28, 36, 44];
  const spine_width = widths[(id * 7) % widths.length];

  const colors = [
    '#8C3A27', '#1E3A2B', '#2B3A4A', '#5C2D3B',
    '#7A5C28', '#2D2D2D', '#6B3A29', '#3D2A45',
    '#1F4E47', '#8B4513', '#4A2E2B', '#2A363B'
  ];
  const spine_color = book.spine_color && book.spine_color !== '#8C3A27'
    ? book.spine_color
    : colors[id % colors.length];

  return { spine_height, spine_width, spine_color };
}

const BookSpineComponent: React.FC<BookSpineProps> = ({ book, onSelect }) => {
  const { title, author, genre, year, has_pdf, cover_url } = book;
  const { spine_height, spine_width, spine_color } = getBookProportions(book);

  return (
    <motion.div
      layoutId={`book-spine-${book.id}`}
      onClick={() => onSelect(book)}
      className="group relative flex-shrink-0 cursor-pointer select-none z-10 hover:z-50"
      style={{
        width: `${spine_width}px`,
        height: `${spine_height}px`,
      }}
      whileHover={{
        y: -14,
        scale: 1.04,
        transition: { type: 'spring', stiffness: 400, damping: 25 },
      }}
      whileTap={{ scale: 0.98 }}
    >
      {/* 3D Round Cylinder Book Spine */}
      <div
        className="w-full h-full relative rounded-xs border-t border-b border-black/30 overflow-hidden flex flex-col justify-between items-center py-2 px-0.5 shadow-md group-hover:shadow-2xl transition-shadow duration-300"
        style={{
          backgroundColor: spine_color,
          boxShadow: `
            inset 0 3px 4px rgba(255, 255, 255, 0.35),
            inset 0 -3px 4px rgba(0, 0, 0, 0.3),
            0 6px 16px rgba(0, 0, 0, 0.25)
          `,
        }}
      >
        {/* Real Book Cover Image if available */}
        {cover_url ? (
          <img
            src={cover_url}
            alt={title}
            className="absolute inset-0 w-full h-full object-cover z-0 transition-transform duration-300 group-hover:scale-105"
            loading="lazy"
          />
        ) : null}

        {/* 3D Multi-Stop Specular Cylinder Highlight & Side Shadows */}
        <div
          className="absolute inset-0 pointer-events-none z-0"
          style={{
            background: `linear-gradient(
              90deg,
              rgba(0, 0, 0, 0.55) 0%,
              rgba(255, 255, 255, 0.25) 5%,
              rgba(255, 255, 255, 0) 18%,
              rgba(0, 0, 0, 0) 82%,
              rgba(0, 0, 0, 0.45) 100%
            )`,
          }}
        />

        {/* Top Gold Embossed Foil Band */}
        <div className="w-full h-[2px] bg-gradient-to-r from-amber-400/30 via-amber-200/80 to-amber-500/30 mb-1 flex-shrink-0 z-10" />

        {/* Vertical Title & Author (Only rendered for volumes WITHOUT cover artwork) */}
        {!cover_url ? (
          <div className="flex-1 flex flex-col items-center justify-center overflow-hidden w-full px-0.5 z-10">
            <div className="writing-mode-vertical text-amber-50 font-serif-heading font-semibold text-[10px] md:text-xs tracking-wider uppercase truncate max-h-[125px] text-center drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)]">
              {title}
            </div>

            <div className="writing-mode-vertical text-amber-200/90 font-cinzel text-[8px] md:text-[9px] tracking-widest uppercase truncate mt-1.5 max-h-[50px] text-center font-medium drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">
              {author}
            </div>
          </div>
        ) : (
          <div className="flex-1" />
        )}

        {/* Bottom Gold Foil Band & Indicator */}
        <div className="flex flex-col items-center gap-1 mt-1 flex-shrink-0 w-full z-10">
          {has_pdf && (
            <div className="w-1.5 h-1.5 rounded-full bg-amber-300 shadow-xs ring-1 ring-amber-400/50" title="PDF Available" />
          )}
          <div className="w-full h-[2px] bg-gradient-to-r from-amber-400/30 via-amber-200/80 to-amber-500/30" />
        </div>
      </div>

      {/* Floating Hover Tooltip Card matching carollia-library.lovable.app */}
      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:flex flex-col items-center pointer-events-none z-50 w-max min-w-[180px] max-w-[250px] bg-[#FAF8F5] text-[#1C1917] px-3.5 py-2.5 rounded-xl shadow-2xl border border-[#E5DEC9] backdrop-blur-md animate-in fade-in zoom-in-95 duration-150 text-center">
        <h4 className="font-serif-display text-xs md:text-sm font-semibold text-[#1C1917] leading-tight mb-0.5 line-clamp-2 max-w-full">
          {title}
        </h4>
        <p className="font-cinzel text-[9px] tracking-[0.2em] uppercase text-[#C86D51] font-bold truncate max-w-full">
          {author}
        </p>
        <p className="font-cinzel text-[10px] text-[#78716C] mt-0.5">
          {year || 2023} · {has_pdf ? 'PDF Volume' : 'Hardcover Catalog'}
        </p>
        {genre && (() => {
          const genreParts = genre.split(',').map((g) => g.trim()).filter(Boolean);
          const mainGenres = genreParts.slice(0, 3).join(' · ');
          const extraCount = genreParts.length - 3;
          return (
            <span className="mt-1 px-2.5 py-0.5 rounded-full bg-[#EFECE6] text-[8.5px] font-cinzel text-[#4A4238] uppercase font-medium line-clamp-1 max-w-full">
              {mainGenres}{extraCount > 0 ? ` (+${extraCount})` : ''}
            </span>
          );
        })()}
        <div className="absolute top-full left-1/2 -translate-x-1/2 border-[6px] border-transparent border-t-[#FAF8F5]" />
      </div>
    </motion.div>
  );
};

export const BookSpine = React.memo(BookSpineComponent, (prev, next) => prev.book.id === next.book.id);
