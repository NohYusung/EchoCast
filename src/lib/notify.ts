function baseNotify(message: string): void {
  if (typeof console !== "undefined") console.info("[notify]", message);
}

export const notify = Object.assign(baseNotify, {
  info: baseNotify,
  error: baseNotify,
});
