'use client';

import React, { useEffect, useState, useRef } from 'react';
import { Book, PdfInfo, fetchPdfInfo, getPdfPageUrl, fetchPdfPageLinks, PdfPageLink, fetchPdfPageWords, PdfPageWord } from '@/lib/api';
import {
  X,
  ChevronLeft,
  ChevronRight,
  Maximize2,
  Minimize2,
  FileText,
  BookOpen,
  Loader2,
  Plus,
  Minus,
  Bookmark,
  Highlighter,
  NotebookPen,
  Trash2,
  Check,
  Tag,
  Sparkles,
  Copy,
} from 'lucide-react';

interface PdfReaderModalProps {
  book: Book | null;
  initialPage?: number;
  onClose: () => void;
  onPageChange?: (pageNum: number) => void;
}

export interface NoteItem {
  id: string;
  page: number;
  text: string;
  createdAt: string;
}

export interface HighlightItem {
  id: string;
  page: number;
  bbox: [number, number, number, number]; // [left_pct, top_pct, width_pct, height_pct]
  color: string;
  note?: string;
}

const HIGHLIGHT_COLORS = [
  { label: 'Yellow', value: '#FDE047', bg: 'bg-yellow-300/45', border: 'border-yellow-400' },
  { label: 'Green', value: '#86EFAC', bg: 'bg-green-300/45', border: 'border-green-400' },
  { label: 'Blue', value: '#93C5FD', bg: 'bg-blue-300/45', border: 'border-blue-400' },
  { label: 'Pink', value: '#F9A8D4', bg: 'bg-pink-300/45', border: 'border-pink-400' },
];

const roundPct = (v: number) => Math.round(v * 100) / 100;

function separateMergedWords(str: string): string {
  if (!str) return str;
  let text = str;

  // Insert space between CamelCase / TitleCase boundaries ("SoClive" -> "So Clive", "wentTo" -> "went To")
  text = text.replace(/([a-z0-9])([A-Z])/g, '$1 $2');

  // Insert space after punctuation if missing ("war,and" -> "war, and", "cabin,he" -> "cabin, he")
  text = text.replace(/([,.!?;:])([a-zA-Z])/g, '$1 $2');

  // Insert space before capital letters if preceded by lowercase without punctuation ("sleep.So" -> "sleep. So")
  text = text.replace(/([a-z])([A-Z])/g, '$1 $2');

  return text.replace(/\s+/g, ' ').trim();
}

function mergeLineRects(rects: DOMRect[]): { left: number; top: number; right: number; bottom: number; width: number; height: number }[] {
  if (!rects || rects.length === 0) return [];

  const validRects = rects.filter((r) => r.width > 1 && r.height > 1);
  if (validRects.length === 0) return [];

  // Sort rects vertically by top coordinate, then horizontally by left coordinate
  const sorted = [...validRects].sort((a, b) => (Math.abs(a.top - b.top) > 5 ? a.top - b.top : a.left - b.left));

  const lines: { left: number; top: number; right: number; bottom: number; width: number; height: number }[] = [];

  for (const r of sorted) {
    const rRight = r.right || r.left + r.width;
    const rBottom = r.bottom || r.top + r.height;

    let merged = false;
    for (const line of lines) {
      const verticalOverlap = Math.max(0, Math.min(line.bottom, rBottom) - Math.max(line.top, r.top));
      const minHeight = Math.min(line.height, r.height);

      if (verticalOverlap > minHeight * 0.35 || Math.abs(line.top - r.top) < 6) {
        line.left = Math.min(line.left, r.left);
        line.top = Math.min(line.top, r.top);
        line.right = Math.max(line.right, rRight);
        line.bottom = Math.max(line.bottom, rBottom);
        line.width = line.right - line.left;
        line.height = line.bottom - line.top;
        merged = true;
        break;
      }
    }

    if (!merged) {
      lines.push({
        left: r.left,
        top: r.top,
        right: rRight,
        bottom: rBottom,
        width: r.width,
        height: r.height,
      });
    }
  }

  return lines;
}

function loadBookmarks(bookId: number): number[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(`lib_bookmarks_${bookId}`);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveBookmarks(bookId: number, bookmarks: number[]) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(`lib_bookmarks_${bookId}`, JSON.stringify(bookmarks));
  } catch (err) {
    console.error(err);
  }
}

function loadNotes(bookId: number): NoteItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(`lib_notes_${bookId}`);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveNotes(bookId: number, notes: NoteItem[]) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(`lib_notes_${bookId}`, JSON.stringify(notes));
  } catch (err) {
    console.error(err);
  }
}

function loadHighlights(bookId: number): HighlightItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(`lib_highlights_${bookId}`);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveHighlights(bookId: number, highlights: HighlightItem[]) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(`lib_highlights_${bookId}`, JSON.stringify(highlights));
  } catch (err) {
    console.error(err);
  }
}

export const PdfReaderModal: React.FC<PdfReaderModalProps> = ({
  book,
  initialPage = 1,
  onClose,
  onPageChange,
}) => {
  const [pdfInfo, setPdfInfo] = useState<PdfInfo | null>(null);
  const [currentPage, setCurrentPage] = useState<number>(initialPage);
  const [loading, setLoading] = useState<boolean>(true);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [zoomScale, setZoomScale] = useState<number>(1);
  const [viewMode, setViewMode] = useState<'double' | 'single'>('double');

  // Interactive Bookmarks, Highlighting & Personal Notes State
  const [bookmarks, setBookmarks] = useState<number[]>([]);
  const [notes, setNotes] = useState<NoteItem[]>([]);
  const [highlights, setHighlights] = useState<HighlightItem[]>([]);
  const [isDrawerOpen, setIsDrawerOpen] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'bookmarks' | 'notes'>('notes');

  // Highlighting Tool State
  const [isHighlighterActive, setIsHighlighterActive] = useState<boolean>(false);
  const [selectedHighlightColor, setSelectedHighlightColor] = useState<string>('#FDE047');
  const [newNoteText, setNewNoteText] = useState<string>('');
  const [highlightDraw, setHighlightDraw] = useState<{
    page: number;
    startX: number;
    startY: number;
    currentX: number;
    currentY: number;
  } | null>(null);

  // Link Overlays & Text Layer Words State
  const [leftPageLinks, setLeftPageLinks] = useState<PdfPageLink[]>([]);
  const [rightPageLinks, setRightPageLinks] = useState<PdfPageLink[]>([]);
  const [singlePageLinks, setSinglePageLinks] = useState<PdfPageLink[]>([]);
  const [leftPageWords, setLeftPageWords] = useState<PdfPageWord[]>([]);
  const [rightPageWords, setRightPageWords] = useState<PdfPageWord[]>([]);
  const [singlePageWords, setSinglePageWords] = useState<PdfPageWord[]>([]);
  const [selectedTextPopover, setSelectedTextPopover] = useState<{
    text: string;
    page: number;
    x: number;
    y: number;
    rects?: DOMRect[];
  } | null>(null);

  const isSingle = viewMode === 'single';
  const leftPageNum = currentPage % 2 === 0 ? currentPage : (currentPage > 1 ? currentPage - 1 : 1);
  const rightPageNum = leftPageNum === 1 ? 2 : leftPageNum + 1;

  // 3D Page Drag & Flip State
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [isAnimatingFlip, setIsAnimatingFlip] = useState<boolean>(false);
  const [dragProgress, setDragProgress] = useState<number>(0);
  const [dragDirection, setDragDirection] = useState<'next' | 'prev' | null>(null);

  // Zoom Panning & Line Navigation State
  const [panOffset, setPanOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState<boolean>(false);
  const panStartRef = useRef<{ x: number; y: number; originX: number; originY: number }>({
    x: 0,
    y: 0,
    originX: 0,
    originY: 0,
  });

  const startXRef = useRef<number>(0);
  const clickStartTimeRef = useRef<number>(0);
  const bookSpreadRef = useRef<HTMLDivElement>(null);
  const pageContainerRef = useRef<HTMLDivElement>(null);

  const thumbnailContainerRef = useRef<HTMLDivElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  const [loadingStatus, setLoadingStatus] = useState<string>('Opening Archive Volume...');
  const [loadError, setLoadError] = useState<string | null>(null);

  // Load Book PDF Info, Bookmarks, Notes & Highlights
  const loadPdfInfo = async () => {
    if (!book) return;
    const bId = book.id;
    try {
      setLoading(true);
      setLoadError(null);
      setLoadingStatus('Fetching Cloud Archive Volume...');
      const info = await fetchPdfInfo(bId);
      setPdfInfo(info);
      setCurrentPage(initialPage > 0 ? initialPage : 1);

      // Restore bookmarks, notes & highlights for this volume from localStorage
      setBookmarks(loadBookmarks(bId));
      setNotes(loadNotes(bId));
      setHighlights(loadHighlights(bId));
    } catch (err: any) {
      console.error('Failed to load PDF info:', err);
      setLoadError(err?.message || 'Failed to download volume from cloud storage. Please check connection and retry.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPdfInfo();
  }, [book?.id, initialPage]);

  // Save Bookmarks on update
  useEffect(() => {
    if (book) {
      saveBookmarks(book.id, bookmarks);
    }
  }, [book, bookmarks]);

  // Save Notes on update
  useEffect(() => {
    if (book) {
      saveNotes(book.id, notes);
    }
  }, [book, notes]);

  // Save Highlights on update
  useEffect(() => {
    if (book) {
      saveHighlights(book.id, highlights);
    }
  }, [book, highlights]);

  // Fetch page links & words for native text selection layer
  useEffect(() => {
    if (!book || loading || !pdfInfo || !book.id) return;
    const bId = book.id;
    const totalP = typeof pdfInfo?.page_count === 'number' ? pdfInfo.page_count : 1;
    let isSubscribed = true;

    if (isSingle) {
      fetchPdfPageLinks(bId, currentPage).then((links) => {
        if (isSubscribed) setSinglePageLinks(links);
      });
      fetchPdfPageWords(bId, currentPage).then((words) => {
        if (isSubscribed) setSinglePageWords(words);
      });
    } else {
      const leftP = currentPage % 2 === 0 ? currentPage : (currentPage > 1 ? currentPage - 1 : 1);
      const rightP = leftP === 1 ? 2 : leftP + 1;

      fetchPdfPageLinks(bId, leftP).then((links) => {
        if (isSubscribed) setLeftPageLinks(links);
      });
      fetchPdfPageWords(bId, leftP).then((words) => {
        if (isSubscribed) setLeftPageWords(words);
      });

      if (rightP <= totalP) {
        fetchPdfPageLinks(bId, rightP).then((links) => {
          if (isSubscribed) setRightPageLinks(links);
        });
        fetchPdfPageWords(bId, rightP).then((words) => {
          if (isSubscribed) setRightPageWords(words);
        });
      } else {
        if (isSubscribed) {
          setRightPageLinks([]);
          setRightPageWords([]);
        }
      }
    }

    return () => {
      isSubscribed = false;
    };
  }, [book?.id, currentPage, isSingle, loading, pdfInfo?.page_count]);

  // Native Browser Text Selection Listener
  useEffect(() => {
    const handleSelectionChange = () => {
      const selection = window.getSelection();
      if (!selection || selection.isCollapsed || !selection.toString().trim()) {
        setSelectedTextPopover(null);
        return;
      }

      const rawSelectionText = selection.toString().trim();
      if (rawSelectionText.length > 0 && selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);
        const rect = range.getBoundingClientRect();
        const rawRects = Array.from(range.getClientRects()).filter(
          (r) => r.width > 0 && r.height > 0
        );

        if (rect.width > 0 && rect.height > 0 && rawRects.length > 0) {
          let targetPage = isSingle ? currentPage : leftPageNum;
          const anchorNode = selection.anchorNode;
          const anchorEl = anchorNode?.nodeType === Node.ELEMENT_NODE
            ? (anchorNode as Element)
            : anchorNode?.parentElement;
          const pageParent = anchorEl?.closest('[data-page-num]');
          if (pageParent) {
            const pageAttr = pageParent.getAttribute('data-page-num');
            if (pageAttr) {
              const parsed = parseInt(pageAttr, 10);
              if (!isNaN(parsed)) targetPage = parsed;
            }
          }

          // Build exact word sequence from target page words array using bounding box overlap
          const targetWordsList = isSingle
            ? singlePageWords
            : targetPage === leftPageNum
            ? leftPageWords
            : rightPageWords;

          const pageEl = document.querySelector(`[data-page-num="${targetPage}"]`);
          let extractedText = rawSelectionText;

          if (pageEl && targetWordsList && targetWordsList.length > 0) {
            const pageRect = pageEl.getBoundingClientRect();
            const selWords: string[] = [];

            for (const w of targetWordsList) {
              const [wLeftPct, wTopPct, wWidthPct, wHeightPct] = w.bbox;
              const wLeft = pageRect.left + (wLeftPct / 100) * pageRect.width;
              const wTop = pageRect.top + (wTopPct / 100) * pageRect.height;
              const wRight = wLeft + (wWidthPct / 100) * pageRect.width;
              const wBottom = wTop + (wHeightPct / 100) * pageRect.height;

              const intersects = rawRects.some(
                (r) =>
                  r.left < wRight + 4 &&
                  r.right > wLeft - 4 &&
                  r.top < wBottom + 4 &&
                  r.bottom > wTop - 4
              );

              if (intersects) {
                selWords.push(w.text);
              }
            }

            if (selWords.length > 0) {
              extractedText = selWords.join(' ');
            }
          }

          extractedText = separateMergedWords(extractedText);

          setSelectedTextPopover({
            text: extractedText,
            page: targetPage,
            x: rect.left + rect.width / 2,
            y: Math.max(70, rect.top - 10),
            rects: rawRects,
          });
        }
      }
    };

    document.addEventListener('selectionchange', handleSelectionChange);
    return () => {
      document.removeEventListener('selectionchange', handleSelectionChange);
    };
  }, [currentPage, isSingle, leftPageNum, leftPageWords, rightPageWords, singlePageWords]);

  // Handle Highlight Selected Text from popover
  const handleHighlightSelectedText = () => {
    if (!selectedTextPopover) return;
    const targetPage = selectedTextPopover.page;
    const selection = window.getSelection();
    let rawRects = selectedTextPopover.rects || [];

    if (rawRects.length === 0 && selection && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      rawRects = Array.from(range.getClientRects()).filter(
        (r) => r.width > 0 && r.height > 0
      );
    }

    if (rawRects.length > 0) {
      const mergedLineRects = mergeLineRects(rawRects);
      const pageEl = document.querySelector(`[data-page-num="${targetPage}"]`);
      if (pageEl) {
        const pageRect = pageEl.getBoundingClientRect();
        const newHls: HighlightItem[] = [];

        for (const rect of mergedLineRects) {
          const leftPct = Math.max(0, ((rect.left - pageRect.left) / pageRect.width) * 100);
          const topPct = Math.max(0, ((rect.top - pageRect.top) / pageRect.height) * 100);
          const widthPct = Math.min(100 - leftPct, (rect.width / pageRect.width) * 100);
          const heightPct = Math.min(100 - topPct, (rect.height / pageRect.height) * 100);

          if (widthPct > 0.3 && heightPct > 0.3) {
            newHls.push({
              id: `hl_${Date.now()}_${Math.random().toString(36).substring(2, 7)}_${Math.random().toString(36).substring(2, 5)}`,
              page: targetPage,
              bbox: [
                roundPct(leftPct),
                roundPct(topPct),
                Math.max(1, roundPct(widthPct)),
                Math.max(1, roundPct(heightPct)),
              ],
              color: selectedHighlightColor,
            });
          }
        }

        if (newHls.length > 0) {
          setHighlights((prev) => {
            const filtered = newHls.filter((newHl) => {
              return !prev.some(
                (existing) =>
                  existing.page === newHl.page &&
                  Math.abs(existing.bbox[0] - newHl.bbox[0]) < 1 &&
                  Math.abs(existing.bbox[1] - newHl.bbox[1]) < 1 &&
                  Math.abs(existing.bbox[2] - newHl.bbox[2]) < 1 &&
                  Math.abs(existing.bbox[3] - newHl.bbox[3]) < 1
              );
            });
            return [...prev, ...filtered];
          });
        }
      }
    }
    selection?.removeAllRanges();
    setSelectedTextPopover(null);
  };

  const handleCopySelectedText = () => {
    if (selectedTextPopover) {
      navigator.clipboard.writeText(selectedTextPopover.text);
      window.getSelection()?.removeAllRanges();
      setSelectedTextPopover(null);
    }
  };

  const handleNoteFromSelectedText = () => {
    if (selectedTextPopover) {
      setNewNoteText(separateMergedWords(selectedTextPopover.text));
      setIsDrawerOpen(true);
      setActiveTab('notes');
      window.getSelection()?.removeAllRanges();
      setSelectedTextPopover(null);
    }
  };

  // Toggle Bookmark for current page
  const toggleCurrentPageBookmark = (targetPage?: number) => {
    const pageToToggle = targetPage || (isSingle ? currentPage : leftPageNum);
    setBookmarks((prev) => {
      const exists = prev.includes(pageToToggle);
      if (exists) {
        return prev.filter((p) => p !== pageToToggle);
      } else {
        return [...prev, pageToToggle].sort((a, b) => a - b);
      }
    });
  };

  // Add Note for current page
  const handleAddNote = () => {
    if (!newNoteText.trim() || !book) return;
    const targetP = isSingle ? currentPage : leftPageNum;

    const newNote: NoteItem = {
      id: `note_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      page: targetP,
      text: separateMergedWords(newNoteText.trim()),
      createdAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setNotes((prev) => [newNote, ...prev]);
    setNewNoteText('');
  };

  // Delete Note
  const handleDeleteNote = (noteId: string) => {
    setNotes((prev) => prev.filter((n) => n.id !== noteId));
  };

  // Interactive Drag-Selection Highlighting Handlers
  const handleHighlightPointerDown = (e: React.PointerEvent<HTMLDivElement>, pageNum: number) => {
    if (!isHighlighterActive) return;
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    const startX = ((e.clientX - rect.left) / rect.width) * 100;
    const startY = ((e.clientY - rect.top) / rect.height) * 100;

    setHighlightDraw({
      page: pageNum,
      startX,
      startY,
      currentX: startX,
      currentY: startY,
    });

    try {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } catch {}
  };

  const handleHighlightPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isHighlighterActive || !highlightDraw) return;
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    const currentX = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
    const currentY = Math.max(0, Math.min(100, ((e.clientY - rect.top) / rect.height) * 100));

    setHighlightDraw((prev) => (prev ? { ...prev, currentX, currentY } : null));
  };

  const handleHighlightPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isHighlighterActive || !highlightDraw) return;
    e.stopPropagation();

    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {}

    const leftPct = Math.min(highlightDraw.startX, highlightDraw.currentX);
    const topPct = Math.min(highlightDraw.startY, highlightDraw.currentY);
    let widthPct = Math.abs(highlightDraw.currentX - highlightDraw.startX);
    let heightPct = Math.abs(highlightDraw.currentY - highlightDraw.startY);

    // Single click default line highlight
    if (widthPct < 1 && heightPct < 1) {
      widthPct = 35;
      heightPct = 3.5;
    }

    const newHighlight: HighlightItem = {
      id: `hl_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      page: highlightDraw.page,
      bbox: [Math.max(0, leftPct), Math.max(0, topPct), Math.max(1, widthPct), Math.max(1, heightPct)],
      color: selectedHighlightColor,
    };

    setHighlights((prev) => [...prev, newHighlight]);
    setHighlightDraw(null);
  };

  // Remove Highlight
  const handleDeleteHighlight = (hlId: string) => {
    setHighlights((prev) => prev.filter((h) => h.id !== hlId));
  };

  const renderPageLinks = (links: PdfPageLink[]) => {
    if (!links || links.length === 0) return null;
    return (
      <div className="absolute inset-0 pointer-events-none z-30">
        {links.map((link, idx) => {
          const [leftPct, topPct, widthPct, heightPct] = link.bbox;
          return (
            <a
              key={idx}
              href={link.kind === 'uri' ? link.uri : '#'}
              target={link.kind === 'uri' ? '_blank' : '_self'}
              rel="noopener noreferrer"
              onPointerDown={(e) => e.stopPropagation()}
              onPointerUp={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                if (link.kind === 'goto' && link.page) {
                  e.preventDefault();
                  changePage(link.page);
                }
              }}
              className="absolute pointer-events-auto border border-blue-400/30 hover:border-blue-600 hover:bg-blue-500/35 bg-blue-500/15 rounded-xs transition-colors cursor-pointer"
              style={{
                left: `${leftPct}%`,
                top: `${topPct}%`,
                width: `${widthPct}%`,
                height: `${heightPct}%`,
              }}
              title={link.kind === 'goto' ? `Jump to Page ${link.page}` : link.uri}
            />
          );
        })}
      </div>
    );
  };

  // Render Highlights Layer & Live Drag Selection Preview on Top of Page Image
  const renderPageHighlights = (pageNum: number) => {
    const pageHls = highlights.filter((h) => h.page === pageNum);
    const isDrawingThisPage = highlightDraw && highlightDraw.page === pageNum;

    if (pageHls.length === 0 && !isDrawingThisPage) return null;

    return (
      <div className="absolute inset-0 pointer-events-none z-25">
        {/* Saved Highlights */}
        {pageHls.map((hl) => {
          const [leftPct, topPct, widthPct, heightPct] = hl.bbox;
          return (
            <div
              key={hl.id}
              onPointerDown={(e) => e.stopPropagation()}
              onPointerUp={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                handleDeleteHighlight(hl.id);
              }}
              className="absolute pointer-events-auto cursor-pointer rounded-xs transition-opacity hover:opacity-80 group/hl shadow-xs"
              style={{
                left: `${leftPct}%`,
                top: `${topPct}%`,
                width: `${widthPct}%`,
                height: `${heightPct}%`,
                backgroundColor: `${hl.color}70`,
                borderBottom: `2px solid ${hl.color}`,
              }}
              title="Click highlight to remove"
            >
              <div className="hidden group-hover/hl:flex absolute -top-7 left-1/2 -translate-x-1/2 bg-black/80 text-white text-[9px] font-cinzel px-2 py-0.5 rounded shadow-md whitespace-nowrap z-40">
                Remove Highlight
              </div>
            </div>
          );
        })}

        {/* Live Selection Preview Box */}
        {isDrawingThisPage && (() => {
          const leftPct = Math.min(highlightDraw.startX, highlightDraw.currentX);
          const topPct = Math.min(highlightDraw.startY, highlightDraw.currentY);
          const widthPct = Math.abs(highlightDraw.currentX - highlightDraw.startX);
          const heightPct = Math.abs(highlightDraw.currentY - highlightDraw.startY);

          return (
            <div
              className="absolute pointer-events-none rounded-xs border-2 border-dashed z-40 transition-none shadow-md"
              style={{
                left: `${leftPct}%`,
                top: `${topPct}%`,
                width: `${widthPct}%`,
                height: `${heightPct}%`,
                backgroundColor: `${selectedHighlightColor}60`,
                borderColor: selectedHighlightColor,
              }}
            />
          );
        })()}
      </div>
    );
  };

  // Render Transparent Selectable Text Layer (Enables native text selection & copying)
  const renderPageTextLayer = (words: PdfPageWord[], pageNum: number) => {
    if (!words || words.length === 0) return null;

    return (
      <div
        className={`absolute inset-0 z-20 select-text overflow-hidden opacity-100 ${
          isHighlighterActive ? 'pointer-events-none' : 'pointer-events-auto'
        }`}
        onPointerDown={(e) => {
          if (!isHighlighterActive) e.stopPropagation();
        }}
        onPointerUp={(e) => {
          if (!isHighlighterActive) e.stopPropagation();
        }}
      >
        {words.map((w, idx) => {
          const [leftPct, topPct, widthPct, heightPct] = w.bbox;
          return (
            <React.Fragment key={idx}>
              <span
                className="absolute select-text leading-none text-transparent selection:bg-amber-300/60 selection:text-black font-serif cursor-text"
                style={{
                  left: `${leftPct}%`,
                  top: `${topPct}%`,
                  width: `${widthPct}%`,
                  height: `${heightPct}%`,
                  fontSize: `${Math.max(10, heightPct * 4)}px`,
                  whiteSpace: 'pre',
                }}
              >
                {w.text}{' '}
              </span>
            </React.Fragment>
          );
        })}
      </div>
    );
  };

  const changePage = (newPage: number) => {
    setCurrentPage(newPage);
    setPanOffset({ x: 0, y: 0 });
    if (onPageChange) {
      onPageChange(newPage);
    }
  };

  const handleZoomIn = () => {
    setZoomScale((prev) => Math.min(2.5, Math.round((prev + 0.15) * 100) / 100));
  };

  const handleZoomOut = () => {
    setZoomScale((prev) => Math.max(0.6, Math.round((prev - 0.15) * 100) / 100));
  };

  const handleResetZoom = () => {
    setZoomScale(1);
    setPanOffset({ x: 0, y: 0 });
  };

  // Trackpad & Mouse Wheel Smooth Panning & Zooming
  useEffect(() => {
    const el = bookSpreadRef.current;
    if (!el) return;

    const handleWheel = (e: WheelEvent) => {
      // Ctrl / Cmd + Scroll Wheel to Zoom
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        const delta = e.deltaY < 0 ? 0.1 : -0.1;
        setZoomScale((prev) => {
          const nextZ = Math.max(0.6, Math.min(2.5, Math.round((prev + delta) * 100) / 100));
          if (nextZ === 1) setPanOffset({ x: 0, y: 0 });
          return nextZ;
        });
        return;
      }

      // If Zoomed In (zoomScale > 1), mouse wheel / trackpad scroll smoothly moves page in X & Y
      if (zoomScale > 1) {
        e.preventDefault();
        setPanOffset((prev) => {
          const containerW = el.offsetWidth || 800;
          const containerH = el.offsetHeight || 600;
          const maxPanX = (containerW * (zoomScale - 1)) / 2 + 150;
          const maxPanY = (containerH * (zoomScale - 1)) / 2 + 250;

          const newX = Math.max(-maxPanX, Math.min(maxPanX, prev.x - e.deltaX * 0.85));
          const newY = Math.max(-maxPanY, Math.min(maxPanY, prev.y - e.deltaY * 0.85));
          return { x: newX, y: newY };
        });
        return;
      }

      // In Single Page View (isSingle && zoomScale === 1), scroll pageContainerRef vertically!
      if (isSingle && pageContainerRef.current) {
        pageContainerRef.current.scrollTop += e.deltaY;
      }
    };

    el.addEventListener('wheel', handleWheel, { passive: false });
    return () => {
      el.removeEventListener('wheel', handleWheel);
    };
  }, [zoomScale, isSingle]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!book || !pdfInfo) return;
      if (e.key === 'ArrowLeft') {
        handlePrevPage();
      } else if (e.key === 'ArrowRight') {
        handleNextPage();
      } else if (e.key === '+' || e.key === '=') {
        handleZoomIn();
      } else if (e.key === '-') {
        handleZoomOut();
      } else if (e.key === '0') {
        handleResetZoom();
      } else if (e.key === 'Escape') {
        if (!document.fullscreenElement) {
          onClose();
        }
      }
    };

    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    window.addEventListener('keydown', handleKeyDown);
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, [book, pdfInfo, currentPage, isSingle]);

  if (!book) return null;

  const totalPages = typeof pdfInfo?.page_count === 'number' ? pdfInfo.page_count : 1;

  const isLeftBookmarked = bookmarks.includes(leftPageNum);
  const isRightBookmarked = bookmarks.includes(rightPageNum);
  const isCurrentBookmarked = isSingle ? bookmarks.includes(currentPage) : (isLeftBookmarked || isRightBookmarked);

  const animatePageFlip = (direction: 'next' | 'prev') => {
    if (isAnimatingFlip) return;
    setIsAnimatingFlip(true);
    setDragDirection(direction);

    let progress = 0;
    const startTime = performance.now();
    const duration = 380;

    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      progress = Math.min(1, elapsed / duration);
      const easeProgress = progress < 0.5
        ? 2 * progress * progress
        : 1 - Math.pow(-2 * progress + 2, 2) / 2;

      setDragProgress(easeProgress);

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        if (direction === 'next' && rightPageNum < totalPages) {
          const nextP = rightPageNum + 1;
          changePage(nextP <= totalPages ? nextP : totalPages);
        } else if (direction === 'prev' && leftPageNum > 1) {
          const prevP = leftPageNum - 2;
          changePage(prevP >= 1 ? prevP : 1);
        }
        setDragProgress(0);
        setDragDirection(null);
        setIsAnimatingFlip(false);
      }
    };
    requestAnimationFrame(animate);
  };

  const handleNextPage = () => {
    if (isSingle) {
      if (currentPage < totalPages) {
        changePage(currentPage + 1);
      }
    } else {
      if (rightPageNum < totalPages) {
        animatePageFlip('next');
      }
    }
  };

  const handlePrevPage = () => {
    if (isSingle) {
      if (currentPage > 1) {
        changePage(currentPage - 1);
      }
    } else {
      if (leftPageNum > 1) {
        animatePageFlip('prev');
      }
    }
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    if (!bookSpreadRef.current || isAnimatingFlip || isHighlighterActive) return;

    if (zoomScale > 1) {
      setIsPanning(true);
      panStartRef.current = {
        x: e.clientX,
        y: e.clientY,
        originX: panOffset.x,
        originY: panOffset.y,
      };
      try {
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      } catch {}
      return;
    }

    const rect = bookSpreadRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const width = rect.width;

    startXRef.current = e.clientX;
    clickStartTimeRef.current = performance.now();
    setIsDragging(true);

    if (clickX > width / 2) {
      setDragDirection('next');
    } else {
      setDragDirection('prev');
    }
    setDragProgress(0);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (isHighlighterActive || isAnimatingFlip || !bookSpreadRef.current) return;

    if (zoomScale > 1 && isPanning) {
      const deltaX = e.clientX - panStartRef.current.x;
      const deltaY = e.clientY - panStartRef.current.y;

      const containerWidth = bookSpreadRef.current.offsetWidth || 800;
      const containerHeight = bookSpreadRef.current.offsetHeight || 600;
      const maxPanX = (containerWidth * (zoomScale - 1)) / 2 + 150;
      const maxPanY = (containerHeight * (zoomScale - 1)) / 2 + 250;

      const newX = Math.max(-maxPanX, Math.min(maxPanX, panStartRef.current.originX + deltaX));
      const newY = Math.max(-maxPanY, Math.min(maxPanY, panStartRef.current.originY + deltaY));

      setPanOffset({ x: newX, y: newY });
      return;
    }

    if (!isDragging) return;

    const deltaX = e.clientX - startXRef.current;
    const width = bookSpreadRef.current.offsetWidth / 2;

    if (dragDirection === 'next') {
      const progress = Math.max(0, Math.min(1, -deltaX / width));
      setDragProgress(progress);
    } else if (dragDirection === 'prev') {
      const progress = Math.max(0, Math.min(1, deltaX / width));
      setDragProgress(progress);
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (isHighlighterActive) return;

    if (zoomScale > 1 && isPanning) {
      setIsPanning(false);
      try {
        (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
      } catch {}
      return;
    }

    if (!isDragging || isAnimatingFlip) return;
    setIsDragging(false);

    const clickDuration = performance.now() - clickStartTimeRef.current;
    const deltaX = Math.abs(e.clientX - startXRef.current);

    if (clickDuration < 300 && deltaX < 15) {
      if (dragDirection === 'next' && rightPageNum < totalPages) {
        animatePageFlip('next');
      } else if (dragDirection === 'prev' && leftPageNum > 1) {
        animatePageFlip('prev');
      } else {
        setDragProgress(0);
        setDragDirection(null);
      }
      return;
    }

    if (dragProgress > 0.25) {
      if (dragDirection === 'next' && rightPageNum < totalPages) {
        const nextP = rightPageNum + 1;
        changePage(nextP <= totalPages ? nextP : totalPages);
      } else if (dragDirection === 'prev' && leftPageNum > 1) {
        const prevP = leftPageNum - 2;
        changePage(prevP >= 1 ? prevP : 1);
      }
    }
    setDragProgress(0);
    setDragDirection(null);
  };

  const toggleFullscreen = () => {
    if (!modalRef.current) return;
    if (!document.fullscreenElement) {
      modalRef.current.requestFullscreen().catch((err) => console.error(err));
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch((err) => console.error(err));
      setIsFullscreen(false);
    }
  };

  const flipRotationAngle = dragDirection === 'next'
    ? -dragProgress * 180
    : dragProgress * 180;

  return (
    <div className={`fixed inset-0 z-50 flex items-center justify-center ${
      isFullscreen ? 'p-0 bg-[#12100E]' : 'p-2 md:p-6 bg-black/70 backdrop-blur-md animate-in fade-in duration-200'
    }`}>
      <div
        ref={modalRef}
        className={`relative w-full ${
          isFullscreen
            ? 'h-screen w-screen max-w-none rounded-none border-none bg-[#12100E]'
            : 'max-w-6xl h-[94vh] rounded-3xl border border-[#E5DEC9] bg-[#F6F3ED]'
        } shadow-2xl overflow-hidden flex flex-col justify-between transition-all duration-300`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Bar */}
        <div className={`flex items-center justify-between px-6 py-3 z-20 flex-shrink-0 transition-colors ${
          isFullscreen
            ? 'bg-gradient-to-b from-black/80 to-transparent text-amber-100 absolute top-0 left-0 right-0 py-4 pointer-events-auto'
            : 'border-b border-[#E5DEC9] bg-[#F6F3ED]'
        }`}>
          <div className="flex items-center gap-4">
            {!isFullscreen && (
              <div
                className="w-10 h-14 rounded-xs shadow-md flex flex-col justify-between p-1 border border-black/20 flex-shrink-0"
                style={{ backgroundColor: book.spine_color || '#8C3A27' }}
              >
                <span className="font-cinzel text-[5px] tracking-widest text-amber-100/80 uppercase text-center">
                  ARCHIVE
                </span>
                <p className="font-serif-display text-[9px] font-bold text-amber-100 text-center leading-tight line-clamp-2">
                  {book.title}
                </p>
                <span className="font-serif-heading italic text-[7px] text-amber-200/80 text-center truncate">
                  {book.author}
                </span>
              </div>
            )}

            <div className="flex flex-col">
              <h2 className={`font-serif-display text-lg md:text-xl font-normal leading-tight ${
                isFullscreen ? 'text-amber-100 drop-shadow-md' : 'text-[#1C1917]'
              }`}>
                {book.title}
              </h2>
              <div className="flex items-center gap-3 mt-0.5">
                <p className={`font-serif-heading italic text-xs ${
                  isFullscreen ? 'text-amber-200/80' : 'text-[#78716C]'
                }`}>
                  by {book.author}
                </p>
                {book.series && !isFullscreen && (
                  <span className="px-2 py-0.5 rounded-md bg-[#EFEAE1] border border-[#E5DEC9] text-[10px] font-cinzel text-[#78716C]">
                    Series: <strong className="text-[#1C1917] font-semibold">{book.series}</strong> {book.series_order ? `(#${book.series_order})` : ''}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Header Action Tools: Bookmarking, Highlighting, Notes Drawer, Zoom, View Modes */}
          <div className="flex items-center gap-3">
            {/* Bookmark Current Page Button */}
            <button
              onClick={() => toggleCurrentPageBookmark()}
              className={`px-2.5 py-1 rounded-full font-cinzel text-xs font-semibold flex items-center gap-1.5 transition-all border ${
                isCurrentBookmarked
                  ? 'bg-amber-500 text-white border-amber-600 shadow-xs'
                  : 'bg-white text-[#4A4238] border-[#D8CEBE] hover:bg-[#FAF6EE]'
              }`}
              title={isCurrentBookmarked ? 'Remove Bookmark from Page' : 'Bookmark Current Page'}
            >
              <Bookmark className={`w-3.5 h-3.5 ${isCurrentBookmarked ? 'fill-white' : ''}`} />
              <span className="hidden sm:inline">{isCurrentBookmarked ? 'Bookmarked' : 'Bookmark'}</span>
            </button>

            {/* Highlighter Tool Button & Color Picker */}
            <div className="flex items-center gap-1 bg-white px-2 py-1 rounded-full border border-[#D8CEBE]">
              <button
                onClick={() => setIsHighlighterActive(!isHighlighterActive)}
                className={`p-1 rounded-full transition-colors ${
                  isHighlighterActive ? 'bg-[#C86D51] text-white' : 'text-[#4A4238] hover:bg-black/5'
                }`}
                title={isHighlighterActive ? 'Deactivate Highlighter Tool' : 'Activate Highlighter Tool (Click page to highlight)'}
              >
                <Highlighter className="w-3.5 h-3.5" />
              </button>

              {isHighlighterActive && (
                <div className="flex items-center gap-1 pl-1 border-l border-black/10">
                  {HIGHLIGHT_COLORS.map((c) => (
                    <button
                      key={c.value}
                      onClick={() => setSelectedHighlightColor(c.value)}
                      className={`w-3.5 h-3.5 rounded-full transition-transform ${
                        selectedHighlightColor === c.value ? 'scale-125 ring-2 ring-black/40' : 'hover:scale-110'
                      }`}
                      style={{ backgroundColor: c.value }}
                      title={`Highlight Color: ${c.label}`}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Notes & Bookmarks Sidebar Drawer Toggle Button */}
            <button
              onClick={() => setIsDrawerOpen(!isDrawerOpen)}
              className={`px-3 py-1 rounded-full font-cinzel text-xs font-semibold flex items-center gap-1.5 transition-all border relative ${
                isDrawerOpen
                  ? 'bg-[#1C1917] text-amber-100 border-[#1C1917]'
                  : 'bg-white text-[#4A4238] border-[#D8CEBE] hover:bg-[#FAF6EE]'
              }`}
              title="Open Notes & Bookmarks Drawer"
            >
              <NotebookPen className="w-3.5 h-3.5 text-[#C86D51]" />
              <span className="hidden sm:inline">Notes</span>
              {(notes.length > 0 || bookmarks.length > 0) && (
                <span className="w-4 h-4 rounded-full bg-[#C86D51] text-white text-[9px] font-bold flex items-center justify-center">
                  {notes.length + bookmarks.length}
                </span>
              )}
            </button>

            {/* Page Counter */}
            <span className={`font-cinzel text-xs font-medium tracking-wider hidden md:inline ${
              isFullscreen ? 'text-amber-100/90' : 'text-[#4A4238]'
            }`}>
              Page {isSingle ? currentPage : leftPageNum} of {totalPages}
            </span>

            {/* View Mode Toggle: 1 Page vs 2 Pages */}
            <div className={`flex items-center gap-0.5 p-0.5 rounded-full border ${
              isFullscreen
                ? 'border-white/20 bg-white/10 text-amber-100'
                : 'border-[#D8CEBE] bg-white text-[#1C1917]'
            }`}>
              <button
                onClick={() => setViewMode('single')}
                className={`px-2 py-0.5 rounded-full font-cinzel text-[10px] md:text-[11px] font-semibold flex items-center gap-1 transition-all ${
                  isSingle
                    ? 'bg-[#C86D51] text-white shadow-xs'
                    : 'hover:bg-black/5 text-[#78716C]'
                }`}
                title="Single Page Mode"
              >
                <FileText className="w-3 h-3 md:w-3.5 md:h-3.5" />
                <span>1 Page</span>
              </button>
              <button
                onClick={() => setViewMode('double')}
                className={`px-2 py-0.5 rounded-full font-cinzel text-[10px] md:text-[11px] font-semibold flex items-center gap-1 transition-all ${
                  !isSingle
                    ? 'bg-[#C86D51] text-white shadow-xs'
                    : 'hover:bg-black/5 text-[#78716C]'
                }`}
                title="2-Page Spread Mode"
              >
                <BookOpen className="w-3 h-3 md:w-3.5 md:h-3.5" />
                <span>2 Pages</span>
              </button>
            </div>

            {/* Zoom Controls */}
            <div className={`hidden sm:flex items-center gap-1 px-2 py-1 rounded-full border ${
              isFullscreen
                ? 'border-white/20 bg-white/10 text-amber-100'
                : 'border-[#D8CEBE] bg-white text-[#1C1917]'
            }`}>
              <button
                onClick={handleZoomOut}
                disabled={zoomScale <= 0.6}
                className="p-1 rounded-full hover:bg-black/10 disabled:opacity-30 transition-colors"
                title="Zoom Out (-)"
              >
                <Minus className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={handleResetZoom}
                className="font-cinzel text-xs font-semibold px-1.5 min-w-[40px] text-center hover:underline"
                title="Reset Zoom to 100%"
              >
                {Math.round(zoomScale * 100)}%
              </button>
              <button
                onClick={handleZoomIn}
                disabled={zoomScale >= 2.5}
                className="p-1 rounded-full hover:bg-black/10 disabled:opacity-30 transition-colors"
                title="Zoom In (+)"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Prev / Next Page Buttons */}
            <div className="flex items-center gap-1">
              <button
                onClick={handlePrevPage}
                disabled={isSingle ? currentPage <= 1 : leftPageNum <= 1}
                className={`w-8 h-8 rounded-full border flex items-center justify-center transition-all ${
                  isFullscreen
                    ? 'border-white/20 bg-white/10 hover:bg-white/30 text-amber-100 disabled:opacity-20'
                    : 'border-[#D8CEBE] bg-white hover:bg-[#1C1917] hover:text-white text-[#1C1917] disabled:opacity-30'
                } disabled:pointer-events-none`}
                title="Previous Page"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={handleNextPage}
                disabled={isSingle ? currentPage >= totalPages : rightPageNum >= totalPages}
                className={`w-8 h-8 rounded-full border flex items-center justify-center transition-all ${
                  isFullscreen
                    ? 'border-white/20 bg-white/10 hover:bg-white/30 text-amber-100 disabled:opacity-20'
                    : 'border-[#D8CEBE] bg-white hover:bg-[#1C1917] hover:text-white text-[#1C1917] disabled:opacity-30'
                } disabled:pointer-events-none`}
                title="Next Page"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            {/* Fullscreen Toggle */}
            <button
              onClick={toggleFullscreen}
              className={`p-1.5 rounded-md transition-colors ${
                isFullscreen
                  ? 'hover:bg-white/20 text-amber-100'
                  : 'hover:bg-black/5 text-[#78716C] hover:text-[#1C1917]'
              }`}
              title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
            >
              {isFullscreen ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}
            </button>

            {/* Close Button */}
            <button
              onClick={onClose}
              className={`p-1.5 rounded-md transition-colors ${
                isFullscreen
                  ? 'hover:bg-white/20 text-amber-100'
                  : 'hover:bg-black/5 text-[#1C1917]'
              }`}
              title="Close Reader"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Main Content Body */}
        <div className={`flex-1 flex overflow-hidden relative ${
          isFullscreen ? 'bg-[#12100E] pt-14 pb-12' : 'bg-[#E6E1D7]'
        }`}>
          {/* Left Vertical Thumbnail Sidebar */}
          {!isFullscreen && !loading && (
            <div
              ref={thumbnailContainerRef}
              className="w-24 md:w-32 border-r border-[#D8CEBE] bg-[#F0EBE1] overflow-y-auto p-3 flex flex-col items-center gap-4 shelf-scrollbar flex-shrink-0 z-10 animate-in fade-in duration-300"
            >
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((pNum) => {
                const isCurrent = isSingle
                  ? pNum === currentPage
                  : pNum === leftPageNum || pNum === rightPageNum;
                const hasBM = bookmarks.includes(pNum);

                return (
                  <div
                    key={pNum}
                    onClick={() => changePage(pNum)}
                    className={`group cursor-pointer flex flex-col items-center transition-transform hover:scale-105 ${
                      isCurrent ? 'scale-105' : ''
                    }`}
                  >
                    <div
                      className={`w-16 md:w-20 h-22 md:h-28 rounded-md bg-white border overflow-hidden shadow-xs relative transition-all ${
                        isCurrent
                          ? 'border-2 border-[#C86D51] shadow-md ring-2 ring-[#C86D51]/30'
                          : 'border-[#D8CEBE] hover:border-[#1C1917]'
                      }`}
                    >
                      <img
                        src={getPdfPageUrl(book.id, pNum)}
                        alt={`Thumbnail page ${pNum}`}
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />

                      {hasBM && (
                        <div className="absolute top-0 right-1 w-2.5 h-4 bg-amber-500 rounded-b-xs shadow-xs flex items-center justify-center z-20">
                          <Bookmark className="w-2 h-2 text-white fill-white" />
                        </div>
                      )}
                    </div>
                    <span className={`text-[10px] font-cinzel font-semibold mt-1.5 ${
                      isCurrent ? 'text-[#C86D51]' : 'text-[#78716C]'
                    }`}>
                      {pNum}
                    </span>
                  </div>
                );
              })}
            </div>
          )}

          {/* Center 3D Book Canvas */}
          <div className={`flex-1 overflow-hidden relative flex items-center justify-center p-4 md:p-10 select-none ${
            isFullscreen ? 'bg-[#12100E]' : 'bg-[#E6E1D7]'
          }`}>
            {/* Zoom Line Panning HUD Banner */}
            {zoomScale > 1 && (
              <div className="absolute top-4 left-1/2 -translate-x-1/2 z-40 bg-[#1C1917]/90 text-amber-100 px-4 py-1.5 rounded-full text-xs font-cinzel shadow-2xl border border-amber-500/40 backdrop-blur-md flex items-center gap-3 animate-in fade-in slide-in-from-top-2 duration-200 pointer-events-auto">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                  <span>Zoomed {Math.round(zoomScale * 100)}% · Click & Drag or Scroll to move page</span>
                </div>
                <button
                  onClick={handleResetZoom}
                  className="px-2.5 py-0.5 rounded-full bg-amber-500/20 hover:bg-amber-500/40 text-amber-200 border border-amber-400/40 text-[10px] font-bold uppercase transition-colors"
                >
                  Reset View
                </button>
              </div>
            )}

            {loading ? (
              <div className="flex flex-col items-center justify-center gap-4 text-[#78716C] animate-in fade-in duration-200">
                <Loader2 className="w-10 h-10 animate-spin text-[#C86D51]" />
                <div className="flex flex-col items-center gap-1 text-center">
                  <span className="font-cinzel text-xs uppercase tracking-widest font-semibold text-[#4A4238]">
                    {loadingStatus}
                  </span>
                  <span className="font-serif-heading italic text-xs text-[#78716C]">
                    Downloading PDF volume from cloud archive storage...
                  </span>
                </div>
              </div>
            ) : loadError ? (
              <div className="flex flex-col items-center justify-center gap-4 p-8 bg-white/90 rounded-3xl border border-amber-900/20 text-center max-w-md shadow-2xl backdrop-blur-md animate-in fade-in zoom-in-95 duration-200">
                <div className="w-12 h-12 rounded-full bg-amber-100 text-[#C86D51] flex items-center justify-center font-bold text-lg border border-amber-300">
                  !
                </div>
                <div className="flex flex-col gap-1">
                  <h4 className="font-serif-display text-base font-semibold text-[#1C1917]">Volume Temporarily Unavailable</h4>
                  <p className="font-serif-heading text-xs text-[#78716C] leading-relaxed">{loadError}</p>
                </div>
                <button
                  onClick={loadPdfInfo}
                  className="px-6 py-2.5 rounded-full bg-[#C86D51] hover:bg-[#B05B41] text-white font-cinzel text-xs font-semibold uppercase tracking-wider transition-all shadow-md hover:scale-105"
                >
                  Retry Opening Volume
                </button>
              </div>
            ) : (
              <div
                ref={bookSpreadRef}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerLeave={handlePointerUp}
                className={`real-book-container w-full my-auto origin-center ${
                  isHighlighterActive
                    ? 'cursor-crosshair'
                    : zoomScale > 1
                    ? isPanning
                      ? 'cursor-grabbing'
                      : 'cursor-grab'
                    : 'cursor-pointer'
                } ${
                  isSingle
                    ? isFullscreen
                      ? 'max-w-5xl md:max-w-6xl lg:max-w-7xl'
                      : 'max-w-4xl md:max-w-5xl lg:max-w-6xl'
                    : isFullscreen
                    ? 'max-w-6xl md:max-w-7xl'
                    : 'max-w-5xl'
                }`}
                style={{
                  transform: `translate(${panOffset.x}px, ${panOffset.y}px) scale(${zoomScale})`,
                  transition: isPanning ? 'none' : 'transform 0.15s ease-out',
                }}
              >
                {/* Leather Cover Base */}
                <div className="real-book-cover-base" />

                {/* Opened Pages Block */}
                <div className={`real-book-block w-full relative overflow-hidden ${
                  isFullscreen ? 'min-h-[680px] md:min-h-[820px]' : 'min-h-[560px] md:min-h-[700px]'
                }`}>
                  {isSingle ? (
                    /* Single Page View */
                    <div
                      ref={pageContainerRef}
                      className="w-full h-full flex flex-col justify-between p-2 md:p-6 bg-[#FAF6EE] relative overflow-y-auto shelf-scrollbar max-h-[75vh] md:max-h-[82vh]"
                    >
                      {/* Ribbon Bookmark Indicator on Top Corner */}
                      {isCurrentBookmarked && (
                        <div
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleCurrentPageBookmark(currentPage);
                          }}
                          className="absolute top-0 right-8 z-40 cursor-pointer transition-transform hover:scale-110 drop-shadow-md"
                          title="Click to remove bookmark"
                        >
                          <div className="w-6 h-12 bg-gradient-to-b from-amber-600 to-amber-700 rounded-b-sm flex items-end justify-center pb-1">
                            <Bookmark className="w-3.5 h-3.5 text-white fill-white" />
                          </div>
                        </div>
                      )}

                      <div className="flex-1 flex items-center justify-center py-2 w-full">
                        <div
                          data-page-num={currentPage}
                          onPointerDown={(e) => handleHighlightPointerDown(e, currentPage)}
                          onPointerMove={handleHighlightPointerMove}
                          onPointerUp={handleHighlightPointerUp}
                          className={`relative inline-flex items-center justify-center max-w-full ${
                            isHighlighterActive ? 'cursor-crosshair select-none' : ''
                          }`}
                        >
                          <img
                            src={getPdfPageUrl(book.id, currentPage)}
                            alt={`Page ${currentPage}`}
                            className="max-w-full max-h-[65vh] md:max-h-[72vh] w-auto h-auto object-contain drop-shadow-md transition-all rounded-xs"
                          />
                          {renderPageHighlights(currentPage)}
                          {renderPageTextLayer(singlePageWords, currentPage)}
                          {renderPageLinks(singlePageLinks)}
                        </div>
                      </div>
                      <div className="mt-4 text-center border-t border-black/10 pt-3 flex items-center justify-between px-6 flex-shrink-0">
                        <span className="text-xs font-cinzel text-[#9C8E7E] truncate max-w-[220px]">
                          {book.title}
                        </span>
                        <span className="font-serif-heading text-base text-[#5C5346] font-semibold">
                          — Page {currentPage} of {totalPages} —
                        </span>
                        <span className="text-xs font-cinzel text-[#9C8E7E] truncate max-w-[220px]">
                          {book.author}
                        </span>
                      </div>

                      {currentPage > 1 && (
                        <div
                          onClick={(e) => {
                            e.stopPropagation();
                            handlePrevPage();
                          }}
                          className="page-curl-corner-left"
                          title="Previous Page"
                        />
                      )}
                      {currentPage < totalPages && (
                        <div
                          onClick={(e) => {
                            e.stopPropagation();
                            handleNextPage();
                          }}
                          className="page-curl-corner-right"
                          title="Next Page"
                        />
                      )}
                    </div>
                  ) : (
                    /* 2-Page Book Spread */
                    <>
                      <div className="real-book-spine-gutter" />
                      <div className="real-book-spine-seam" />

                      {/* Left Curved Page */}
                      <div className="real-book-left-page w-1/2 flex flex-col justify-between p-4 md:p-8 relative">
                        {/* Bookmark Ribbon on Left Page */}
                        {isLeftBookmarked && (
                          <div
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleCurrentPageBookmark(leftPageNum);
                            }}
                            className="absolute top-0 left-6 z-40 cursor-pointer transition-transform hover:scale-110 drop-shadow-md"
                            title="Click to remove bookmark"
                          >
                            <div className="w-5 h-10 bg-gradient-to-b from-amber-600 to-amber-700 rounded-b-sm flex items-end justify-center pb-1">
                              <Bookmark className="w-3 h-3 text-white fill-white" />
                            </div>
                          </div>
                        )}

                        <div className="flex-1 flex items-center justify-center overflow-hidden py-2">
                          <div
                            data-page-num={leftPageNum}
                            onPointerDown={(e) => handleHighlightPointerDown(e, leftPageNum)}
                            onPointerMove={handleHighlightPointerMove}
                            onPointerUp={handleHighlightPointerUp}
                            className={`relative inline-flex items-center justify-center max-h-full max-w-full ${
                              isHighlighterActive ? 'cursor-crosshair select-none' : ''
                            }`}
                          >
                            <img
                              src={getPdfPageUrl(book.id, leftPageNum)}
                              alt={`Page ${leftPageNum}`}
                              className={`w-auto object-contain drop-shadow-xs ${
                                isFullscreen ? 'max-h-[700px]' : 'max-h-[560px]'
                              }`}
                            />
                            {renderPageHighlights(leftPageNum)}
                            {renderPageTextLayer(leftPageWords, leftPageNum)}
                            {renderPageLinks(leftPageLinks)}
                          </div>
                        </div>
                        <div className="mt-3 text-center border-t border-black/5 pt-2 flex items-center justify-between px-4">
                          <span className="text-[10px] font-cinzel text-[#A89F91]">
                            {book.title}
                          </span>
                          <span className="font-serif-heading text-sm text-[#5C5346] font-semibold">
                            — {leftPageNum} —
                          </span>
                          <span className="w-8" />
                        </div>

                        {leftPageNum > 1 && (
                          <div
                            onClick={(e) => {
                              e.stopPropagation();
                              handlePrevPage();
                            }}
                            className="page-curl-corner-left"
                            title="Previous Page"
                          />
                        )}
                      </div>

                      {/* Right Curved Page */}
                      <div className="real-book-right-page w-1/2 flex flex-col justify-between p-4 md:p-8 relative">
                        {/* Bookmark Ribbon on Right Page */}
                        {isRightBookmarked && (
                          <div
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleCurrentPageBookmark(rightPageNum);
                            }}
                            className="absolute top-0 right-6 z-40 cursor-pointer transition-transform hover:scale-110 drop-shadow-md"
                            title="Click to remove bookmark"
                          >
                            <div className="w-5 h-10 bg-gradient-to-b from-amber-600 to-amber-700 rounded-b-sm flex items-end justify-center pb-1">
                              <Bookmark className="w-3 h-3 text-white fill-white" />
                            </div>
                          </div>
                        )}

                        {rightPageNum <= totalPages ? (
                          <>
                            <div className="flex-1 flex items-center justify-center overflow-hidden py-2">
                              <div
                                data-page-num={rightPageNum}
                                onPointerDown={(e) => handleHighlightPointerDown(e, rightPageNum)}
                                onPointerMove={handleHighlightPointerMove}
                                onPointerUp={handleHighlightPointerUp}
                                className={`relative inline-flex items-center justify-center max-h-full max-w-full ${
                                  isHighlighterActive ? 'cursor-crosshair select-none' : ''
                                }`}
                              >
                                <img
                                  src={getPdfPageUrl(book.id, rightPageNum)}
                                  alt={`Page ${rightPageNum}`}
                                  className={`w-auto object-contain drop-shadow-xs ${
                                    isFullscreen ? 'max-h-[700px]' : 'max-h-[560px]'
                                  }`}
                                />
                                {renderPageHighlights(rightPageNum)}
                                {renderPageTextLayer(rightPageWords, rightPageNum)}
                                {renderPageLinks(rightPageNum <= totalPages ? rightPageLinks : [])}
                              </div>
                            </div>
                            <div className="mt-3 text-center border-t border-black/5 pt-2 flex items-center justify-between px-4">
                              <span className="w-8" />
                              <span className="font-serif-heading text-sm text-[#5C5346] font-semibold">
                                — {rightPageNum} —
                              </span>
                              <span className="text-[10px] font-cinzel text-[#A89F91] truncate max-w-[120px]">
                                {book.author}
                              </span>
                            </div>

                            {rightPageNum < totalPages && (
                              <div
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleNextPage();
                                }}
                                className="page-curl-corner-right"
                                title="Next Page"
                              />
                            )}
                          </>
                        ) : (
                          <div className="flex-1 flex items-center justify-center text-[#9C8E7E] italic font-serif-heading text-lg">
                            End of Volume
                          </div>
                        )}
                      </div>

                      {/* 3D Animated Flipping Page Layer */}
                      {(isDragging || isAnimatingFlip) && dragProgress > 0 && (
                        <div
                          className="absolute top-0 bottom-0 z-40 bg-[#FAF6EE] shadow-2xl transition-transform duration-75 overflow-hidden flex flex-col justify-between p-4 md:p-8"
                          style={{
                            width: '50%',
                            left: dragDirection === 'next' ? '50%' : '0%',
                            transformOrigin: dragDirection === 'next' ? 'left center' : 'right center',
                            transform: `perspective(1600px) rotateY(${flipRotationAngle}deg)`,
                            boxShadow: '0 20px 40px rgba(0,0,0,0.35)',
                          }}
                        >
                          <div className="flex-1 flex items-center justify-center overflow-hidden py-2">
                            <img
                              src={getPdfPageUrl(
                                book.id,
                                dragDirection === 'next' ? rightPageNum : leftPageNum
                              )}
                              alt="Flipping page"
                              className={`w-auto object-contain ${
                                isFullscreen ? 'max-h-[700px]' : 'max-h-[560px]'
                              }`}
                            />
                          </div>

                          <div
                            className="absolute inset-0 pointer-events-none"
                            style={{
                              background: `linear-gradient(${
                                dragDirection === 'next' ? '90deg' : '-90deg'
                              }, rgba(0,0,0,${dragProgress * 0.4}) 0%, transparent 60%)`,
                            }}
                          />
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Slide-Out Notes & Bookmarks Sidebar Drawer */}
          {isDrawerOpen && (
            <div className="w-80 md:w-96 border-l border-[#E5DEC9] bg-[#F8F5EE] flex flex-col justify-between shadow-2xl z-30 animate-in slide-in-from-right duration-250 flex-shrink-0">
              {/* Drawer Header & Tabs */}
              <div className="p-4 border-b border-[#E5DEC9] flex flex-col gap-3 bg-[#F0EBE1]">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-[#1C1917] font-serif-display font-semibold text-base">
                    <NotebookPen className="w-4 h-4 text-[#C86D51]" />
                    <span>Reader Annotations</span>
                  </div>
                  <button
                    onClick={() => setIsDrawerOpen(false)}
                    className="p-1 rounded-md hover:bg-black/5 text-[#78716C]"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Tab Switcher */}
                <div className="flex items-center gap-1 p-0.5 rounded-lg bg-[#FAF6EE] border border-[#D8CEBE]">
                  <button
                    onClick={() => setActiveTab('notes')}
                    className={`flex-1 py-1.5 rounded-md font-cinzel text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
                      activeTab === 'notes' ? 'bg-[#C86D51] text-white shadow-xs' : 'text-[#78716C] hover:bg-black/5'
                    }`}
                  >
                    <NotebookPen className="w-3.5 h-3.5" />
                    <span>Notes ({notes.length})</span>
                  </button>
                  <button
                    onClick={() => setActiveTab('bookmarks')}
                    className={`flex-1 py-1.5 rounded-md font-cinzel text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
                      activeTab === 'bookmarks' ? 'bg-[#C86D51] text-white shadow-xs' : 'text-[#78716C] hover:bg-black/5'
                    }`}
                  >
                    <Bookmark className="w-3.5 h-3.5" />
                    <span>Bookmarks ({bookmarks.length})</span>
                  </button>
                </div>
              </div>

              {/* Drawer Body Content */}
              <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4 shelf-scrollbar">
                {activeTab === 'notes' ? (
                  <>
                    {/* Add Note Form for Current Page */}
                    <div className="bg-white p-3.5 rounded-2xl border border-[#E5DEC9] shadow-xs flex flex-col gap-2.5">
                      <div className="flex items-center justify-between text-xs font-cinzel text-[#4A4238] font-semibold">
                        <span>Add Note for Page {isSingle ? currentPage : leftPageNum}</span>
                        <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-800 text-[10px]">
                          Page {isSingle ? currentPage : leftPageNum}
                        </span>
                      </div>
                      <textarea
                        value={newNoteText}
                        onChange={(e) => setNewNoteText(e.target.value)}
                        placeholder="Write your thoughts, key quotes, or reading notes..."
                        rows={3}
                        className="w-full text-xs font-serif-heading p-2.5 rounded-xl border border-[#D8CEBE] bg-[#FAF8F5] focus:outline-none focus:ring-2 focus:ring-[#C86D51]/40 text-[#1C1917] resize-none"
                      />
                      <button
                        onClick={handleAddNote}
                        disabled={!newNoteText.trim()}
                        className="w-full py-2 rounded-xl bg-[#C86D51] hover:bg-[#B05B41] disabled:opacity-40 text-white font-cinzel text-xs font-semibold uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all shadow-xs"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Save Note</span>
                      </button>
                    </div>

                    {/* Saved Notes Timeline */}
                    <div className="flex flex-col gap-3 mt-2">
                      <h4 className="font-cinzel text-[11px] font-semibold uppercase tracking-wider text-[#9C8E7E]">
                        Saved Notes ({notes.length})
                      </h4>
                      {notes.length === 0 ? (
                        <div className="text-center py-8 text-[#9C8E7E] font-serif-heading italic text-sm">
                          No notes written yet. Add notes to capture your insights while reading!
                        </div>
                      ) : (
                        notes.map((note) => (
                          <div
                            key={note.id}
                            className="bg-white p-3.5 rounded-2xl border border-[#E5DEC9] shadow-xs flex flex-col gap-2 transition-all hover:border-[#C86D51]/50 group overflow-hidden max-w-full min-w-0"
                          >
                            <div className="flex items-center justify-between">
                              <button
                                onClick={() => changePage(note.page)}
                                className="px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-900 font-cinzel text-[10px] font-bold hover:bg-amber-200 transition-colors flex items-center gap-1"
                              >
                                <Tag className="w-2.5 h-2.5" />
                                <span>Page {note.page}</span>
                              </button>
                              <div className="flex items-center gap-2">
                                <span className="text-[10px] text-[#9C8E7E] font-cinzel">{note.createdAt}</span>
                                <button
                                  onClick={() => handleDeleteNote(note.id)}
                                  className="text-[#9C8E7E] hover:text-red-600 transition-colors p-1"
                                  title="Delete Note"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                            <p className="font-serif-heading text-sm text-[#1C1917] leading-relaxed whitespace-pre-wrap break-words [overflow-wrap:anywhere] overflow-hidden max-w-full min-w-0">
                              {note.text}
                            </p>
                          </div>
                        ))
                      )}
                    </div>
                  </>
                ) : (
                  /* Bookmarks List Tab */
                  <div className="flex flex-col gap-3">
                    <h4 className="font-cinzel text-[11px] font-semibold uppercase tracking-wider text-[#9C8E7E]">
                      Bookmarked Pages ({bookmarks.length})
                    </h4>
                    {bookmarks.length === 0 ? (
                      <div className="text-center py-8 text-[#9C8E7E] font-serif-heading italic text-sm">
                        No pages bookmarked yet. Click the Bookmark button in top toolbar to save pages!
                      </div>
                    ) : (
                      bookmarks.map((pNum) => (
                        <div
                          key={pNum}
                          onClick={() => changePage(pNum)}
                          className="bg-white p-3 rounded-2xl border border-[#E5DEC9] shadow-xs flex items-center justify-between cursor-pointer hover:border-[#C86D51] transition-all group"
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-amber-100 text-amber-800 font-cinzel font-bold text-xs flex items-center justify-center">
                              {pNum}
                            </div>
                            <div className="flex flex-col">
                              <span className="font-serif-heading text-sm font-semibold text-[#1C1917]">
                                Page {pNum}
                              </span>
                              <span className="font-cinzel text-[10px] text-[#9C8E7E]">
                                {book.title}
                              </span>
                            </div>
                          </div>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleCurrentPageBookmark(pNum);
                            }}
                            className="p-2 text-[#9C8E7E] hover:text-red-600 transition-colors"
                            title="Remove Bookmark"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>

              {/* Drawer Footer */}
              <div className="p-3 border-t border-[#E5DEC9] bg-[#F0EBE1] text-center font-cinzel text-[10px] text-[#9C8E7E]">
                Personal Reading Notes & Bookmarks
              </div>
            </div>
          )}
        </div>

        {/* Footer Bar */}
        {!isFullscreen && (
          <div className="flex items-center justify-between px-6 py-3 border-t border-[#E5DEC9] bg-[#F6F3ED] flex-shrink-0">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-[#E8E1D5] text-[#4A4238] border border-[#D8CEBE]">
                <FileText className="w-4 h-4" />
              </div>
              <div className="flex items-center gap-2 font-cinzel text-xs text-[#4A4238]">
                <span className="font-semibold truncate max-w-xs">{pdfInfo?.pdf_filename || `${book.title}.pdf`}</span>
                <span className="text-[#9C8E7E]">|</span>
                <span className="text-[#78716C]">{pdfInfo?.file_size || 'Archive Document'}</span>
              </div>
            </div>

            <button
              onClick={onClose}
              className="px-6 py-2 rounded-full border border-[#D8CEBE] bg-white hover:bg-[#1C1917] hover:text-[#FAF8F5] font-cinzel text-xs tracking-wider uppercase text-[#4A4238] transition-all shadow-xs"
            >
              Close Volume
            </button>
          </div>
        )}

        {/* Floating Context Toolbar Popover for Native Text Selection */}
        {selectedTextPopover && (
          <div
            className="fixed z-50 bg-[#1C1917] text-white px-3 py-1.5 rounded-xl shadow-2xl border border-amber-500/40 flex items-center gap-2 animate-in fade-in zoom-in-95 duration-150"
            style={{
              left: `${selectedTextPopover.x}px`,
              top: `${selectedTextPopover.y}px`,
              transform: 'translate(-50%, -100%)',
            }}
            onPointerDown={(e) => e.stopPropagation()}
            onPointerUp={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onMouseDown={(e) => e.preventDefault()}
              onClick={handleHighlightSelectedText}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/40 text-amber-200 text-xs font-cinzel font-semibold transition-colors border border-amber-500/30"
            >
              <Highlighter className="w-3.5 h-3.5" />
              <span>Highlight</span>
            </button>
            <button
              onMouseDown={(e) => e.preventDefault()}
              onClick={handleCopySelectedText}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs font-cinzel font-semibold transition-colors border border-white/20"
            >
              <Copy className="w-3.5 h-3.5" />
              <span>Copy</span>
            </button>
            <button
              onMouseDown={(e) => e.preventDefault()}
              onClick={handleNoteFromSelectedText}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs font-cinzel font-semibold transition-colors border border-white/20"
            >
              <NotebookPen className="w-3.5 h-3.5 text-amber-300" />
              <span>Note</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
