DOM_EXTRACTOR_JS = """
() => {
  function getUniqueSelector(el) {
    if (!(el instanceof Element)) return '';
    
    // If element has a unique ID, use it
    if (el.id) {
      try {
        const idSelector = `#${CSS.escape(el.id)}`;
        if (document.querySelectorAll(idSelector).length === 1) {
          return idSelector;
        }
      } catch (e) {}
    }
    
    let path = [];
    let current = el;
    while (current && current.nodeType === Node.ELEMENT_NODE) {
      let selector = current.nodeName.toLowerCase();
      if (current.id) {
        selector = '#' + CSS.escape(current.id);
        path.unshift(selector);
        break; // IDs are highly specific
      }
      
      // Add classes if available
      let classes = Array.from(current.classList)
        .filter(c => !c.includes('hover') && !c.includes('active') && !c.includes('focus'))
        .map(c => '.' + CSS.escape(c))
        .join('');
      if (classes) {
        selector += classes;
      }
      
      // Position among siblings of same tag
      let parent = current.parentNode;
      if (parent) {
        let siblings = Array.from(parent.children).filter(child => child.tagName === current.tagName);
        if (siblings.length > 1) {
          let index = siblings.indexOf(current) + 1;
          selector += `:nth-of-type(${index})`;
        }
      }
      path.unshift(selector);
      current = current.parentNode;
    }
    return path.join(' > ');
  }

  function getXPath(el) {
    if (!(el instanceof Element)) return '';
    if (el.id) {
      return `//*[@id="${el.id}"]`;
    }
    let path = [];
    while (el && el.nodeType === Node.ELEMENT_NODE) {
      let index = 0;
      let sibling = el.previousSibling;
      while (sibling) {
        if (sibling.nodeType === Node.ELEMENT_NODE && sibling.nodeName === el.nodeName) {
          index++;
        }
        sibling = sibling.previousSibling;
      }
      let tagName = el.nodeName.toLowerCase();
      let pathIndex = (index + 1) > 1 ? `[${index + 1}]` : '';
      path.unshift(`${tagName}${pathIndex}`);
      el = el.parentNode;
    }
    return '/' + path.join('/');
  }

  function buildTree(node) {
    if (!node || node.nodeType !== Node.ELEMENT_NODE) return null;
    
    const tag = node.tagName.toLowerCase();
    // Exclude noise tags
    if (['script', 'style', 'head', 'noscript', 'iframe', 'svg', 'path', 'g', 'link', 'meta'].includes(tag)) {
      return null;
    }
    
    const rect = node.getBoundingClientRect();
    const computedStyle = window.getComputedStyle(node);
    
    // Check visibility. We want to exclude invisible layout containers to keep the tree small, 
    // but keep containers that have visible children. So we won't strictly return null for width=0/height=0 yet.
    // However, if display is 'none' or visibility is 'hidden', we exclude it.
    if (computedStyle.display === 'none' || computedStyle.visibility === 'hidden') {
      return null;
    }
    
    // Collect child trees
    const children = [];
    for (let child of node.children) {
      const childTree = buildTree(child);
      if (childTree) {
        children.push(childTree);
      }
    }

    // Determine if this element itself is a visual element (has dimensions and content/background)
    const isVisual = rect.width > 0 && rect.height > 0;
    
    // We only keep nodes in the tree if they are visual OR have visual children.
    if (!isVisual && children.length === 0) {
      return null;
    }

    // Get direct text content
    let directText = '';
    for (let childNode of node.childNodes) {
      if (childNode.nodeType === Node.TEXT_NODE) {
        const text = childNode.nodeValue.trim();
        if (text) {
          directText += (directText ? ' ' : '') + text;
        }
      }
    }

    return {
      tag: tag,
      id: node.id || '',
      classes: Array.from(node.classList).join(' '),
      text: directText.slice(0, 100),
      selector: getUniqueSelector(node),
      xpath: getXPath(node),
      rect: {
        x: Math.round(rect.left),
        y: Math.round(rect.top),
        width: Math.round(rect.width),
        height: Math.round(rect.height)
      },
      children: children
    };
  }

  return buildTree(document.body);
}
"""
