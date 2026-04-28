"use client";

import { useRef, createContext, useContext } from "react";
import { useReactToPrint } from "react-to-print";

interface PrintContextValue {
  handlePrint: () => void;
}

const PrintContext = createContext<PrintContextValue>({ handlePrint: () => {} });

export function usePrintReport() {
  return useContext(PrintContext);
}

interface PrintableReportShellProps {
  children: React.ReactNode;
  title: string;
  period: string;
  businessName: string;
  logoUrl?: string | null;
}

export function PrintableReportShell({
  children,
  title,
  period,
  businessName,
  logoUrl,
}: PrintableReportShellProps) {
  const contentRef = useRef<HTMLDivElement>(null);
  const handlePrint = useReactToPrint({
    contentRef,
    documentTitle: `${businessName} - ${title} - ${period}`,
  });

  return (
    <PrintContext.Provider value={{ handlePrint }}>
      <div ref={contentRef}>

        {/* ── Print-only branded header ── */}
        <div className="hidden print:block px-0 pb-5 mb-6 border-b-2 border-[#0DA2E7]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {logoUrl ? (
                <img
                  src={logoUrl}
                  alt={businessName}
                  className="h-12 w-auto object-contain"
                />
              ) : (
                <div className="flex items-center gap-2">
                  <div
                    style={{ background: "#0DA2E7" }}
                    className="w-9 h-9 rounded-xl flex items-center justify-center"
                  >
                    <span className="text-white font-bold text-base">T</span>
                  </div>
                  <span className="font-bold text-xl" style={{ color: "#0DA2E7" }}>
                    TrailBill
                  </span>
                </div>
              )}
            </div>
            <div className="text-right">
              <p className="text-xl font-bold text-gray-900">{title}</p>
              <p className="text-sm text-gray-500 mt-0.5">
                {businessName}&nbsp;&middot;&nbsp;{period}
              </p>
            </div>
          </div>
        </div>

        {children}

        {/* ── Print-only footer ── */}
        <div className="hidden print:block mt-12 pt-4 border-t border-gray-200">
          <div className="flex items-center justify-between text-xs text-gray-400">
            <span>
              Powered by{" "}
              <span className="font-semibold" style={{ color: "#0DA2E7" }}>TrailBill</span>
              {" "}·{" "}
              <span>www.trailbill.com</span>
            </span>
            <span>
              {new Date().toLocaleDateString("en-ZA", {
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
            </span>
          </div>
        </div>

      </div>
    </PrintContext.Provider>
  );
}
