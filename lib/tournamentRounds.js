// Название раунда от конца сетки. Отдельно от lib/tournamentBracket.js:
// там серверный crypto, а это нужно и в браузере.
export function roundLabel(round, rounds) {
  const left = rounds - round;
  if (left === 0) return "Финал";
  if (left === 1) return "Полуфинал";
  if (left === 2) return "1/4 финала";
  return `1/${2 ** left} финала`;
}
