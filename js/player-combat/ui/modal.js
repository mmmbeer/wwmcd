export function createModal(root) {
  let lastFocused = null;

  function close() {
    root.replaceChildren();
    lastFocused?.focus?.();
  }

  function showModal({ title, body, actions = [] }) {
    lastFocused = document.activeElement;
    const backdrop = document.createElement("div");
    backdrop.className = "modal-backdrop";

    const modal = document.createElement("section");
    modal.className = "modal";
    modal.setAttribute("role", "dialog");
    modal.setAttribute("aria-modal", "true");
    modal.setAttribute("aria-label", title);
    modal.innerHTML = `<h2>${escapeHtml(title)}</h2>`;

    const bodyNode = document.createElement("div");
    if (typeof body === "string") {
      bodyNode.innerHTML = body;
    } else if (body) {
      bodyNode.append(body);
    }
    modal.append(bodyNode);

    const actionRow = document.createElement("div");
    actionRow.className = "modal-actions";
    for (const action of actions) {
      const button = document.createElement("button");
      button.className = `btn btn-${action.variant ?? "secondary"}`;
      button.type = "button";
      button.textContent = action.label;
      button.addEventListener("click", () => {
        action.onClick?.();
        if (action.close !== false) close();
      });
      actionRow.append(button);
    }
    modal.append(actionRow);
    backdrop.append(modal);
    root.replaceChildren(backdrop);

    const focusable = modal.querySelector("button, input, textarea, select, [tabindex]");
    focusable?.focus?.();

    backdrop.addEventListener("keydown", (event) => {
      if (event.key === "Escape") close();
      if (event.key === "Tab") trapFocus(event, modal);
    });
  }

  return { showModal, close };
}

export function showConfirmModal(modalApi, options) {
  modalApi.showModal({
    title: options.title,
    body: `<p>${escapeHtml(options.message)}</p>`,
    actions: [
      { label: options.cancelLabel ?? "Cancel", variant: "secondary" },
      { label: options.confirmLabel ?? "Confirm", variant: "danger", onClick: options.onConfirm }
    ]
  });
}

function trapFocus(event, container) {
  const focusable = [...container.querySelectorAll("button, input, textarea, select, [tabindex]:not([tabindex='-1'])")];
  if (!focusable.length) return;
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  })[char]);
}
