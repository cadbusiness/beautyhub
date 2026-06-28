export function AppFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="mt-auto shrink-0 border-t border-slate-200 bg-slate-50 px-4 py-4 text-center text-xs text-slate-400 lg:px-6">
      © {year} BeautyHub. Tous droits réservés.
    </footer>
  );
}
