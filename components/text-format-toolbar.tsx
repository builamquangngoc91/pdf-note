'use client';
import { useEffect, useState } from 'react';
import {
  Bold,
  Italic,
  Underline,
  Strikethrough,
  AlignLeft,
  AlignCenter,
  AlignRight,
  RemoveFormatting,
  ALargeSmall,
} from 'lucide-react';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';
import { Toggle } from '@/components/ui/toggle';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import type { FontFamily, TextFormat } from '@/lib/annotations';

export function TextFormatToolbar({
  value,
  onChange,
  disabled = false,
}: {
  value: TextFormat;
  onChange(patch: Partial<TextFormat>): void;
  disabled?: boolean;
}) {
  const [size, setSize] = useState(String(value.fontSize));
  useEffect(() => setSize(String(value.fontSize)), [value.fontSize]);
  function commitSize() {
    const number = Number(size);
    if (Number.isFinite(number) && number >= 8 && number <= 120) {
      if (number !== value.fontSize) onChange({ fontSize: number });
    } else setSize(String(value.fontSize));
  }
  return (
    <div className="word-toolbar" role="toolbar" aria-label="Định dạng chữ">
      <div className="word-tool-group word-font-group">
        <Select
          value={value.fontFamily}
          disabled={disabled}
          onValueChange={(font) => {
            if (font) onChange({ fontFamily: font as FontFamily });
          }}
        >
          <SelectTrigger className="word-font-select" aria-label="Phông chữ">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(
              [
                'Liberation Sans',
                'Liberation Serif',
                'Liberation Mono',
                'Arial',
              ] as const
            ).map((font) => (
              <SelectItem key={font} value={font}>
                <span style={{ fontFamily: font }}>{font}</span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <input
          className="word-font-size"
          type="number"
          min={8}
          max={120}
          step={1}
          value={size}
          disabled={disabled}
          aria-label="Cỡ chữ"
          title="Cỡ chữ (8–120)"
          onChange={(e) => setSize(e.target.value)}
          onBlur={commitSize}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              commitSize();
            }
            if (e.key === 'Escape') {
              setSize(String(value.fontSize));
              e.stopPropagation();
            }
          }}
        />
      </div>
      <div className="word-tool-group">
        {(
          [
            { key: 'bold', icon: Bold, label: 'In đậm (Ctrl+B)' },
            { key: 'italic', icon: Italic, label: 'In nghiêng (Ctrl+I)' },
            { key: 'underline', icon: Underline, label: 'Gạch chân (Ctrl+U)' },
            { key: 'strikethrough', icon: Strikethrough, label: 'Gạch ngang' },
          ] as const
        ).map((item) => (
          <Toggle
            key={item.key}
            type="button"
            pressed={value[item.key]}
            onPressedChange={(pressed) => onChange({ [item.key]: pressed })}
            disabled={disabled}
            title={item.label}
            aria-label={item.label}
          >
            <item.icon size={17} />
          </Toggle>
        ))}
        <label className="word-color" title="Màu chữ">
          <span style={{ borderBottomColor: value.color }}>A</span>
          <input
            type="color"
            aria-label="Màu chữ"
            value={value.color}
            disabled={disabled}
            onChange={(e) => onChange({ color: e.target.value })}
          />
        </label>
      </div>
      <div className="word-tool-group">
        <ToggleGroup
          value={[value.align]}
          onValueChange={(values) => {
            if (values.length)
              onChange({ align: values[0] as TextFormat['align'] });
          }}
          disabled={disabled}
          aria-label="Căn lề chữ"
        >
          {(
            [
              { value: 'left', icon: AlignLeft, label: 'Căn trái' },
              { value: 'center', icon: AlignCenter, label: 'Căn giữa' },
              { value: 'right', icon: AlignRight, label: 'Căn phải' },
            ] as const
          ).map((item) => (
            <ToggleGroupItem
              type="button"
              key={item.value}
              value={item.value}
              title={item.label}
              aria-label={item.label}
            >
              <item.icon size={17} />
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
        <Select
          value={String(value.lineHeight)}
          disabled={disabled}
          onValueChange={(spacing) => {
            if (spacing) onChange({ lineHeight: Number(spacing) });
          }}
        >
          <SelectTrigger
            className="word-spacing"
            aria-label="Giãn dòng"
            title="Giãn dòng"
          >
            <ALargeSmall size={16} />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {[1, 1.15, 1.3, 1.5, 2, 2.5, 3].map((n) => (
              <SelectItem key={n} value={String(n)}>
                {n}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <button
        className="word-reset"
        type="button"
        title="Xóa định dạng"
        aria-label="Xóa định dạng"
        disabled={disabled}
        onClick={() =>
          onChange({
            fontFamily: 'Liberation Sans',
            fontSize: 20,
            color: '#292d39',
            bold: false,
            italic: false,
            underline: false,
            strikethrough: false,
            align: 'left',
            lineHeight: 1.3,
          })
        }
      >
        <RemoveFormatting size={18} />
      </button>
    </div>
  );
}
