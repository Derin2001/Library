
import React from 'react';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  title?: string;
}

const Card: React.FC<CardProps> = ({ children, className, title }) => {
  return (
    <div className={`bg-white dark:bg-slate-900 rounded-xl shadow-md border border-slate-200 dark:border-slate-800 p-6 ${className}`}>
      {title && <h2 className="text-xl font-semibold text-slate-800 dark:text-slate-100 mb-4">{title}</h2>}
      {children}
    </div>
  );
};

export default Card;