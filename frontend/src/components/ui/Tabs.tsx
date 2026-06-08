// frontend/src/components/ui/Tabs.tsx

import type { ReactNode } from "react";

import { brand, colors } from "../../styles/colors";

interface TabItem {
  value: string;
  label: string;
  count?: number;
  icon?: ReactNode;
}

export function Tabs({
  items,
  value,
  onChange,
}: {
  items: TabItem[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div
      className="flex w-fit max-w-full gap-1 overflow-x-auto rounded-md border p-1"
      style={{
        borderColor: colors.surface[200],
        background: colors.surface[100],
      }}
    >
      {items.map((item) => {
        const active = item.value === value;

        return (
          <button
            key={item.value}
            type="button"
            onClick={() => onChange(item.value)}
            className="inline-flex h-9 shrink-0 items-center gap-2 rounded-md px-3 text-[12.5px] font-bold transition"
            style={{
              background: active ? colors.surface[50] : "transparent",
              color: active ? colors.text.primary : colors.text.secondary,
              boxShadow: active ? `0 10px 24px -20px ${colors.shadow}` : "none",
            }}
          >
            {item.icon}
            <span>{item.label}</span>
            {typeof item.count === "number" && (
              <span
                className="rounded-md px-1.5 py-0.5 text-[10px]"
                style={{
                  background: active ? brand.bgNavActive : colors.surface[200],
                  color: active ? colors.brand : colors.text.secondary,
                }}
              >
                {item.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
