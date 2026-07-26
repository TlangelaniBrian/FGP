"use client";

export function TariffActions({
  capabilities,
  disabled = false,
  onSave,
}: {
  capabilities: string[];
  disabled?: boolean;
  onSave?: () => void;
}) {
  if (!capabilities.includes("EditTariffs")) return null;

  return (
    <button
      type="button"
      className="button button-primary"
      disabled={disabled}
      onClick={onSave}
    >
      Save tariffs
    </button>
  );
}
