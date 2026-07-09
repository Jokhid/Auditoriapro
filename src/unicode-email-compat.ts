const normalizeEmailText = (value: string) => value.normalize("NFC");

const normalizeEmailInputs = () => {
  document.querySelectorAll<HTMLInputElement>('input[type="email"]').forEach((input) => {
    input.type = "text";
    input.inputMode = "email";
    input.autocomplete = "email";
    input.removeAttribute("pattern");
    input.setCustomValidity("");
  });
};

const normalizeCurrentValue = (event: Event) => {
  const input = event.target;
  if (!(input instanceof HTMLInputElement) || input.inputMode !== "email") return;
  const normalized = normalizeEmailText(input.value);
  if (normalized !== input.value) input.value = normalized;
};

export function installUnicodeEmailCompatibility() {
  normalizeEmailInputs();
  const observer = new MutationObserver(normalizeEmailInputs);
  observer.observe(document.body, { childList: true, subtree: true });
  document.addEventListener("input", normalizeCurrentValue, true);
}
