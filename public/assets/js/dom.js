export const $ = (id) => document.getElementById(id);

export function el(tag, props = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (k === 'class') node.className = v;
    else if (k.startsWith('on')) node[k] = v;
    else node.setAttribute(k, v);
  }
  node.append(...children.filter((c) => c !== null && c !== undefined && c !== false));
  return node;
}

export function select(name, options, value, blank) {
  const s = el('select', { name });
  if (blank) s.append(el('option', { value: '' }, blank));
  for (const [k, v] of Object.entries(options)) {
    const o = el('option', { value: k }, v);
    o.selected = k === value;
    s.append(o);
  }
  return s;
}

export function showError(e) { $('status').textContent = e.message; }
