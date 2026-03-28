/**
 * SEAL AI-Bridge
 * Enables AI interaction for standard HTML/React applications.
 */

/**
 * Scans the current document for SEAL-compatible elements.
 * Looks for elements with [data-seal-id] or [id] and semantic roles.
 * @returns {Object} AI Manifest of the current live page.
 */
function scan(root = document) {
  const elements = root.querySelectorAll("[data-seal-id], input, button, select, a");
  const actions = [];

  elements.forEach(el => {
    const id = el.getAttribute("data-seal-id") || el.id;
    if (!id) return;

    let type = el.tagName.toLowerCase();
    if (el.tagName === "INPUT") type = "Input";
    else if (el.tagName === "BUTTON") type = "Button";
    else if (el.tagName === "SELECT") type = "Select";
    else if (el.tagName === "A") type = "Link";

    const label = el.getAttribute("data-seal-label") || 
                  el.placeholder || 
                  el.innerText || 
                  el.getAttribute("aria-label") || "";

    actions.push({
      id,
      type,
      label: label.trim(),
      actions: type === "Button" || type === "Link" ? ["CLICK"] : ["FILL", "READ"]
    });
  });

  return {
    url: window.location.href,
    title: document.title,
    actions
  };
}

module.exports = { scan };
