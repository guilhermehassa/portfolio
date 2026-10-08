"use client";

import type { InputHTMLAttributes, MouseEvent } from "react";

export function PickerInput({
  type,
  displayValue,
  ...props
}: Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & {
  type: "date" | "week" | "month";
  displayValue?: string;
}) {
  const openPicker = (event: MouseEvent<HTMLInputElement>) => {
    try {
      event.currentTarget.showPicker();
    } catch {
      event.currentTarget.focus();
    }
  };

  return (
    <span className={`motorista-picker${displayValue ? " is-formatted" : ""}`}>
      <input {...props} type={type} onClick={openPicker} />
      {displayValue && (
        <span className="motorista-picker-value" aria-hidden="true">
          {displayValue}
        </span>
      )}
      <svg aria-hidden="true" viewBox="0 0 24 24" fill="none">
        <rect x="3" y="5" width="18" height="16" rx="2" />
        <path d="M7 3v4M17 3v4M3 10h18" />
      </svg>
    </span>
  );
}
