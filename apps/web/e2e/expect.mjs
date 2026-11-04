export function expect(cond, message) {
  if (!cond) throw new Error(message);
}
