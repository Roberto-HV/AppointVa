import { type ReactNode } from "react";

interface TooltipProps {
  text: string;
  children: ReactNode;
  position?: "top" | "bottom";
}

export function Tooltip({ text, children, position = "top" }: TooltipProps) {
  return (
    <div className="relative group inline-flex">
      {children}
      <div
        className={`
          absolute z-50 px-2 py-1 text-xs text-white bg-gray-900 rounded-md whitespace-nowrap
          opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity duration-150 delay-100
          left-1/2 -translate-x-1/2
          ${position === "top" ? "bottom-full mb-2" : "top-full mt-2"}
        `}
      >
        {text}
        <span
          className={`
            absolute left-1/2 -translate-x-1/2 border-4 border-transparent
            ${position === "top" ? "top-full border-t-gray-900" : "bottom-full border-b-gray-900"}
          `}
        />
      </div>
    </div>
  );
}
