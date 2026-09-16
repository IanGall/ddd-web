import React from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { XIcon } from 'lucide-react';

export interface ClearableSelectOption<T> {
  label: React.ReactNode;
  value: T;
  disabled?: boolean;
}

export interface ClearableSelectProps<T> {
  value: T | null | undefined;
  onChange: (value: T | null) => void;
  options: ClearableSelectOption<T>[];
  placeholder?: string;
  disabled?: boolean;
  allowClear?: boolean; // 默认 true
  className?: string; // 传给的 SelectTrigger
  id?: string; // 供 FieldLabel htmlFor 关联
  'aria-invalid'?: boolean;
}

export function ClearableSelect<T>({
  value,
  onChange,
  options,
  placeholder,
  disabled = false,
  allowClear = true,
  className,
  id,
  'aria-invalid': ariaInvalid,
}: ClearableSelectProps<T>) {
  const hasValue = value !== null && value !== undefined;
  const showClear = allowClear && hasValue && !disabled;

  const handleClear = (e: React.MouseEvent | React.PointerEvent | React.KeyboardEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onChange(null);
  };

  return (
    <Select<T>
      items={options}
      value={value ?? null}
      onValueChange={(val) => onChange((val ?? null) as T | null)}
      disabled={disabled}
    >
      <SelectTrigger id={id} aria-invalid={ariaInvalid} className={className}>
        <SelectValue placeholder={placeholder} />
        {showClear && (
          <span
            role="button"
            aria-label="Clear"
            tabIndex={-1}
            className="pointer-events-auto flex items-center justify-center rounded-sm text-muted-foreground hover:text-foreground"
            onClick={handleClear}
            onPointerDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
            onMouseDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                handleClear(e);
              }
            }}
          >
            <XIcon className="pointer-events-auto size-3.5" />
          </span>
        )}
      </SelectTrigger>
      <SelectContent>
        {options.map((option, index) => (
          <SelectItem
            key={`${String(option.value)}-${index}`}
            value={option.value}
            disabled={option.disabled}
          >
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
