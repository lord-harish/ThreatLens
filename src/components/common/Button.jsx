import React from 'react';

export function Button({
  children,
  variant = 'primary', // 'primary', 'secondary', 'accent', 'outline', 'danger'
  size = 'md', // 'sm', 'md', 'lg'
  disabled = false,
  loading = false,
  icon: Icon,
  className = '',
  onClick,
  type = 'button',
  ...props
}) {
  const baseStyles = 'inline-flex items-center justify-center font-mono font-medium rounded-xs select-none disabled:opacity-50 disabled:cursor-not-allowed border transition-colors';

  const variants = {
    primary: 'bg-[#0f172a] text-white border-[#0f172a] hover:bg-[#1e293b]',
    secondary: 'bg-[#fefcfd] text-[#0f172a] border-[#decdd4] hover:bg-[#f2e8ec]',
    accent: 'bg-[#0369a1] text-white border-[#0369a1] hover:bg-[#0284c7]',
    outline: 'bg-transparent text-[#334155] border-[#decdd4] hover:bg-[#f2e8ec]',
    danger: 'bg-[#9f1239] text-white border-[#9f1239] hover:bg-[#881337]'
  };

  const sizes = {
    sm: 'text-[11px] px-2.5 py-1 gap-1.5',
    md: 'text-xs px-3.5 py-1.5 gap-2',
    lg: 'text-sm px-4 py-2 gap-2'
  };

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${className}`}
      {...props}
    >
      {loading ? (
        <span className="w-3.5 h-3.5 border-2 border-current border-t-transparent animate-spin rounded-full" />
      ) : Icon ? (
        <Icon className="w-3.5 h-3.5 shrink-0" />
      ) : null}
      <span>{children}</span>
    </button>
  );
}
