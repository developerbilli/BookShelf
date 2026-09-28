'use client';

import React, { useRef } from 'react';
import { Book } from '@/lib/api';
import { BookSpine } from './BookSpine';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface BookshelfProps {
  books: Book[];
  onSelectBook: (book: Book) => void;
}

export const Bookshelf: React.FC<BookshelfProps> = ({ books, onSelectBook }) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  const scrollLeft = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollBy({ left: -450, behavior: 'smooth' });
    }
  };

  const scrollRight = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollBy({ left: 450, behavior: 'smooth' });
    }
  };

  if (books.length === 0) {
    return (
      <div className="w-full py-16 flex flex-col items-center justify-center text-[#78716C]">
        <p className="font-serif-heading italic text-xl mb-1">No volumes found matching your query.</p>
        <p className="font-cinzel text-[10px] uppercase tracking-widest text-[#9C8E7E]">Try adjusting your search terms or category filters.</p>
      </div>
    );
  }

  return (
    <div className="w-full relative py-2 px-2 md:px-8 max-w-full">
      {/* Scroll Left Button */}
      <button
        onClick={scrollLeft}
        aria-label="Scroll Left"
        className="absolute left-2 md:left-6 top-1/2 -translate-y-1/2 z-40 w-10 h-10 rounded-full bg-[#1C1917]/80 text-[#FAF8F5] flex items-center justify-center shadow-lg hover:bg-[#C86D51] transition-all duration-300 backdrop-blur-sm border border-amber-900/30 group"
      >
        <ChevronLeft className="w-5 h-5 transition-transform group-hover:-translate-x-0.5" />
      </button>

      {/* Scroll Right Button */}
      <button
        onClick={scrollRight}
        aria-label="Scroll Right"
        className="absolute right-2 md:right-6 top-1/2 -translate-y-1/2 z-40 w-10 h-10 rounded-full bg-[#1C1917]/80 text-[#FAF8F5] flex items-center justify-center shadow-lg hover:bg-[#C86D51] transition-all duration-300 backdrop-blur-sm border border-amber-900/30 group"
      >
        <ChevronRight className="w-5 h-5 transition-transform group-hover:translate-x-0.5" />
      </button>

      {/* Horizontally Scrolling Books Container with pt-44 md:pt-48 top padding so hover tooltips are completely visible and never cut off */}
      <div
        ref={scrollRef}
        className="flex items-end gap-1 md:gap-1.5 overflow-x-auto pb-4 pt-44 md:pt-48 px-12 shelf-scrollbar scroll-smooth min-h-[350px]"
      >
        {books.map((book) => (
          <BookSpine key={book.id} book={book} onSelect={onSelectBook} />
        ))}
      </div>

      {/* Photorealistic Wooden Shelf Base */}
      <div className="w-full max-w-full mx-auto relative mt-[-8px] z-20 pointer-events-none">
        <div className="h-3.5 w-full shelf-wood-surface rounded-sm" />
        <div className="h-4 w-full shelf-wood-edge rounded-b-md" />
      </div>
    </div>
  );
};
