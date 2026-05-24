export function createModal(root) {
  let lastFocused = null;
  let onClose = null;
  let modalId = 0;

  function close() {
    root.replaceChildren();
    lastFocused?.focus?.();
    onClose?.();
    onClose = null;
  }

  function showModal({ title, body, actions = [], onClose: closeHandler = null }) {
    lastFocused = document.activeElement;
    onClose = closeHandler;
    const backdrop = document.createElement("div");
    backdrop.className = "modal-backdrop";

    const modal = document.createElement("section");
    const titleId = `modal-title-${++modalId}`;
    modal.className = "modal";
    modal.setAttribute("role", "dialog");
    modal.setAttribute("aria-modal", "true");
    modal.setAttribute("aria-labelledby", titleId);
    modal.innerHTML = `<h2 id="${titleId}">${escapeHtml(title)}</h2>`;

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
        action.onClick?.({ button, action });
        if (action.close !== false) close();
      });
      actionRow.append(button);
    }
    modal.append(actionRow);
    backdrop.append(modal);
    root.replaceChildren(backdrop);

    const focusable = getFocusable(modal)[0];
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
  const focusable = getFocusable(container);
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

function getFocusable(container) {
  return [...container.querySelectorAll("button, input, textarea, select, a[href], [tabindex]:not([tabindex='-1'])")]
    .filter((element) => !element.disabled && !element.hidden && element.getAttribute("aria-hidden") !== "true" && element.offsetParent !== null);
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
