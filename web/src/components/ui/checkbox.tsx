import * as React from 'react';
import { cn } from '@/lib/utils';
import { Check } from 'lucide-react';

export interface CheckboxProps extends React.InputHTMLAttributes<HTMLInputElement> {
  onCheckedChange?: (checked: boolean) => void;
}

const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
  ({ className, onCheckedChange, onChange, ...props }, ref) => {
    return (
      <div className={cn("relative flex items-center justify-center size-4 shrink-0 rounded-sm border border-primary ring-offset-background focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50", className)}>
        <input
          type="checkbox"
          className="peer absolute inset-0 opacity-0 cursor-pointer w-full h-full disabled:cursor-not-allowed"
          ref={ref}
          onChange={(e) => {
            onChange?.(e);
            onCheckedChange?.(e.target.checked);
          }}
          {...props}
        />
        <div className="pointer-events-none text-primary-foreground hidden peer-checked:flex peer-checked:bg-primary absolute inset-0 items-center justify-center rounded-sm">
          <Check className="size-3" strokeWidth={3} />
        </div>
      </div>
    );
  }
);
Checkbox.displayName = 'Checkbox';

export { Checkbox };
