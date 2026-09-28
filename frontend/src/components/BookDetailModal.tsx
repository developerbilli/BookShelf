'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Book } from '@/lib/api';
import { getBookProportions } from './BookSpine';
import { Star, BookOpen, X, ChevronLeft, ChevronRight, CheckCircle2, Bookmark } from 'lucide-react';

interface BookDetailModalProps {
  book: Book | null;
  onClose: () => void;
  onReadPdf: (book: Book) => void;
  onNextBook?: () => void;
  onPrevBook?: () => void;
  isShelved?: boolean;
  onToggleShelve?: (book: Book) => void;
}

export const BookDetailModal: React.FC<BookDetailModalProps> = ({
  book,
  onClose,
  onReadPdf,
  onNextBook,
  onPrevBook,
  isShelved = false,
  onToggleShelve,
}) => {
  const [spineAnimated, setSpineAnimated] = useState(false);

  useEffect(() => {
    setSpineAnimated(false);
    // Fallback timer to guarantee details reveal smoothly
    const timer = setTimeout(() => {
      setSpineAnimated(true);
    }, 380);
    return () => clearTimeout(timer);
  }, [book?.id]);

  if (!book) return null;

  const {
    title,
    author,
    genre,
    series,
    series_order,
    year,
    status = 'Finished',
    synopsis,
    rating = 4.7,
    has_pdf,
    cover_url,
  } = book;

  const { spine_color } = getBookProportions(book);

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 md:p-6 overflow-y-auto">
        {/* Backdrop Blur Overlay */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
          className="fixed inset-0 bg-black/65 backdrop-blur-md"
          onClick={onClose}
        />

        {/* Modal Window Container */}
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 10 }}
          transition={{ type: 'spring', stiffness: 300, damping: 28 }}
          className="relative w-full max-w-4xl bg-[#FAF8F5] rounded-3xl shadow-2xl border border-[#E5DEC9] overflow-hidden my-auto z-10"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Top Right Close Button - Fades in with details */}
          <motion.button
            initial={{ opacity: 0 }}
            animate={{ opacity: spineAnimated ? 1 : 0 }}
            transition={{ duration: 0.3 }}
            onClick={onClose}
            aria-label="Close modal"
            className="absolute top-5 right-5 z-30 w-10 h-10 rounded-full bg-[#1C1917]/10 hover:bg-[#1C1917] text-[#1C1917] hover:text-[#FAF8F5] flex items-center justify-center transition-all duration-200"
          >
            <X className="w-5 h-5" />
          </motion.button>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-8 p-6 md:p-10">
            {/* Left Column: 3D Hardcover Cover FIRST Animates from Shelf Location */}
            <div className="md:col-span-5 flex flex-col items-center justify-center">
              <motion.div
                layoutId={`book-spine-${book.id}`}
                onLayoutAnimationComplete={() => setSpineAnimated(true)}
                onClick={() => has_pdf && onReadPdf(book)}
                className={`relative w-48 md:w-56 h-72 md:h-84 rounded-r-md shadow-2xl flex flex-col justify-between overflow-hidden border-l-8 border-r border-t border-b border-black/20 group ${
                  has_pdf ? 'cursor-pointer' : ''
                }`}
                style={{
                  backgroundColor: spine_color,
                  transform: 'perspective(1000px) rotateY(-7deg) rotateX(2deg)',
                  boxShadow: '-14px 18px 36px rgba(0, 0, 0, 0.4), inset 0 1px 2px rgba(255, 255, 255, 0.3)',
                }}
                whileHover={{
                  scale: 1.04,
                  rotateY: -2,
                  transition: { duration: 0.25 },
                }}
              >
                {/* Real Book Cover Image */}
                {cover_url ? (
                  <div className="absolute inset-0 z-0 bg-cover bg-center" style={{ backgroundImage: `url(${cover_url})` }}>
                    <div className="absolute inset-0 bg-gradient-to-r from-black/50 via-transparent to-black/20 pointer-events-none" />
                  </div>
                ) : (
                  /* Embellished Fallback Cover */
                  <div className="w-full h-full p-6 flex flex-col justify-between relative z-0">
                    <div className="absolute inset-0 bg-gradient-to-r from-white/15 via-transparent to-black/30 pointer-events-none" />
                    <div className="z-10 text-center border-b border-amber-100/30 pb-3">
                      <span className="font-cinzel text-[10px] tracking-widest text-amber-200/80 uppercase">
                        Personal Archive
                      </span>
                    </div>

                    <div className="z-10 text-center my-auto px-2">
                      <h3 className="font-serif-display text-xl md:text-2xl font-bold text-amber-100 leading-tight mb-2 drop-shadow-md">
                        {title}
                      </h3>
                      <p className="font-serif-heading italic text-sm text-amber-200/90 font-medium">
                        {author}
                      </p>
                    </div>

                    <div className="z-10 text-center border-t border-amber-100/30 pt-3">
                      <span className="font-cinzel text-[9px] tracking-widest text-amber-200/70 uppercase">
                        {genre || 'Archive Volume'}
                      </span>
                    </div>
                  </div>
                )}

                {/* 3D Paper Edges Block on Right */}
                <div className="absolute right-0 top-1 bottom-1 w-4 bg-gradient-to-r from-[#E8E1D5] via-[#FAF8F5] to-[#C8BEAE] border-l border-black/15 shadow-inner rounded-r-xs z-10 pointer-events-none" />

                {/* Hover overlay to read PDF */}
                {has_pdf && (
                  <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex flex-col items-center justify-center text-white z-20 gap-2 backdrop-blur-xs">
                    <BookOpen className="w-9 h-9 text-amber-200 animate-pulse" />
                    <span className="font-cinzel text-xs tracking-widest uppercase font-semibold text-amber-100 text-center px-4">
                      Click to Read PDF
                    </span>
                  </div>
                )}
              </motion.div>

              {/* Rating Stars - Fades in after book cover finishes animating */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: spineAnimated ? 1 : 0, y: spineAnimated ? 0 : 10 }}
                transition={{ duration: 0.35, ease: 'easeOut' }}
                className="flex items-center gap-1 mt-6 text-[#C86D51]"
              >
                {[...Array(5)].map((_, i) => (
                  <Star
                    key={i}
                    className={`w-5 h-5 ${
                      i < Math.floor(rating)
                        ? 'fill-[#C86D51] text-[#C86D51]'
                        : 'text-[#D8CEBE]'
                    }`}
                  />
                ))}
                <span className="font-serif-heading font-bold text-base text-[#1C1917] ml-2">
                  {rating.toFixed(1)}
                </span>
              </motion.div>
            </div>

            {/* Right Column: Book Details & Description ONLY Displayed AFTER Book Cover Animation Completes */}
            <motion.div
              initial={{ opacity: 0, x: 25 }}
              animate={{
                opacity: spineAnimated ? 1 : 0,
                x: spineAnimated ? 0 : 25,
              }}
              transition={{ duration: 0.38, ease: 'easeOut' }}
              className="md:col-span-7 flex flex-col justify-between"
            >
              <div>
                {/* Status Badge & Genre */}
                <div className="flex flex-wrap items-center gap-2 mb-3">
                  <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-cinzel font-semibold tracking-wider bg-[#2D3A31] text-emerald-100 uppercase">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    {status}
                  </span>

                  {genre && (
                    <span className="px-3 py-1 rounded-full text-xs font-cinzel font-medium tracking-wider bg-[#E8E1D5] text-[#4A4238] uppercase">
                      {genre}
                    </span>
                  )}

                  {year && (
                    <span className="px-3 py-1 rounded-full text-xs font-cinzel text-[#78716C]">
                      {year}
                    </span>
                  )}
                </div>

                {/* Main Title */}
                <h2 className="font-serif-display text-3xl md:text-4xl font-normal text-[#1C1917] mb-2 leading-snug">
                  {title}
                </h2>

                {/* Author */}
                <p className="font-serif-heading italic text-xl text-[#C86D51] font-semibold mb-4">
                  by {author}
                </p>

                {/* Series Tag if present */}
                {series && (
                  <div className="mb-4 inline-block bg-[#FAF0E6] px-3 py-1 rounded-md border border-[#E5DEC9] text-xs font-cinzel text-[#78716C]">
                    Series: <span className="text-[#1C1917] font-semibold">{series}</span> {series_order ? `(#${series_order})` : ''}
                  </div>
                )}

                {/* Synopsis / Description */}
                <div className="my-4 border-t border-b border-[#E5DEC9] py-4">
                  <h4 className="font-cinzel text-xs tracking-widest text-[#9C8E7E] uppercase mb-2 font-semibold">
                    Synopsis & Archive Notes
                  </h4>
                  <p className="font-serif-heading text-lg leading-relaxed text-[#4A4238]">
                    {synopsis || 'An exquisite volume held in the personal library archive.'}
                  </p>
                </div>
              </div>

              {/* Action Buttons & Navigation */}
              <div className="pt-4 flex flex-col sm:flex-row items-center justify-between gap-4">
                {has_pdf ? (
                  <button
                    onClick={() => onReadPdf(book)}
                    className="w-full sm:w-auto px-6 py-3 rounded-full bg-[#C86D51] hover:bg-[#B05B41] text-[#FAF8F5] font-cinzel text-xs tracking-widest uppercase font-semibold flex items-center justify-center gap-2 transition-all duration-200 shadow-md hover:shadow-lg"
                  >
                    <BookOpen className="w-4 h-4" />
                    <span>Read Volume PDF</span>
                  </button>
                ) : (
                  <span className="text-xs font-cinzel text-[#9C8E7E] italic">
                    Volume logged in catalog
                  </span>
                )}

                {/* Next / Prev Navigation */}
                <div className="flex items-center gap-2">
                  {onPrevBook && (
                    <button
                      onClick={onPrevBook}
                      className="p-2 rounded-full border border-[#D8CEBE] bg-white text-[#1C1917] hover:bg-[#1C1917] hover:text-[#FAF8F5] transition-all"
                      title="Previous Book"
                    >
                      <ChevronLeft className="w-5 h-5" />
                    </button>
                  )}
                  {onNextBook && (
                    <button
                      onClick={onNextBook}
                      className="p-2 rounded-full border border-[#D8CEBE] bg-white text-[#1C1917] hover:bg-[#1C1917] hover:text-[#FAF8F5] transition-all"
                      title="Next Book"
                    >
                      <ChevronRight className="w-5 h-5" />
                    </button>
                  )}
                  <button
                    onClick={() => {
                      if (onToggleShelve && book) {
                        onToggleShelve(book);
                      }
                    }}
                    className={`px-5 py-2 rounded-full border font-cinzel text-xs tracking-wider uppercase transition-all duration-200 flex items-center gap-1.5 shadow-xs ${
                      isShelved
                        ? 'bg-emerald-100 hover:bg-emerald-200 text-emerald-900 border-emerald-300'
                        : 'bg-white hover:bg-[#E8E1D5] text-[#4A4238] border-[#D8CEBE]'
                    }`}
                  >
                    {isShelved ? (
                      <>
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Shelved on My List</span>
                      </>
                    ) : (
                      <>
                        <Bookmark className="w-3.5 h-3.5 text-[#C86D51]" />
                        <span>Shelve it</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
