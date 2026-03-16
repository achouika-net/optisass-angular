import re

file_path = "src/app/features/client-management/pages/lentilles-form/lentilles-form.component.html"

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

stack = []
matches = re.finditer(r'<([a-z0-9-]+)(?:\s+[^>]*?(/)?)?\s*>|</([a-z0-9-]+)\s*>', content, re.IGNORECASE | re.DOTALL)

for m in matches:
    open_tag = m.group(1)
    is_self_close = m.group(2)
    close_tag = m.group(3)
    line_num = content.count('\n', 0, m.start()) + 1
    
    if open_tag:
        if is_self_close: continue
        tag_name = open_tag.lower()
        if tag_name not in ['input', 'img', 'br', 'hr', 'link', 'meta', 'area', 'base', 'col', 'embed', 'param', 'source', 'track', 'wbr']:
            stack.append((tag_name, line_num))
    elif close_tag:
        c = close_tag.lower()
        if not stack:
            print(f"ERROR: Unexpected close tag </{c}> at line {line_num}")
        else:
            o, start_line = stack.pop()
            if start_line == 3:
                print(f"DEBUG: Line 3 was CLOSED at line {line_num} with </{c}>")

if stack:
    print("\nUNCLOSED TAGS:")
    for tag, line in stack:
        print(f"<{tag}> opened at line {line} is never closed")
