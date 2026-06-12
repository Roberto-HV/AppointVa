import {
  useState,
  useRef,
  useEffect,
  Children,
  isValidElement,
  forwardRef,
  useCallback,
} from "react";
import { ChevronDown, Check } from "lucide-react";

interface OptionData {
  value: string;
  label: string;
  disabled?: boolean;
}

function parseOptions(children: React.ReactNode): OptionData[] {
  const result: OptionData[] = [];
  Children.forEach(children, (child) => {
    if (!isValidElement(child)) return;
    const el = child as React.ReactElement<{
      value?: string | number;
      children?: React.ReactNode;
      disabled?: boolean;
    }>;
    if (el.type === "option") {
      result.push({
        value: String(el.props.value ?? ""),
        label: String(el.props.children ?? ""),
        disabled: el.props.disabled,
      });
    }
  });
  return result;
}

interface SelectProps extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, "className"> {
  className?: string;
}

const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ className = "", children, value, onChange, onBlur, disabled, ...props }, ref) => {
    const [open, setOpen] = useState(false);
    const [displayValue, setDisplayValue] = useState<string>(
      value !== undefined ? String(value) : ""
    );
    const containerRef = useRef<HTMLDivElement>(null);
    const nativeRef = useRef<HTMLSelectElement>(null);

    const mergeRef = useCallback(
      (el: HTMLSelectElement | null) => {
        nativeRef.current = el;
        if (typeof ref === "function") ref(el);
        else if (ref) (ref as React.MutableRefObject<HTMLSelectElement | null>).current = el;
      },
      [ref]
    );

    // Sync display when controlled `value` prop changes
    useEffect(() => {
      if (value !== undefined) setDisplayValue(String(value));
    }, [value]);

    const options = parseOptions(children);
    const selected = options.find((o) => o.value === displayValue);
    const isPlaceholder = !selected || selected.value === "";

    // Close on outside click
    useEffect(() => {
      if (!open) return;
      const handler = (e: MouseEvent) => {
        if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
          setOpen(false);
        }
      };
      document.addEventListener("mousedown", handler);
      return () => document.removeEventListener("mousedown", handler);
    }, [open]);

    // Close on Escape
    useEffect(() => {
      if (!open) return;
      const handler = (e: KeyboardEvent) => {
        if (e.key === "Escape") setOpen(false);
      };
      document.addEventListener("keydown", handler);
      return () => document.removeEventListener("keydown", handler);
    }, [open]);

    const handleOptionClick = (optValue: string) => {
      setDisplayValue(optValue);
      setOpen(false);
      if (nativeRef.current) {
        nativeRef.current.value = optValue;
        // Trigger React/react-hook-form onChange via native event
        nativeRef.current.dispatchEvent(new Event("change", { bubbles: true }));
      }
    };

    return (
      <div ref={containerRef} className={`relative ${className}`}>
        {/* Hidden native select — carries name/ref/onChange for form libraries */}
        <select
          ref={mergeRef}
          onChange={onChange}
          onBlur={onBlur}
          disabled={disabled}
          aria-hidden="true"
          tabIndex={-1}
          className="sr-only"
          {...props}
        >
          {children}
        </select>

        {/* Visible trigger */}
        <button
          type="button"
          onClick={() => !disabled && setOpen((o) => !o)}
          disabled={disabled}
          className={[
            "w-full flex items-center justify-between pl-4 pr-3 py-2.5",
            "rounded-xl border bg-white text-sm text-left shadow-sm outline-none transition-all duration-150",
            open
              ? "border-primary ring-2 ring-primary/20"
              : "border-gray-200 hover:border-gray-300",
            disabled
              ? "bg-gray-50 text-gray-400 cursor-not-allowed opacity-60"
              : "cursor-pointer",
          ].join(" ")}
        >
          <span className={isPlaceholder ? "text-gray-400" : "text-gray-700"}>
            {isPlaceholder ? (selected?.label ?? "Seleccionar...") : selected!.label}
          </span>
          <ChevronDown
            size={16}
            className={`shrink-0 ml-2 text-gray-400 transition-transform duration-200 ${
              open ? "rotate-180" : ""
            }`}
          />
        </button>

        {/* Dropdown panel */}
        {open && (
          <div className="absolute z-[200] top-full mt-1.5 left-0 right-0 bg-white border border-gray-100 rounded-xl shadow-xl overflow-hidden">
            <ul className="py-1.5 max-h-60 overflow-y-auto">
              {options.map((opt) => {
                const isSelected = opt.value === displayValue;
                return (
                  <li key={opt.value}>
                    <button
                      type="button"
                      disabled={opt.disabled}
                      onClick={() => !opt.disabled && handleOptionClick(opt.value)}
                      className={[
                        "w-full flex items-center justify-between px-4 py-2.5 text-sm text-left transition-colors",
                        opt.disabled
                          ? "text-gray-300 cursor-not-allowed"
                          : isSelected
                          ? "bg-primary/10 text-primary font-medium"
                          : "text-gray-700 hover:bg-gray-50 cursor-pointer",
                      ].join(" ")}
                    >
                      <span>{opt.label}</span>
                      {isSelected && (
                        <Check size={14} className="text-primary shrink-0 ml-2" />
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </div>
    );
  }
);

Select.displayName = "Select";
export default Select;
