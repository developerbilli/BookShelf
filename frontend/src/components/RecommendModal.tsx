'use client';

import React, { useState } from 'react';
import { submitRecommendation } from '@/lib/api';
import { X, Send, BookPlus, CheckCircle } from 'lucide-react';

interface RecommendModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const RecommendModal: React.FC<RecommendModalProps> = ({ isOpen, onClose }) => {
  const [title, setTitle] = useState('');
  const [author, setAuthor] = useState('');
  const [recommendedBy, setRecommendedBy] = useState('');
  const [note, setNote] = useState('');
  const [year, setYear] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !author.trim()) return;

    setIsSubmitting(true);
    try {
      await submitRecommendation({
        title: title.trim(),
        author: author.trim(),
        recommended_by: recommendedBy.trim() || 'Anonymous Reader',
        note: note.trim(),
        year: year ? parseInt(year, 10) : undefined,
      });
      setSubmitted(true);
      setTimeout(() => {
        setSubmitted(false);
        setTitle('');
        setAuthor('');
        setRecommendedBy('');
        setNote('');
        setYear('');
        onClose();
      }, 2000);
    } catch (err) {
      console.error(err);
      alert('Error submitting recommendation. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-200">
      <div
        className="relative w-full max-w-lg bg-[#FAF8F5] rounded-2xl shadow-2xl border border-[#E5DEC9] p-6 md:p-8 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-5 right-5 text-[#9C8E7E] hover:text-[#1C1917] transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {submitted ? (
          <div className="py-12 flex flex-col items-center text-center">
            <CheckCircle className="w-16 h-16 text-emerald-600 mb-4 animate-bounce" />
            <h3 className="font-serif-display text-2xl text-[#1C1917] mb-2 font-medium">
              Recommendation Sent!
            </h3>
            <p className="font-serif-heading text-lg text-[#78716C]">
              Thank you for contributing to Whimsicalwhiner&apos;s Library archive.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex items-center gap-2 mb-2">
              <BookPlus className="w-5 h-5 text-[#C86D51]" />
              <h2 className="font-serif-display text-2xl font-normal text-[#1C1917]">
                Recommend a Book
              </h2>
            </div>
            <p className="font-serif-heading italic text-[#78716C] mb-2 text-base">
              Add a beloved volume to the to-read archive shelf.
            </p>

            <div>
              <label className="block font-cinzel text-xs uppercase tracking-wider text-[#4A4238] mb-1 font-semibold">
                Book Title *
              </label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. The Night Circus"
                className="w-full px-4 py-2.5 rounded-lg bg-[#F4F0E8] border border-[#E5DEC9] text-[#1C1917] font-serif-heading text-lg focus:outline-none focus:ring-2 focus:ring-[#C86D51]/50"
              />
            </div>

            <div>
              <label className="block font-cinzel text-xs uppercase tracking-wider text-[#4A4238] mb-1 font-semibold">
                Author Name *
              </label>
              <input
                type="text"
                required
                value={author}
                onChange={(e) => setAuthor(e.target.value)}
                placeholder="e.g. Erin Morgenstern"
                className="w-full px-4 py-2.5 rounded-lg bg-[#F4F0E8] border border-[#E5DEC9] text-[#1C1917] font-serif-heading text-lg focus:outline-none focus:ring-2 focus:ring-[#C86D51]/50"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block font-cinzel text-xs uppercase tracking-wider text-[#4A4238] mb-1 font-semibold">
                  Your Name
                </label>
                <input
                  type="text"
                  value={recommendedBy}
                  onChange={(e) => setRecommendedBy(e.target.value)}
                  placeholder="e.g. Alex"
                  className="w-full px-4 py-2.5 rounded-lg bg-[#F4F0E8] border border-[#E5DEC9] text-[#1C1917] font-serif-heading text-base focus:outline-none focus:ring-2 focus:ring-[#C86D51]/50"
                />
              </div>

              <div>
                <label className="block font-cinzel text-xs uppercase tracking-wider text-[#4A4238] mb-1 font-semibold">
                  Published Year
                </label>
                <input
                  type="number"
                  value={year}
                  onChange={(e) => setYear(e.target.value)}
                  placeholder="e.g. 2021"
                  className="w-full px-4 py-2.5 rounded-lg bg-[#F4F0E8] border border-[#E5DEC9] text-[#1C1917] font-serif-heading text-base focus:outline-none focus:ring-2 focus:ring-[#C86D51]/50"
                />
              </div>
            </div>

            <div>
              <label className="block font-cinzel text-xs uppercase tracking-wider text-[#4A4238] mb-1 font-semibold">
                Why should I read it?
              </label>
              <textarea
                rows={3}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Share what makes this volume special..."
                className="w-full px-4 py-2.5 rounded-lg bg-[#F4F0E8] border border-[#E5DEC9] text-[#1C1917] font-serif-heading text-base focus:outline-none focus:ring-2 focus:ring-[#C86D51]/50 resize-none"
              />
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="mt-2 w-full py-3.5 rounded-full bg-[#1C1917] hover:bg-[#C86D51] text-[#FAF8F5] font-cinzel text-xs uppercase tracking-widest font-semibold flex items-center justify-center gap-2 transition-all duration-300 shadow-md"
            >
              {isSubmitting ? (
                <span>Submitting...</span>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  <span>Send Recommendation</span>
                </>
              )}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
