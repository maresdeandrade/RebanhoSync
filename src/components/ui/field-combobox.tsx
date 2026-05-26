/**
 * FieldCombobox — Combobox otimizado para campo.
 *
 * Características:
 * - Input grande (h-12), fonte body (16px), fácil de tocar com luvas.
 * - Busca por nome ou código entre centenas de opções.
 * - Suporte a "scan de brinco" via botão opcional (FAB ao lado).
 * - Abre dropdown via Popover + Command (shadcn).
 * - Suporta placeholder descritivo com exemplo concreto.
 *
 * Design System §8.3
 */
import * as React from "react";
import { Check, ChevronsUpDown, ScanLine } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

export interface FieldComboboxOption {
  value: string;
  label: string;
  /** Sub-label opcional (ex.: código do lote, pasto) */
  sublabel?: string;
}

interface FieldComboboxProps {
  /** Lista de opções. Suporta 500+ com busca interna. */
  options: FieldComboboxOption[];
  value?: string;
  onValueChange?: (value: string) => void;
  /** Placeholder do trigger (ex.: "Selecione um lote") */
  placeholder?: string;
  /** Placeholder do input de busca (ex.: "Buscar por nome ou código...") */
  searchPlaceholder?: string;
  /** Texto quando a busca não retorna resultados */
  emptyMessage?: string;
  /** Se `true`, exibe um botão de scanner ao lado (ex.: brinco Bluetooth) */
  withScanner?: boolean;
  /** Callback ao acionar o scanner */
  onScan?: () => void;
  disabled?: boolean;
  className?: string;
  id?: string;
}

export function FieldCombobox({
  options,
  value,
  onValueChange,
  placeholder = "Selecione…",
  searchPlaceholder = "Buscar…",
  emptyMessage = "Nenhum resultado encontrado.",
  withScanner = false,
  onScan,
  disabled = false,
  className,
  id,
}: FieldComboboxProps) {
  const [open, setOpen] = React.useState(false);

  const selected = options.find((o) => o.value === value);

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            id={id}
            type="button"
            role="combobox"
            aria-expanded={open}
            aria-haspopup="listbox"
            disabled={disabled}
            className={cn(
              // Base — mesmas dimensões do Input (h-12, text-body)
              "flex h-12 w-full items-center justify-between rounded-md border border-border bg-background px-3.5 text-body font-medium ring-offset-background",
              "placeholder:text-muted-foreground",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
              "disabled:cursor-not-allowed disabled:opacity-50",
              !selected && "text-muted-foreground",
            )}
          >
            <span className="truncate">
              {selected ? (
                <span className="flex items-baseline gap-1.5">
                  <span className="font-semibold text-foreground">
                    {selected.label}
                  </span>
                  {selected.sublabel && (
                    <span className="text-body-sm text-muted-foreground">
                      {selected.sublabel}
                    </span>
                  )}
                </span>
              ) : (
                placeholder
              )}
            </span>
            <ChevronsUpDown
              className="ml-2 size-4 shrink-0 opacity-50"
              aria-hidden="true"
            />
          </button>
        </PopoverTrigger>

        <PopoverContent
          className="w-[var(--radix-popover-trigger-width)] p-0"
          align="start"
        >
          <Command>
            <CommandInput
              placeholder={searchPlaceholder}
              className="h-12 text-body"
            />
            <CommandList>
              <CommandEmpty className="py-6 text-center text-body-sm text-muted-foreground">
                {emptyMessage}
              </CommandEmpty>
              <CommandGroup>
                {options.map((option) => (
                  <CommandItem
                    key={option.value}
                    value={`${option.label} ${option.sublabel ?? ""}`}
                    onSelect={() => {
                      onValueChange?.(
                        option.value === value ? "" : option.value,
                      );
                      setOpen(false);
                    }}
                    className="flex items-center gap-2 py-3"
                  >
                    <Check
                      className={cn(
                        "size-4 shrink-0",
                        value === option.value ? "opacity-100" : "opacity-0",
                      )}
                      aria-hidden="true"
                    />
                    <span className="flex flex-col">
                      <span className="font-medium text-foreground">
                        {option.label}
                      </span>
                      {option.sublabel && (
                        <span className="text-caption text-muted-foreground">
                          {option.sublabel}
                        </span>
                      )}
                    </span>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {withScanner && (
        <Button
          type="button"
          variant="outline"
          size="icon"
          aria-label="Escanear brinco"
          onClick={onScan}
          disabled={disabled}
          className="shrink-0"
        >
          <ScanLine className="size-5" aria-hidden="true" />
        </Button>
      )}
    </div>
  );
}
