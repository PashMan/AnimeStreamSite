import React, { useRef } from 'react';
import { Bold, Italic, Underline, Quote } from 'lucide-react';

interface RichTextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  value: string;
  onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  onSubmit?: () => void;
}

export const RichTextarea: React.FC<RichTextareaProps> = ({ value, onChange, onSubmit, className, ...props }) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const insertTag = (tag: string) => {
    if (!textareaRef.current) return;
    const start = textareaRef.current.selectionStart;
    const end = textareaRef.current.selectionEnd;
    const text = textareaRef.current.value;
    const before = text.substring(0, start);
    const selection = text.substring(start, end);
    const after = text.substring(end);

    let newText = '';
    let newCursorPos = 0;

    if (tag === 'b') {
        newText = `${before}**${selection}**${after}`;
        newCursorPos = start + 2 + selection.length + 2; // Move after closing **
        if (!selection) newCursorPos -= 2; // If no selection, put cursor inside
    } else if (tag === 'i') {
        newText = `${before}_${selection}_${after}`;
        newCursorPos = start + 1 + selection.length + 1;
        if (!selection) newCursorPos -= 1;
    } else if (tag === 'u') {
        newText = `${before}<u>${selection}</u>${after}`;
        newCursorPos = start + 3 + selection.length + 4;
        if (!selection) newCursorPos -= 4;
    } else if (tag === 'q') {
        newText = `${before}> ${selection}${after}`;
        newCursorPos = start + 2 + selection.length;
    }

    // Trigger change manually since we modified the value programmatically
    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value")?.set;
    if (nativeInputValueSetter) {
        nativeInputValueSetter.call(textareaRef.current, newText);
    }
    
    const event = { target: textareaRef.current } as React.ChangeEvent<HTMLTextAreaElement>;
    onChange(event);
    
    // Restore focus and cursor
    setTimeout(() => {
        if (textareaRef.current) {
            textareaRef.current.focus();
            textareaRef.current.setSelectionRange(newCursorPos, newCursorPos);
        }
    }, 0);
  };

  return (
    <div className="flex flex-col gap-0 group">
        <div className="flex gap-1 bg-surface/50 p-1.5 rounded-t-xl border border-white/10 border-b-0 w-fit self-start translate-y-[1px] z-10">
            <button type="button" onClick={() => insertTag('b')} className="p-1.5 hover:bg-white/10 rounded-lg text-slate-400 hover:text-white transition-colors" title="Жирный"><Bold className="w-3.5 h-3.5" /></button>
            <button type="button" onClick={() => insertTag('i')} className="p-1.5 hover:bg-white/10 rounded-lg text-slate-400 hover:text-white transition-colors" title="Курсив"><Italic className="w-3.5 h-3.5" /></button>
            <button type="button" onClick={() => insertTag('u')} className="p-1.5 hover:bg-white/10 rounded-lg text-slate-400 hover:text-white transition-colors" title="Подчеркнутый"><Underline className="w-3.5 h-3.5" /></button>
            <button type="button" onClick={() => insertTag('q')} className="p-1.5 hover:bg-white/10 rounded-lg text-slate-400 hover:text-white transition-colors" title="Цитата"><Quote className="w-3.5 h-3.5" /></button>
        </div>
        <textarea
            ref={textareaRef}
            value={value}
            onChange={onChange}
            className={`w-full bg-black/20 border border-white/10 rounded-b-xl rounded-tr-xl p-4 text-white focus:border-primary outline-none transition-all resize-none text-sm ${className}`}
            onKeyDown={(e) => {
                if (e.key === 'Enter' && e.ctrlKey && onSubmit) {
                    onSubmit();
                }
            }}
            {...props}
        />
    </div>
  );
};
