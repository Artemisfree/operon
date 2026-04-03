type ExtractedOrderContext = {
  quantity?: number;
  customerPhone?: string;
  deliveryAddress?: string;
};

export function extractProductQueryFromText(text: string): string | undefined {
  const productMatch =
    text.match(
      /(?:заказать|нужно|хочу)\s+\d+\s+([^.\n!?]+?)(?:\s+телефон|\s+адрес|[.!?]|$)/i,
    ) ??
    text.match(
      /(?:заказать|нужно|хочу)\s+([^.\n!?]+?)(?:\s+телефон|\s+адрес|[.!?]|$)/i,
    );

  return productMatch?.[1]?.trim();
}

export function extractOrderContextFromText(
  text: string,
  fallback?: {
    customerPhone?: string | null;
  },
): ExtractedOrderContext {
  const quantityMatch = text.match(/(?:заказать|нужно|хочу)\s+(\d+)/i);
  const phoneMatch = text.match(
    /(?:телефон|номер)\s*[:\-]?\s*(\+?[0-9()\-\s]{10,})/i,
  );
  const addressMatch = text.match(/адрес\s*[:\-]?\s*([^.\n]+)/i);

  return {
    quantity: quantityMatch ? Number(quantityMatch[1]) : undefined,
    customerPhone:
      phoneMatch?.[1]?.trim() || fallback?.customerPhone?.trim() || undefined,
    deliveryAddress: addressMatch?.[1]?.trim() || undefined,
  };
}

export function isExplicitConfirmation(text: string): boolean {
  return /подтверждаю|оформляй|создай заказ|можно оформлять|всё верно|все верно/i.test(
    text,
  );
}
