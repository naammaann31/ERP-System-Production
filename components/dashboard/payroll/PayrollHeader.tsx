import { Search, CalendarDays, ChevronDown, Check } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useState, useRef, useEffect } from "react";

interface PayrollHeaderProps {
  searchQuery: string;
  setSearchQuery: (val: string) => void;
  filterMonth: string;
  setFilterMonth: (val: string) => void;
  monthOptions: { label: string; value: string }[];
}

export default function PayrollHeader({
  searchQuery,
  setSearchQuery,
  filterMonth,
  setFilterMonth,
  monthOptions
}: PayrollHeaderProps) {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="flex flex-col sm:flex-row gap-3 w-full items-stretch sm:justify-end">
      <div className="relative w-full sm:w-64">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
        <input
          type="text"
          placeholder="Search employee..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-medium placeholder:text-slate-400 shadow-sm h-10"
        />
      </div>

      <div className="relative w-full sm:w-auto" ref={dropdownRef}>
        <button 
          onClick={() => setDropdownOpen(!dropdownOpen)}
          className="w-full md:w-auto bg-white flex items-center justify-between h-10 rounded-xl border border-slate-200 pl-4 pr-3 py-2 text-sm text-slate-800 font-semibold cursor-pointer hover:bg-slate-50 transition-all focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 min-w-[200px] shadow-sm"
        >
          <div className="flex items-center">
            <CalendarDays className="h-4 w-4 text-slate-400 mr-2" />
            {monthOptions.find(opt => opt.value === filterMonth)?.label || "Select Month"}
          </div>
          <ChevronDown className={`h-4 w-4 text-slate-400 transition-transform duration-200 ${dropdownOpen ? 'rotate-180' : ''}`} />
        </button>
        
        <AnimatePresence>
          {dropdownOpen && (
            <motion.div
              initial={{ opacity: 0, y: -10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.95 }}
              transition={{ duration: 0.15, ease: "easeOut" }}
              className="absolute right-0 mt-2 w-full md:w-56 bg-white rounded-xl shadow-xl border border-slate-100 py-1.5 z-50 overflow-hidden"
            >
              {monthOptions.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => {
                    setFilterMonth(opt.value);
                    setDropdownOpen(false);
                  }}
                  className={`w-full text-left px-4 py-2.5 text-sm font-medium transition-colors flex items-center justify-between ${
                    filterMonth === opt.value 
                      ? 'bg-blue-50/50 text-blue-700' 
                      : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                  }`}
                >
                  {opt.label}
                  {filterMonth === opt.value && <Check className="w-4 h-4 text-blue-600" />}
                </button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
