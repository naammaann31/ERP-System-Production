"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

const HOLIDAYS = [
  // US Holidays
  { month: 0, date: 1, name: "New Year's Day", type: "us" },
  { month: 0, date: 19, name: "Martin Luther King Jr. Day", type: "us" },
  { month: 4, date: 25, name: "Memorial Day", type: "us" },
  { month: 6, date: 3, name: "Independence Day (Observed)", type: "us" },
  { month: 8, date: 7, name: "Labor Day", type: "us" },
  { month: 10, date: 11, name: "Veterans Day", type: "us" },
  { month: 10, date: 26, name: "Thanksgiving Day", type: "us" },
  { month: 11, date: 25, name: "Christmas Day", type: "us" },
  // Indian Holidays
  { month: 2, date: 4, name: "Holi", type: "indian" },
  { month: 9, date: 2, name: "Gandhi Jayanti", type: "indian" },
  { month: 9, date: 20, name: "Dussehra", type: "indian" },
  { month: 10, date: 9, name: "New Year (Gujarati)", type: "indian" },
  // Optional Holidays
  { month: 0, date: 14, name: "Makar Sankrant", type: "optional" },
  { month: 2, date: 21, name: "Eid", type: "optional" },
  { month: 4, date: 27, name: "Bakri Eid", type: "optional" },
  { month: 7, date: 28, name: "Raksha bandhan", type: "optional" }
];

export default function CalendarWidget() {
  const days = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];
  
  const [viewDate, setViewDate] = useState(new Date());
  const today = new Date();

  const handlePrevMonth = () => {
    setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1));
  };

  const getDaysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();
  const getFirstDayOfMonth = (year: number, month: number) => {
    const day = new Date(year, month, 1).getDay();
    return day === 0 ? 6 : day - 1;
  };

  const currentYear = viewDate.getFullYear();
  const currentMonth = viewDate.getMonth();
  
  const daysInMonth = getDaysInMonth(currentYear, currentMonth);
  const firstDay = getFirstDayOfMonth(currentYear, currentMonth);
  
  const prevMonthDays = getDaysInMonth(currentYear, currentMonth - 1);
  
  const dates = [];
  
  // Previous month padding
  for (let i = 0; i < firstDay; i++) {
    dates.push({ 
      date: prevMonthDays - firstDay + i + 1, 
      currentMonth: false, 
      isToday: false, 
      holiday: null 
    });
  }
  
  // Current month
  for (let i = 1; i <= daysInMonth; i++) {
    const isToday = today.getDate() === i && today.getMonth() === currentMonth && today.getFullYear() === currentYear;
    
    // Find holiday
    const holiday = HOLIDAYS.find(h => h.month === currentMonth && h.date === i);
    
    dates.push({ 
      date: i, 
      currentMonth: true, 
      isToday, 
      holiday: holiday || null
    });
  }
  
  // Next month padding
  const remainingCells = 42 - dates.length; // 6 rows of 7
  for (let i = 1; i <= remainingCells; i++) {
    dates.push({ 
      date: i, 
      currentMonth: false, 
      isToday: false, 
      holiday: null 
    });
  }

  const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

  return (
    <div className="bg-white rounded-2xl p-6 border border-slate-200/60 shadow-md flex flex-col h-full">
      <div className="flex justify-between items-center mb-5">
        <h3 className="font-black text-slate-800 text-lg">Calendar</h3>
        <div className="flex items-center gap-3">
          <span className="text-sm font-bold text-slate-700">{monthNames[currentMonth]} {currentYear}</span>
          <div className="flex gap-1.5">
            <button onClick={handlePrevMonth} className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-500 transition-colors"><ChevronLeft className="h-4 w-4" /></button>
            <button onClick={handleNextMonth} className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-500 transition-colors"><ChevronRight className="h-4 w-4" /></button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-y-2 mb-4 flex-1 items-start">
        {days.map((d, i) => (
          <div key={i} className="text-center text-xs font-bold text-slate-400 mb-2">{d}</div>
        ))}
        {dates.map((d, i) => (
          <div key={i} className="flex justify-center items-center">
            <div 
              className={`
                w-9 h-9 flex flex-col items-center justify-center rounded-xl text-xs font-semibold relative transition-all duration-200
                ${!d.currentMonth ? 'text-slate-300' : 'text-slate-700'}
                ${d.isToday ? 'bg-slate-900 text-white font-black shadow-lg' : 'hover:bg-slate-50 cursor-pointer'}
              `}
              title={d.holiday ? d.holiday.name : undefined}
            >
              <span className={d.holiday && !d.isToday ? "-translate-y-1" : ""}>{d.date}</span>
              {d.holiday && !d.isToday && (
                <div className={`absolute bottom-1.5 w-1.5 h-1.5 rounded-full ${
                  d.holiday.type === 'us' ? 'bg-blue-500' :
                  d.holiday.type === 'indian' ? 'bg-pink-500' :
                  d.holiday.type === 'optional' ? 'bg-amber-500' : ''
                }`} />
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-auto flex justify-between px-2 pt-4 border-t border-slate-100">
        <div className="flex items-center gap-2 text-[11px] text-slate-600 font-semibold"><div className="w-2 h-2 rounded-full bg-blue-500" /> US Holiday</div>
        <div className="flex items-center gap-2 text-[11px] text-slate-600 font-semibold"><div className="w-2 h-2 rounded-full bg-pink-500" /> Indian Holiday</div>
        <div className="flex items-center gap-2 text-[11px] text-slate-600 font-semibold"><div className="w-2 h-2 rounded-full bg-amber-500" /> Optional</div>
      </div>
    </div>
  );
}
