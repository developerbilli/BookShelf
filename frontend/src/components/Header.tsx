'use client';

import React, { useState } from 'react';
import { Search, Plus, ChevronDown, X, Tag, Sparkles } from 'lucide-react';

interface HeaderProps {
  totalVolumes: number;
  filteredCount: number;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  selectedCategory: string;
  onCategorySelect: (cat: string) => void;
  categories: Record<string, number>;
  onOpenRecommend: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  totalVolumes,
  filteredCount,
  searchQuery,
  onSearchChange,
  selectedCategory,
  onCategorySelect,
  categories,
  onOpenRecommend,
}) => {
  const [isGenreModalOpen, setIsGenreModalOpen] = useState(false);
  const [genreSearch, setGenreSearch] = useState('');

  const featuredCategories = [
    'ALL',
    'FANTASY',
    'ROMANCE',
    'SCI-FI',
    'MYSTERY & THRILLER',
    'FICTION',
    'NONFICTION',
    'HISTORICAL',
    'YOUNG ADULT',
  ];

  // Extract all 451+ genre names from categories object
  const allGenreKeys = Object.keys(categories).filter((k) => k !== 'ALL');
  const totalGenreCount = allGenreKeys.length || 451;

  const filteredGenresList = allGenreKeys.filter((g) =>
    g.toLowerCase().includes(genreSearch.toLowerCase())
  );

  return (
    <header className="w-full pt-8 pb-4 px-4 md:px-8 max-w-6xl mx-auto flex flex-col items-center text-center">
      {/* Top Subtitle */}
      <span className="font-cinzel text-[10px] md:text-xs tracking-[0.3em] uppercase text-[#8C8275] mb-1.5 font-medium">
        A Personal Archive
      </span>

      {/* Main Typewriter Heading */}
      <h1 className="font-serif-display text-3xl md:text-5xl lg:text-6xl font-light tracking-tight text-[#1C1917] mb-2 flex items-center justify-center">
        <span>Welcome to my library</span>
        <span className="typewriter-cursor" />
      </h1>

      {/* Volumes Counter Badge */}
      <div className="flex items-center gap-2 mb-4">
        <span className="font-cinzel text-[10px] md:text-xs tracking-widest text-[#9C8E7E] uppercase font-semibold">
          {searchQuery || selectedCategory !== 'ALL'
            ? `${filteredCount} MATCHING VOLUMES`
            : `${totalVolumes} VOLUMES`}
        </span>
      </div>

      {/* Recommend A Book CTA Button */}
      <button
        onClick={onOpenRecommend}
        className="group relative inline-flex items-center gap-2 px-5 py-2 rounded-full border border-[#D8CEBE] bg-[#FAF8F5]/80 hover:bg-[#1C1917] hover:text-[#FAF8F5] transition-all duration-300 shadow-xs hover:shadow-md text-[11px] md:text-xs tracking-widest font-cinzel font-medium uppercase mb-6 text-[#4A4238]"
      >
        <Plus className="w-3.5 h-3.5 transition-transform group-hover:rotate-90 duration-300" />
        <span>Recommend a Book</span>
      </button>

      {/* Search Input Box */}
      <div className="w-full max-w-md relative mb-5">
        <div className="relative flex items-center">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="What are you looking for?"
            className="w-full py-2.5 pl-4 pr-10 rounded-full bg-[#FAF8F5] border border-[#E5DEC9] text-[#1C1917] placeholder:text-[#9C8E7E] placeholder:font-serif-heading placeholder:italic placeholder:text-base text-center font-serif-heading text-lg focus:outline-none focus:ring-2 focus:ring-[#C86D51]/50 focus:border-[#C86D51] transition-all duration-200 shadow-inner"
          />
          {searchQuery ? (
            <button
              onClick={() => onSearchChange('')}
              className="absolute right-3.5 text-[#9C8E7E] hover:text-[#1C1917] text-xs"
            >
              ✕
            </button>
          ) : (
            <Search className="absolute right-4 w-4 h-4 text-[#9C8E7E] pointer-events-none" />
          )}
        </div>
      </div>

      {/* Featured Quick Category Pills + All 451 Genres Picker */}
      <div className="flex flex-wrap justify-center items-center gap-1.5 max-w-4xl mx-auto">
        {featuredCategories.map((cat) => {
          const isSelected = selectedCategory.toUpperCase() === cat;
          return (
            <button
              key={cat}
              onClick={() => onCategorySelect(cat)}
              className={`px-3 py-1 rounded-full text-[10px] font-cinzel tracking-widest uppercase transition-all duration-200 ${
                isSelected
                  ? 'bg-[#1C1917] text-[#FAF8F5] shadow-sm font-semibold'
                  : 'bg-[#FAF8F5]/60 text-[#78716C] border border-[#E5DEC9] hover:bg-[#FAF8F5] hover:text-[#1C1917]'
              }`}
            >
              {cat}
            </button>
          );
        })}

        {/* All 451 Genres Picker Trigger Button */}
        <button
          onClick={() => setIsGenreModalOpen(true)}
          className={`px-3.5 py-1 rounded-full text-[10px] font-cinzel tracking-widest uppercase flex items-center gap-1.5 transition-all duration-200 ${
            !featuredCategories.includes(selectedCategory.toUpperCase()) && selectedCategory !== 'ALL'
              ? 'bg-[#C86D51] text-white font-semibold shadow-sm'
              : 'bg-[#EFEAE1] text-[#C86D51] border border-[#C86D51]/30 hover:bg-[#C86D51] hover:text-white'
          }`}
        >
          <Tag className="w-3 h-3" />
          <span>
            {selectedCategory !== 'ALL' && !featuredCategories.includes(selectedCategory.toUpperCase())
              ? `Genre: ${selectedCategory}`
              : `All ${totalGenreCount} Genres ▾`}
          </span>
        </button>
      </div>

      {/* All 451 Genres Searchable Modal Overlay */}
      {isGenreModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-200"
          onClick={() => setIsGenreModalOpen(false)}
        >
          <div
            className="relative w-full max-w-3xl max-h-[85vh] bg-[#FAF8F5] rounded-3xl shadow-2xl border border-[#E5DEC9] overflow-hidden flex flex-col p-6 text-left"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Top Header */}
            <div className="flex items-center justify-between pb-4 border-b border-[#E5DEC9]">
              <div>
                <h3 className="font-serif-display text-2xl font-normal text-[#1C1917]">
                  Browse All {totalGenreCount} Archive Genres
                </h3>
                <p className="font-cinzel text-[10px] text-[#78716C] uppercase tracking-wider mt-0.5">
                  Select any category to filter the library catalog
                </p>
              </div>
              <button
                onClick={() => setIsGenreModalOpen(false)}
                className="p-2 rounded-full hover:bg-black/5 text-[#1C1917]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Search Input for 451 Genres */}
            <div className="my-4 relative">
              <input
                type="text"
                value={genreSearch}
                onChange={(e) => setGenreSearch(e.target.value)}
                placeholder={`Search across ${totalGenreCount} genres...`}
                className="w-full py-2.5 pl-4 pr-10 rounded-xl bg-white border border-[#D8CEBE] text-sm font-serif-heading text-[#1C1917] placeholder:text-[#9C8E7E] placeholder:italic focus:outline-none focus:ring-2 focus:ring-[#C86D51]/50"
              />
              <Search className="absolute right-3.5 top-3 w-4 h-4 text-[#9C8E7E]" />
            </div>

            {/* All Genres Grid List */}
            <div className="flex-1 overflow-y-auto pr-2 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 shelf-scrollbar">
              <button
                onClick={() => {
                  onCategorySelect('ALL');
                  setIsGenreModalOpen(false);
                }}
                className={`p-2.5 rounded-xl border text-left flex items-center justify-between transition-all ${
                  selectedCategory === 'ALL'
                    ? 'bg-[#1C1917] text-white border-[#1C1917] font-semibold'
                    : 'bg-white text-[#1C1917] border-[#E5DEC9] hover:border-[#C86D51]'
                }`}
              >
                <span className="font-cinzel text-xs uppercase truncate">ALL VOLUMES</span>
                <span className="text-[10px] opacity-70 font-cinzel">{totalVolumes}</span>
              </button>

              {filteredGenresList.map((gName) => {
                const count = categories[gName] || 0;
                const isSelected = selectedCategory.toLowerCase() === gName.toLowerCase();

                return (
                  <button
                    key={gName}
                    onClick={() => {
                      onCategorySelect(gName);
                      setIsGenreModalOpen(false);
                    }}
                    className={`p-2.5 rounded-xl border text-left flex items-center justify-between transition-all ${
                      isSelected
                        ? 'bg-[#C86D51] text-white border-[#C86D51] font-semibold'
                        : 'bg-white text-[#1C1917] border-[#E5DEC9] hover:border-[#C86D51] hover:bg-[#FAF6EE]'
                    }`}
                  >
                    <span className="font-serif-heading text-xs truncate max-w-[120px]">{gName}</span>
                    {count > 0 && (
                      <span className="text-[10px] font-cinzel opacity-75 px-1.5 py-0.5 rounded bg-black/5">
                        {count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Modal Bottom Bar */}
            <div className="pt-4 border-t border-[#E5DEC9] mt-4 flex items-center justify-between text-xs font-cinzel text-[#78716C]">
              <span>Showing {filteredGenresList.length} of {totalGenreCount} genres</span>
              <button
                onClick={() => setIsGenreModalOpen(false)}
                className="px-5 py-1.5 rounded-full border border-[#D8CEBE] bg-white hover:bg-[#1C1917] hover:text-white uppercase tracking-wider text-[10px] font-semibold transition-all"
              >
                Close Picker
              </button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
};
