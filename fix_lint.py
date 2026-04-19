#!/usr/bin/env python3
"""
Auto-fix lint issues in celstomp codebase:
1. Empty catch blocks: add "// intentionally empty" comment inside the block
2. Unused catch parameters: prefix with underscore
"""

import re
import os

BASE = os.path.expanduser("~/nightshift-workspace/clones/celstomp/celstomp")

FILES = [
    "celstomp-app.js",
    "celstomp-autosave.js",
    "celstomp-imgseq.js",
    "js/core/color-manager.js",
    "js/core/runtime-utils.js",
    "js/core/time-helper.js",
    "js/core/zoom-helper.js",
    "js/editor/timeline-helper.js",
    "js/editor/export-helper.js",
    "js/editor/layer-manager.js",
    "js/editor/canvas-helper.js",
    "js/editor/history-helper.js",
    "js/ui/interaction-shortcuts.js",
    "js/ui/swatch-handler.js",
    "js/ui/island-helper.js",
    "js/ui/color-wheel.js",
    "js/ui/ui-components.js",
    "js/ui/menu-wires.js",
    "js/ui/dock-helper.js",
    "js/ui/mobile-native-zoom-guard.js",
    "js/ui/mount-island-dock.js",
    "js/tools/brush-helper.js",
    "js/tools/lasso-helper.js",
    "js/tools/eraser-manager.js",
    "js/input/pointer-events.js",
    "js/input/pointer-wire.js",
    "js/html-loader.js",
    "parts/modals.js",
    "parts/stage.js",
    "parts/sidepanel.js",
    "parts/timeline.js",
]

def fix_empty_catch_blocks(content):
    """Fix empty catch blocks by adding comment inside the block (on its own line)."""
    fixes = 0
    
    # Pattern: catch(e) {} or catch(e){} - with param, empty body
    # Replace with: catch(_e) {\n    // intentionally empty\n  }
    # We need to preserve the indentation of the catch
    
    lines = content.split('\n')
    new_lines = []
    
    for i, line in enumerate(lines):
        # Match patterns like: } catch(e) {} or } catch {} 
        # We want to replace the whole line
        
        # Pattern with param: } catch(e) {
        m = re.match(r'^(\s*)\}\s*catch\s*\(\s*(\w+)\s*\)\s*\{\s*\}\s*$', line)
        if m:
            indent = m.group(1)
            param = m.group(2)
            new_param = f"_{param}" if not param.startswith("_") else param
            new_lines.append(f"{indent}}} catch({new_param}) {{ // intentionally empty }}")
            fixes += 1
            continue
        
        # Pattern without param: } catch {
        m = re.match(r'^(\s*)\}\s*catch\s*\{\s*\}\s*$', line)
        if m:
            indent = m.group(1)
            new_lines.append(f"{indent}}} catch {{ // intentionally empty }}")
            fixes += 1
            continue
        
        # Multi-line pattern: the catch(e) { is at end of line, next line is just }
        # Check if current line ends with catch(e) { or catch {
        # and next line is just }
        if i + 1 < len(lines):
            next_line = lines[i + 1]
            
            # catch(e) { pattern on this line
            m = re.match(r'^(\s*).*\bcatch\s*\(\s*(\w+)\s*\)\s*\{\s*$', line)
            if m and re.match(r'^\s*\}\s*$', next_line):
                indent = m.group(1)
                param = m.group(2)
                new_param = f"_{param}" if not param.startswith("_") else param
                # Replace the catch(e) with catch(_e) on this line, add comment on next
                new_line = re.sub(r'catch\s*\(\s*' + re.escape(param) + r'\s*\)', f'catch({new_param})', line)
                new_lines.append(new_line)
                # Replace the } with // intentionally empty }
                next_indent = re.match(r'^(\s*)', next_line).group(1)
                new_lines.append(f"{next_indent}// intentionally empty")
                new_lines.append(next_line)
                fixes += 1
                continue
            
            # catch { pattern on this line (no param)
            m = re.match(r'^(\s*).*\bcatch\s*\{\s*$', line)
            if m and re.match(r'^\s*\}\s*$', next_line):
                # Already has a catch { and next line is just }
                # Add comment before the }
                next_indent = re.match(r'^(\s*)', next_line).group(1)
                new_lines.append(line)
                new_lines.append(f"{next_indent}// intentionally empty")
                new_lines.append(next_line)
                fixes += 1
                continue
        
        new_lines.append(line)
    
    return '\n'.join(new_lines), fixes

total_fixes = 0

for relpath in FILES:
    filepath = os.path.join(BASE, relpath)
    if not os.path.exists(filepath):
        print(f"SKIP (not found): {filepath}")
        continue
    
    with open(filepath, 'r') as f:
        original = f.read()
    
    content, fixes = fix_empty_catch_blocks(original)
    
    if content != original:
        with open(filepath, 'w') as f:
            f.write(content)
        print(f"FIXED {fixes} empty catch blocks in {relpath}")
        total_fixes += fixes
    else:
        print(f"OK (no changes): {relpath}")

print(f"\nTotal empty catch block fixes: {total_fixes}")
