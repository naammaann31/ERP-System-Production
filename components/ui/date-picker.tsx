"use client"

import * as React from "react"
import { format, parse } from "date-fns"
import { Calendar as CalendarIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import { Calendar } from "@/components/ui/calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

interface DatePickerProps {
  value?: string
  onChange?: (date: string) => void
  placeholder?: string
  className?: string
  disabled?: boolean
}

export function DatePicker({
  value,
  onChange,
  placeholder = "Pick a date",
  className,
  disabled = false
}: DatePickerProps) {
  // Convert standard YYYY-MM-DD string to Date object
  const dateValue = value ? new Date(value) : undefined

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          disabled={disabled}
          className={cn(
            "flex h-10 w-full items-center justify-between rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm ring-offset-white focus:outline-none focus:ring-2 focus:ring-slate-950 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 hover:bg-slate-50 transition-colors",
            !value && "text-slate-500",
            className
          )}
        >
          {dateValue ? format(dateValue, "PP") : <span>{placeholder}</span>}
          <CalendarIcon className="h-4 w-4 text-slate-500 opacity-70" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={dateValue}
          onSelect={(newDate) => {
            if (onChange) {
              if (newDate) {
                // Ensure correct local YYYY-MM-DD format
                const offset = newDate.getTimezoneOffset()
                const formattedDate = new Date(newDate.getTime() - (offset*60*1000)).toISOString().split('T')[0]
                onChange(formattedDate)
              } else {
                onChange("")
              }
            }
          }}
          initialFocus
        />
      </PopoverContent>
    </Popover>
  )
}
