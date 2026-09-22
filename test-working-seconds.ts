import { parseTimestamp, computeWorkedSeconds } from './lib/attendance';

console.log("Testing computeWorkedSeconds logic\\n");

const tests = [
  { name: "Test D: 7:35 PM check-in", in: "2026-09-21T19:35:00.000", out: "2026-09-22T05:00:00.000", expected: "9h 25m" },
  { name: "Test E: 8:30 PM check-in", in: "2026-09-21T20:30:00.000", out: "2026-09-22T05:00:00.000", expected: "8h 30m" },
  { name: "Test F: 11:30 PM check-in", in: "2026-09-21T23:30:00.000", out: "2026-09-22T05:00:00.000", expected: "5h 30m" },
  { name: "Test Extra: 1:27 AM check-in", in: "2026-09-22T01:27:00.000", out: "2026-09-22T05:00:00.000", expected: "3h 33m" },
];

for (const t of tests) {
  const seconds = computeWorkedSeconds({
    checkInTime: t.in,
    checkOutTime: t.out,
    workingSeconds: 0
  });
  
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  
  console.log(`${t.name}:`);
  console.log(`  Calculated: ${h}h ${m}m`);
  console.log(`  Expected:   ${t.expected}`);
  console.log(`  Match:      ${`${h}h ${m}m` === t.expected ? 'YES' : 'NO'}\\n`);
}
