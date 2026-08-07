import { Search, Download } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";
import { ReactNode } from "react";

interface ListToolbarProps {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  onExport?: () => void;
  exportLabel?: string;
  children?: ReactNode;
}

const ListToolbar = ({
  id = "list-search",
  value,
  onChange,
  placeholder,
  onExport,
  exportLabel,
  children,
}: ListToolbarProps) => {
  const { t } = useLanguage();
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative min-w-[200px] flex-1">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden="true"
        />
        <label htmlFor={id} className="sr-only">
          {t.common.search}
        </label>
        <Input
          id={id}
          type="search"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder ?? t.common.searchPlaceholder}
          className="pl-9"
        />
      </div>
      {children}
      {onExport && (
        <Button variant="outline" onClick={onExport} className="gap-1.5">
          <Download className="h-4 w-4" aria-hidden="true" />
          <span className="hidden sm:inline">{exportLabel ?? t.common.exportCsv}</span>
        </Button>
      )}
    </div>
  );
};

export default ListToolbar;
