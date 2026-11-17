import "../globals.css";

export const metadata = {
  title: "Print LJK - WMVAA AI Grader Pro",
  description: "Halaman cetak Lembar Jawaban Komputer AKM",
};

/**
 * PrintLayout — sub-layout untuk rute /print/*
 * 
 * CATATAN PENTING: Di Next.js App Router, hanya root layout yang boleh
 * merender <html> dan <body>. Sub-layout cukup mengembalikan children.
 * 
 * Styling khusus print (bg-white, margin:0) diterapkan via:
 * 1. className pada wrapper div (terlihat di screen preview)
 * 2. @media print CSS di masing-masing page (terlihat saat di-print)
 */
export default function PrintLayout({ children }: { children: React.ReactNode }) {
  return (
    // Wrapper print: bg-white agar preview di browser terlihat putih bersih
    <div className="print-layout-wrapper bg-white text-black min-h-screen" style={{ margin: 0, padding: 0 }}>
      {children}
    </div>
  );
}
