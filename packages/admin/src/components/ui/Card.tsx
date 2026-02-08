'use client';

interface CardProps {
  className?: string;
  children: React.ReactNode;
  padding?: string;
}

/**
 * Reusable card wrapper with consistent styling.
 */
export function Card({ className = '', children, padding = 'p-6' }: CardProps) {
  return (
    <div
      className={`rounded-xl border border-gray-200 bg-white shadow-sm ${padding} ${className}`}
    >
      {children}
    </div>
  );
}
