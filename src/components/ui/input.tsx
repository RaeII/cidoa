import * as React from "react"

import { cn } from "@/lib/utils"

const baseInputClasses =
  "h-11 w-full min-w-0 rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-xs transition-[color,box-shadow] outline-none selection:bg-primary selection:text-primary-foreground file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm dark:bg-input/30 focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40"

const autofillInputClasses =
  "[&:-webkit-autofill]:[-webkit-background-clip:text] [&:-webkit-autofill]:[-webkit-text-fill-color:var(--foreground)] [&:-webkit-autofill]:caret-foreground"

interface InputProps extends React.ComponentProps<"input"> {
  label?: React.ReactNode
  /** Surface bg behind the floating label — must match the container (default bg-background; use bg-card inside a Card). */
  labelClassName?: string
}

function Input({ className, type, id, label, labelClassName, placeholder, ...props }: InputProps) {
  const generatedId = React.useId()
  const inputId = id ?? generatedId

  if (!label) {
    return (
      <input
        type={type}
        id={id}
        data-slot="input"
        placeholder={placeholder}
        className={cn(baseInputClasses, autofillInputClasses, className)}
        {...props}
      />
    )
  }

  return (
    <div className="relative w-full">
      <input
        type={type}
        id={inputId}
        data-slot="input"
        placeholder={placeholder ?? " "}
        className={cn(
          baseInputClasses,
          autofillInputClasses,
          "peer bg-transparent dark:bg-transparent placeholder:text-transparent focus:placeholder:text-muted-foreground",
          className
        )}
        {...props}
      />
      <label
        htmlFor={inputId}
        className={cn(
          "pointer-events-none absolute left-2.5 top-0 z-10 -translate-y-1/2 bg-background px-1 text-xs font-medium text-muted-foreground transition-all duration-150 peer-placeholder-shown:top-1/2 peer-placeholder-shown:-translate-y-1/2 peer-placeholder-shown:text-sm peer-focus:top-0 peer-focus:-translate-y-1/2 peer-focus:text-xs peer-focus:text-primary peer-disabled:opacity-50",
          labelClassName
        )}
      >
        {label}
      </label>
    </div>
  )
}

export { Input }
