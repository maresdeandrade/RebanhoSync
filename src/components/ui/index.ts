/**
 * Barrel de exportação do Design System — RebanhoSync
 *
 * Importe componentes individuais nos arquivos de página para evitar
 * tree-shaking ineficiente. Este barrel é útil apenas para documentação
 * e para imports em testes.
 */

// Primitivos de base
export * from "./button";
export * from "./input";
export * from "./label";
export * from "./textarea";
export * from "./select";
export * from "./checkbox";
export * from "./radio-group";
export * from "./switch";
export * from "./form";

// Superfícies / containers
export * from "./card";        // inclui CardField e CardStatus
export * from "./dialog";
export * from "./sheet";
export * from "./popover";
export * from "./tooltip";
export * from "./drawer";

// Feedback & status
export * from "./alert";
export * from "./badge";
export * from "./status-badge";
export * from "./sync-status-badge";  // SyncStatusBadge + OfflinePill (§19)
export * from "./skeleton";
export * from "./progress";
export * from "./sonner";

// Navegação & listas
export * from "./filter-chips";   // FilterChips (§10.4)
export * from "./pagination";
export * from "./tabs";
export * from "./breadcrumb";
export * from "./separator";

// Inputs avançados
export * from "./field-combobox";  // FieldCombobox com scanner (§8.3)
export * from "./command";
export * from "./calendar";

// Dados tabulares
export * from "./table";

// Layout & misc
export * from "./scroll-area";
export * from "./loading-screen";
export * from "./metric-card";
export * from "./page-intro";
export * from "./form-section";
export * from "./toolbar";
