import React from 'react';

export type ActivePortalSection =
  | 'home'
  | 'status'
  | 'chat'
  | 'admin';

interface TopBarProps {
  activeSection: ActivePortalSection;
  onNavigateHome: () => void;
  onScrollToSection: (sectionId: string) => void;
  onOpenAdmin: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({
  activeSection,
  onNavigateHome,
  onScrollToSection,
  onOpenAdmin,
}) => {
  return (
    <header className="flex items-center justify-between gap-8 px-6 py-4 border-b border-slate-800/80 bg-slate-950/95 sticky top-0 z-40 backdrop-blur-md">
      {/* Zone 1: Single text element wordmark */}
      <a
        href="#top"
        onClick={(e) => {
          e.preventDefault();
          onNavigateHome();
        }}
        className="text-xl font-bold tracking-tight text-white font-display whitespace-nowrap shrink-0 hover:text-amber-400 transition-colors"
      >
        SHOP TAH
      </a>

      {/* Zone 2: 4–5 clean single-line text navigation links */}
      <nav
        aria-label="Điều hướng chính"
        className="hidden md:flex items-center gap-7 text-sm font-medium text-slate-300"
      >
        <a
          href="#lookup-panel"
          onClick={(e) => {
            e.preventDefault();
            onScrollToSection('lookup-panel');
          }}
          className="hover:text-white hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
        >
          Tra Cứu & Nhắn Tin
        </a>
        <a
          href="#rubik-lineup"
          onClick={(e) => {
            e.preventDefault();
            onScrollToSection('rubik-lineup');
          }}
          className="hover:text-white hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
        >
          Dòng Rubik Flagship
        </a>
        <a
          href="#cuber-reviews"
          onClick={(e) => {
            e.preventDefault();
            onScrollToSection('cuber-reviews');
          }}
          className="hover:text-white hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
        >
          Đánh Giá Cuber
        </a>
        <a
          href="#admin-portal"
          onClick={(e) => {
            e.preventDefault();
            onOpenAdmin();
          }}
          className="hover:text-white hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
        >
          Cổng Quản Trị
        </a>
      </nav>

      {/* Zone 3: 1 primary action */}
      <div className="flex items-center gap-3 shrink-0">
        {activeSection === 'admin' ? (
          <button
            type="button"
            onClick={onNavigateHome}
            className="px-4 py-2 text-xs font-semibold text-slate-950 bg-amber-400 rounded-lg hover:bg-amber-300 transition-colors whitespace-nowrap shrink-0"
          >
            Về Trang Khách Hàng
          </button>
        ) : (
          <button
            type="button"
            onClick={onOpenAdmin}
            className="px-4 py-2 text-xs font-semibold text-white bg-slate-800 border border-slate-700 rounded-lg hover:bg-slate-700 transition-colors whitespace-nowrap shrink-0"
          >
            Quản Trị SHOP TAH
          </button>
        )}
      </div>
    </header>
  );
};
