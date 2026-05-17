export function createToast(root) {
  return function showToast({ message, type = "info", timeout = 3200 }) {
    const toast = document.createElement("div");
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    root.append(toast);
    window.setTimeout(() => toast.remove(), timeout);
  };
}
