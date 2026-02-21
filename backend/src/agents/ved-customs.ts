import { TnVedCode, DutyCalculation } from "../types/ved";

/**
 * Калькулятор таможенных платежей — чистая математика, без LLM.
 *
 * Формула:
 *   dutyAmount = customsValueRub × dutyRate / 100
 *   vatBase = customsValueRub + dutyAmount + exciseAmount
 *   vatAmount = vatBase × vatRate / 100
 *   totalPayments = dutyAmount + vatAmount + exciseAmount
 */

const EXCHANGE_RATES: Record<string, number> = {
  USD: 92.5,  // курс ЦБ РФ (примерный, февраль 2026)
  EUR: 100.0,
  RUB: 1,
};

export function calculateDuty(
  code: TnVedCode,
  customsValue: number,
  currency: "USD" | "EUR" | "RUB"
): DutyCalculation {
  const rate = EXCHANGE_RATES[currency] ?? 1;
  const customsValueRub = Math.round(customsValue * rate);

  const dutyAmount = Math.round(customsValueRub * code.dutyRate / 100);
  const exciseAmount = Math.round(customsValueRub * code.excise / 100);
  const vatBase = customsValueRub + dutyAmount + exciseAmount;
  const vatAmount = Math.round(vatBase * code.vatRate / 100);
  const totalPayments = dutyAmount + vatAmount + exciseAmount;

  const breakdown = [
    `Таможенная стоимость: ${customsValue.toLocaleString()} ${currency} × ${rate} = ${customsValueRub.toLocaleString()} руб.`,
    `Пошлина: ${customsValueRub.toLocaleString()} × ${code.dutyRate}% = ${dutyAmount.toLocaleString()} руб.`,
    code.excise > 0
      ? `Акциз: ${customsValueRub.toLocaleString()} × ${code.excise}% = ${exciseAmount.toLocaleString()} руб.`
      : null,
    `База НДС: ${customsValueRub.toLocaleString()} + ${dutyAmount.toLocaleString()}${exciseAmount > 0 ? ` + ${exciseAmount.toLocaleString()}` : ""} = ${vatBase.toLocaleString()} руб.`,
    `НДС: ${vatBase.toLocaleString()} × ${code.vatRate}% = ${vatAmount.toLocaleString()} руб.`,
    `ИТОГО: ${totalPayments.toLocaleString()} руб.`,
  ]
    .filter(Boolean)
    .join("\n");

  return {
    tnVedCode: code.code,
    productDescription: code.description,
    customsValue,
    currency,
    customsValueRub,
    dutyRate: code.dutyRate,
    dutyAmount,
    vatAmount,
    exciseAmount,
    totalPayments,
    breakdown,
  };
}
