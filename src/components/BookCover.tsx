import { useState } from 'react';
import { BookOpen } from 'lucide-react';
import type { Book } from '../types';

interface BookCoverProps {
  book: Pick<Book, 'title' | 'author' | 'category' | 'year' | 'coverUrl'>;
  className?: string;
}

export function BookCover({ book, className = '' }: BookCoverProps) {
  const [imgError, setImgError] = useState(false);

  if (book.coverUrl && !imgError) {
    return (
      <div
        className={`relative overflow-hidden bg-[#F3EFE7] border border-[#E6E0D4] ${className}`}
      >
        <img
          src={book.coverUrl}
          alt={`Sampul buku ${book.title}`}
          referrerPolicy="no-referrer"
          onError={() => setImgError(true)}
          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
        />
      </div>
    );
  }

  return (
    <div
      className={`relative flex flex-col justify-between overflow-hidden bg-[#F3EFE7] border border-[#E6E0D4] p-5 text-[#1C1917] ${className}`}
    >
      <div className="flex items-center justify-between text-[11px] font-mono text-[#57534E] border-b border-[#D6CEBE] pb-2.5">
        <span className="truncate">{book.category}</span>
        <span className="tabular-nums shrink-0">{book.year}</span>
      </div>

      <div className="my-auto py-3">
        <BookOpen className="w-5 h-5 text-[#1E3A8A] mb-3" aria-hidden="true" />
        <p className="font-serif text-base leading-snug font-semibold text-[#1C1917] line-clamp-4">
          {book.title}
        </p>
      </div>

      <div className="border-t border-[#D6CEBE] pt-2.5 text-xs text-[#57534E] truncate">
        {book.author}
      </div>
    </div>
  );
}
