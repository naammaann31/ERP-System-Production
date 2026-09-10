export const HOLIDAYS = [
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
  { month: 7, date: 28, name: "Raksha bandhan", type: "optional" },
  // Employee Birthdays
  { month: 5, date: 13, name: "Asrar Patni's Birthday", type: "birthday" },
  { month: 0, date: 21, name: "Sathi Biswas's Birthday", type: "birthday" },
  { month: 8, date: 5, name: "Pritesh Senjaliya's Birthday", type: "birthday" },
  { month: 7, date: 4, name: "Damini Mallick's Birthday", type: "birthday" },
  { month: 11, date: 14, name: "Piyush Barad's Birthday", type: "birthday" },
  { month: 3, date: 4, name: "Jaynish Vaghela's Birthday", type: "birthday" },
  { month: 7, date: 21, name: "Krushna Ch. Parida's Birthday", type: "birthday" },
  { month: 10, date: 6, name: "Rohit Khundia's Birthday", type: "birthday" },
  { month: 6, date: 15, name: "Mohammed Hamzah Saiyed's Birthday", type: "birthday" },
  { month: 6, date: 17, name: "Naman Trivedi's Birthday", type: "birthday" },
  { month: 11, date: 25, name: "Saniya Banu's Birthday", type: "birthday" },
  { month: 4, date: 21, name: "Apoorv Giri's Birthday", type: "birthday" },
  { month: 2, date: 7, name: "Piyush Soni's Birthday", type: "birthday" },
  { month: 10, date: 21, name: "Munish Kumar's Birthday", type: "birthday" },
  { month: 9, date: 18, name: "Himanshu Gaur's Birthday", type: "birthday" },
  { month: 9, date: 1, name: "Anisha Parveen's Birthday", type: "birthday" },
  { month: 8, date: 24, name: "Medha Raina's Birthday", type: "birthday" },
  { month: 0, date: 25, name: "Ishita Sanya's Birthday", type: "birthday" },
  { month: 8, date: 15, name: "Muskan bagban's Birthday", type: "birthday" },
  { month: 8, date: 13, name: "Shadab Shaikh's Birthday", type: "birthday" },
  { month: 8, date: 17, name: "Sapna Bajpai's Birthday", type: "birthday" },
  { month: 4, date: 5, name: "Nidhi Watwani's Birthday", type: "birthday" },
  { month: 8, date: 24, name: "Shweta Sharma's Birthday", type: "birthday" },
  { month: 9, date: 14, name: "Dolly mohanlal Manani's Birthday", type: "birthday" },
  { month: 2, date: 28, name: "Yuvi D Pandya's Birthday", type: "birthday" },
  { month: 4, date: 18, name: "Dhanesh Joshi's Birthday", type: "birthday" },
  { month: 4, date: 26, name: "Honey Thakur's Birthday", type: "birthday" },
  { month: 11, date: 18, name: "Yudhisthir Soni's Birthday", type: "birthday" }
];

/**
 * Checks if a given date string (YYYY-MM-DD) is a US holiday.
 * Returns the name of the holiday if it is, otherwise null.
 */
export const getUsHolidayName = (dateStr: string): string | null => {
  const [year, month, day] = dateStr.split('-');
  const m = parseInt(month, 10) - 1; // 0-indexed
  const d = parseInt(day, 10);
  
  const holiday = HOLIDAYS.find(h => h.month === m && h.date === d && h.type === 'us');
  return holiday ? holiday.name : null;
};
