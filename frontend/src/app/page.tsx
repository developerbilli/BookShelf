'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { AnimatePresence } from 'framer-motion';
import { Book, fetchBooks, fetchCategories, fetchBookDetail } from '@/lib/api';
import { Header } from '@/components/Header';
import { Bookshelf } from '@/components/Bookshelf';
import { BookDetailModal } from '@/components/BookDetailModal';
import { PdfReaderModal } from '@/components/PdfReaderModal';
import { RecommendModal } from '@/components/RecommendModal';
import { Loader2, Bookmark, BookOpen } from 'lucide-react';

function loadShelvedBooks(): Book[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem('lib_shelved_books');
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveShelvedBooks(books: Book[]) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem('lib_shelved_books', JSON.stringify(books));
  } catch (err) {
    console.error(err);
  }
}

export default function Home() {
  const [books, setBooks] = useState<Book[]>([]);
  const [shelvedBooks, setShelvedBooks] = useState<Book[]>([]);
  const [categories, setCategories] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);
  const [isDeepLink, setIsDeepLink] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('ALL');

  const [selectedBook, setSelectedBook] = useState<Book | null>(null);
  const [pdfBook, setPdfBook] = useState<Book | null>(null);
  const [pdfInitialPage, setPdfInitialPage] = useState<number>(1);
  const [isRecommendOpen, setIsRecommendOpen] = useState(false);

  // Mount effect to sync client state & URL query params cleanly without hydration error
  useEffect(() => {
    setMounted(true);
    setShelvedBooks(loadShelvedBooks());

    const urlParams = new URLSearchParams(window.location.search);
    const bookIdParam = urlParams.get('book');
    const isReadParam = urlParams.get('read') === 'true';
    const pageParam = parseInt(urlParams.get('page') || '1', 10);

    if (bookIdParam) {
      setIsDeepLink(true);
      const bookId = parseInt(bookIdParam, 10);

      fetchBookDetail(bookId)
        .then((b) => {
          if (isReadParam) {
            setPdfBook(b);
            setPdfInitialPage(pageParam);
          } else {
            setSelectedBook(b);
          }
        })
        .catch((err) => console.error('Error fetching direct book:', err))
        .finally(() => {
          setIsDeepLink(false);
        });
    }

    // Fetch initial categories on mount
    async function loadCategories() {
      try {
        const catData = await fetchCategories();
        setCategories(catData);
      } catch (err) {
        console.error('Error loading categories:', err);
      }
    }

    loadCategories();
  }, []);

  // Fetch books dynamically from backend PostgreSQL database whenever searchQuery or selectedCategory changes
  useEffect(() => {
    let isSubscribed = true;

    const timer = setTimeout(async () => {
      try {
        setLoading(true);
        const booksData = await fetchBooks(searchQuery, selectedCategory);
        if (isSubscribed) {
          setBooks(booksData);
        }
      } catch (err) {
        console.error('Error fetching searched books:', err);
      } finally {
        if (isSubscribed) {
          setLoading(false);
        }
      }
    }, searchQuery ? 250 : 0);

    return () => {
      isSubscribed = false;
      clearTimeout(timer);
    };
  }, [searchQuery, selectedCategory]);

  // Use fetched books directly (backend handles full SQL filtering across all 36,740 books)
  const filteredBooks = books;

  // Sync URL query params for Refresh Persistence & Deep Linking
  const updateUrlParams = (bookId?: number, isRead?: boolean, page?: number) => {
    if (typeof window === 'undefined') return;
    const url = new URL(window.location.href);

    if (bookId) {
      url.searchParams.set('book', bookId.toString());
      if (isRead) {
        url.searchParams.set('read', 'true');
        if (page) {
          url.searchParams.set('page', page.toString());
        }
      } else {
        url.searchParams.delete('read');
        url.searchParams.delete('page');
      }
    } else {
      url.searchParams.delete('book');
      url.searchParams.delete('read');
      url.searchParams.delete('page');
    }

    window.history.replaceState({}, '', url.toString());
  };

  // Handlers for selection
  const handleSelectBook = (book: Book) => {
    setSelectedBook(book);
    setPdfBook(null);
    updateUrlParams(book.id, false);
  };

  const handleCloseDetailModal = () => {
    setSelectedBook(null);
    updateUrlParams();
  };

  const handleOpenPdfReader = (book: Book, initialP: number = 1) => {
    setSelectedBook(null);
    setPdfBook(book);
    setPdfInitialPage(initialP);
    updateUrlParams(book.id, true, initialP);
  };

  const handleClosePdfReader = () => {
    setPdfBook(null);
    updateUrlParams();
  };

  const handlePdfPageChange = (pageNum: number) => {
    if (pdfBook) {
      updateUrlParams(pdfBook.id, true, pageNum);
    }
  };

  // Toggle shelving a book to user's personal reading list ("Shelf Down")
  const handleToggleShelve = (bookToToggle: Book) => {
    setShelvedBooks((prev) => {
      const exists = prev.some((b) => b.id === bookToToggle.id);
      let updated: Book[];
      if (exists) {
        updated = prev.filter((b) => b.id !== bookToToggle.id);
      } else {
        updated = [bookToToggle, ...prev];
      }
      saveShelvedBooks(updated);
      return updated;
    });
  };

  const handleClearReadingList = () => {
    setShelvedBooks([]);
    saveShelvedBooks([]);
  };

  // Navigate to Next/Prev volume in detail modal
  const selectedIndex = selectedBook
    ? filteredBooks.findIndex((b) => b.id === selectedBook.id)
    : -1;

  const handleNextBook = () => {
    if (selectedIndex >= 0 && selectedIndex < filteredBooks.length - 1) {
      handleSelectBook(filteredBooks[selectedIndex + 1]);
    }
  };

  const handlePrevBook = () => {
    if (selectedIndex > 0) {
      handleSelectBook(filteredBooks[selectedIndex - 1]);
    }
  };

  // Prevent landing page from showing when direct URL parameter is present for PDF Reader
  const isDirectReaderLink = (mounted && (isDeepLink || pdfBook !== null));

  return (
    <main className="min-h-screen flex flex-col justify-between relative bg-[#F4F0E8] overflow-x-hidden selection:bg-[#C86D51] selection:text-white">
      {/* Ambient lighting */}
      <div className="fixed inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-amber-100/40 via-transparent to-transparent pointer-events-none z-0" />

      {/* Deep Link Opening Reader Loader (Shown when loading a direct URL volume link) */}
      {isDeepLink && pdfBook === null && selectedBook === null && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#F4F0E8] text-[#78716C] gap-3">
          <Loader2 className="w-10 h-10 animate-spin text-[#C86D51]" />
          <span className="font-cinzel text-xs tracking-widest uppercase font-medium">
            Opening Archive Volume...
          </span>
        </div>
      )}

      {/* Main Landing View */}
      <div className={`relative z-10 flex-1 flex flex-col justify-between transition-opacity duration-300 ${
        isDirectReaderLink ? 'opacity-0 pointer-events-none hidden' : 'opacity-100'
      }`}>
        {/* Header Component */}
        <Header
          totalVolumes={books.length}
          filteredCount={filteredBooks.length}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          selectedCategory={selectedCategory}
          onCategorySelect={setSelectedCategory}
          categories={categories}
          onOpenRecommend={() => setIsRecommendOpen(true)}
        />

        {/* Main Bookshelf Section */}
        {loading ? (
          <div className="w-full py-24 flex flex-col items-center justify-center gap-3 text-[#8C8275]">
            <Loader2 className="w-8 h-8 animate-spin text-[#C86D51]" />
            <span className="font-cinzel text-xs tracking-widest uppercase font-medium">
              Retrieving Archives...
            </span>
          </div>
        ) : (
          <div className="w-full my-auto">
            <Bookshelf
              books={filteredBooks}
              onSelectBook={handleSelectBook}
            />
          </div>
        )}

        {/* Lower Personal Reading List Shelf ("Shelf Down") */}
        <div className="w-full max-w-7xl mx-auto px-4 md:px-8 mt-16 mb-8 z-10 relative">
          <div className="flex items-center justify-between border-b border-[#E5DEC9] pb-3 mb-6">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-[#C86D51]/15 flex items-center justify-center border border-[#C86D51]/30">
                <Bookmark className="w-4 h-4 text-[#C86D51] fill-[#C86D51]" />
              </div>
              <div>
                <h3 className="font-serif-display text-xl md:text-2xl font-bold text-[#1C1917] leading-tight">
                  My Personal Reading List
                </h3>
                <p className="font-cinzel text-[10px] tracking-wider uppercase text-[#78716C]">
                  Shelved Volumes Saved For Reading
                </p>
              </div>
              <span className="ml-2 px-2.5 py-0.5 rounded-full bg-[#C86D51] text-white text-xs font-cinzel font-semibold">
                {shelvedBooks.length} {shelvedBooks.length === 1 ? 'Volume' : 'Volumes'}
              </span>
            </div>

            {shelvedBooks.length > 0 && (
              <button
                onClick={handleClearReadingList}
                className="text-xs font-cinzel text-[#78716C] hover:text-[#C86D51] transition-colors underline"
              >
                Clear Reading List
              </button>
            )}
          </div>

          {shelvedBooks.length === 0 ? (
            <div className="w-full py-10 bg-[#FAF8F5]/70 rounded-2xl border border-dashed border-[#D8CEBE] flex flex-col items-center justify-center text-center p-6 shadow-xs">
              <BookOpen className="w-8 h-8 text-[#9C8E7E] mb-2" />
              <p className="font-serif-heading italic text-base text-[#4A4238]">
                Your personal reading shelf is currently empty.
              </p>
              <p className="font-cinzel text-[10px] uppercase text-[#9C8E7E] mt-1 max-w-md">
                Click &quot;Shelve it&quot; on any volume to save it to your personal reading list below.
              </p>
            </div>
          ) : (
            <Bookshelf books={shelvedBooks} onSelectBook={handleSelectBook} />
          )}
        </div>
      </div>

      {/* Footer */}
      {!isDirectReaderLink && (
        <footer className="relative z-10 w-full py-6 text-center text-[#9C8E7E] font-cinzel text-[11px] tracking-widest uppercase border-t border-[#E5DEC9]/40 mt-12 bg-[#FAF8F5]/40 backdrop-blur-xs">
          <p>Whimsicalwhiner&apos;s Personal Library & Archive — All Rights Reserved</p>
        </footer>
      )}

      {/* Detail Overlay Modal */}
      <AnimatePresence>
        {selectedBook && (
          <BookDetailModal
            book={selectedBook}
            onClose={handleCloseDetailModal}
            onReadPdf={(book) => handleOpenPdfReader(book, 1)}
            isShelved={shelvedBooks.some((b) => b.id === selectedBook.id)}
            onToggleShelve={handleToggleShelve}
            onNextBook={
              selectedIndex >= 0 && selectedIndex < filteredBooks.length - 1
                ? handleNextBook
                : undefined
            }
            onPrevBook={selectedIndex > 0 ? handlePrevBook : undefined}
          />
        )}
      </AnimatePresence>

      {/* Embedded 3D Interactive PDF Reader Modal */}
      <PdfReaderModal
        book={pdfBook}
        initialPage={pdfInitialPage}
        onClose={handleClosePdfReader}
        onPageChange={handlePdfPageChange}
      />

      {/* Recommend A Book Modal */}
      <RecommendModal
        isOpen={isRecommendOpen}
        onClose={() => setIsRecommendOpen(false)}
      />
    </main>
  );
}
