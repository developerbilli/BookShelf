export interface Book {
  id: number;
  title: string;
  author: string;
  genre: string;
  series?: string;
  series_order?: string;
  year?: number;
  status?: string;
  key_elements?: string;
  pdf_filename?: string;
  pdf_path?: string;
  has_pdf: boolean;
  cover_url?: string;
  synopsis?: string;
  rating: number;
  spine_color: string;
  spine_texture: string;
  spine_width: number;
  spine_height: number;
}

export interface PdfInfo {
  book_id: number;
  title: string;
  author: string;
  series?: string;
  series_order?: string;
  genre?: string;
  spine_color: string;
  pdf_filename: string;
  pdf_path?: string;
  file_size: string;
  page_count: number | string;
}

export interface Recommendation {
  id?: number;
  title: string;
  author: string;
  recommended_by?: string;
  note?: string;
  cover_url?: string;
  year?: number;
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export async function fetchBooks(search?: string, genre?: string): Promise<Book[]> {
  const params = new URLSearchParams();
  if (search) params.append('search', search);
  if (genre && genre !== 'ALL') params.append('genre', genre);
  
  const res = await fetch(`${API_BASE}/api/books?${params.toString()}`);
  if (!res.ok) throw new Error('Failed to fetch books');
  return res.json();
}

export async function fetchCategories(): Promise<Record<string, number>> {
  const res = await fetch(`${API_BASE}/api/books/categories`);
  if (!res.ok) throw new Error('Failed to fetch categories');
  return res.json();
}

export async function fetchBookDetail(id: number): Promise<Book> {
  const res = await fetch(`${API_BASE}/api/books/${id}`);
  if (!res.ok) throw new Error('Failed to fetch book detail');
  return res.json();
}

export async function fetchPdfInfo(id: number): Promise<PdfInfo> {
  const res = await fetch(`${API_BASE}/api/books/${id}/pdf-info`);
  if (!res.ok) throw new Error('Failed to fetch pdf info');
  return res.json();
}

export function getPdfPageUrl(id: number, pageNum: number): string {
  return `${API_BASE}/api/books/${id}/page/${pageNum}`;
}

export interface PdfPageLink {
  kind: 'goto' | 'uri';
  page?: number;
  uri?: string;
  bbox: [number, number, number, number];
}

export async function fetchPdfPageLinks(bookId: number, pageNum: number): Promise<PdfPageLink[]> {
  try {
    const res = await fetch(`${API_BASE}/api/books/${bookId}/page/${pageNum}/links`);
    if (!res.ok) return [];
    return await res.json();
  } catch {
    return [];
  }
}

export interface PdfPageWord {
  text: string;
  bbox: [number, number, number, number];
}

export async function fetchPdfPageWords(bookId: number, pageNum: number): Promise<PdfPageWord[]> {
  try {
    const res = await fetch(`${API_BASE}/api/books/${bookId}/page/${pageNum}/words`);
    if (!res.ok) return [];
    return await res.json();
  } catch {
    return [];
  }
}

export function getPdfUrl(id: number): string {
  return `${API_BASE}/api/books/${id}/pdf`;
}

export function getGoogleDrivePreviewUrl(pdfPath?: string | null): string | null {
  if (!pdfPath) return null;
  if (pdfPath.includes('drive.google.com')) {
    const match = pdfPath.match(/\/file\/d\/([^\/\?#]+)/) || pdfPath.match(/\/d\/([^\/\?#]+)/);
    if (match && match[1]) {
      return `https://drive.google.com/file/d/${match[1]}/preview`;
    }
  }
  if (pdfPath.startsWith('http')) {
    return pdfPath;
  }
  return null;
}

export async function submitRecommendation(rec: Recommendation): Promise<{ status: string }> {
  const res = await fetch(`${API_BASE}/api/recommendations/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(rec),
  });
  if (!res.ok) throw new Error('Failed to submit recommendation');
  return res.json();
}
