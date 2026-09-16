import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { XIcon } from 'lucide-react';
import { cn } from 'cn';

export interface TagInputProps {
  value: string[];
  onChange: (value: string[]) => void;
  placeholder?: string;
  disabled?: boolean;
  maxVisible?: number; // 超出显示 +N，默认 3
  className?: string;
  id?: string;
  'aria-invalid'?: boolean;
}

export function TagInput({
  value,
  onChange,
  placeholder,
  disabled = false,
  maxVisible = 3,
  className,
  id,
  'aria-invalid': ariaInvalid,
}: TagInputProps) {
  const [inputValue, setInputValue] = React.useState('');
  const inputRef = React.useRef<HTMLInputElement>(null);

  const tags = value || [];
  const visibleTags = tags.slice(0, maxVisible);
  const hiddenCount = Math.max(0, tags.length - maxVisible);

  const addTag = (raw: string) => {
    if (disabled) return;
    const trimmed = raw.trim();
    if (!trimmed) {
      setInputValue('');
      return;
    }
    const tokens = trimmed
      .split(/[,\s]+/)
      .map((t) => t.trim())
      .filter(Boolean);

    const next = [...tags];
    let updated = false;
    for (const token of tokens) {
      if (!next.includes(token)) {
        next.push(token);
        updated = true;
      }
    }
    if (updated) {
      onChange(next);
    }
    setInputValue('');
  };

  const removeTag = (indexToRemove: number) => {
    if (disabled) return;
    const next = tags.filter((_, idx) => idx !== indexToRemove);
    onChange(next);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (disabled) return;

    if (e.key === 'Enter' || e.key === ',' || e.key === ' ') {
      e.preventDefault();
      addTag(inputValue);
    } else if (e.key === 'Backspace' && inputValue === '' && tags.length > 0) {
      e.preventDefault();
      removeTag(tags.length - 1);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (disabled) return;
    const val = e.target.value;
    if (val.includes(',') || val.includes(' ')) {
      addTag(val);
    } else {
      setInputValue(val);
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    if (disabled) return;
    const pasted = e.clipboardData.getData('text');
    if (pasted.includes(',') || pasted.includes(' ') || pasted.includes('\n')) {
      e.preventDefault();
      addTag(inputValue + pasted);
    }
  };

  return (
    <div
      className={cn(
        'flex min-h-8 w-full flex-wrap items-center gap-1.5 rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm transition-colors focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50',
        disabled && 'cursor-not-allowed bg-input/50 opacity-50 dark:bg-input/80',
        ariaInvalid &&
          'border-destructive ring-3 ring-destructive/20 dark:border-destructive/50 dark:ring-destructive/40',
        className,
      )}
      onClick={() => {
        if (!disabled) {
          inputRef.current?.focus();
        }
      }}
    >
      {visibleTags.map((tag, index) => (
        <Badge
          key={`${tag}-${index}`}
          variant="secondary"
          className="inline-flex items-center gap-1 pr-1 text-xs"
        >
          <span className="max-w-[160px] truncate">{tag}</span>
          <button
            type="button"
            aria-label={`Remove ${tag}`}
            disabled={disabled}
            onClick={(e) => {
              e.stopPropagation();
              removeTag(index);
            }}
            className={cn(
              'inline-flex size-3.5 cursor-pointer items-center justify-center rounded-sm text-muted-foreground hover:bg-muted-foreground/20 hover:text-foreground',
              disabled && 'pointer-events-none cursor-not-allowed opacity-50',
            )}
          >
            <XIcon className="size-3" />
          </button>
        </Badge>
      ))}
      {hiddenCount > 0 && (
        <Badge
          variant="outline"
          className="text-xs font-normal text-muted-foreground"
          title={tags.slice(maxVisible).join(', ')}
        >
          +{hiddenCount}
        </Badge>
      )}
      <Input
        ref={inputRef}
        id={id}
        type="text"
        value={inputValue}
        disabled={disabled}
        placeholder={placeholder}
        aria-invalid={ariaInvalid}
        onChange={handleInputChange}
        onKeyDown={handleKeyDown}
        onPaste={handlePaste}
        className="h-6 min-w-[80px] flex-1 border-0 bg-transparent p-0 text-sm shadow-none focus-visible:border-transparent focus-visible:ring-0 dark:bg-transparent"
      />
    </div>
  );
}
