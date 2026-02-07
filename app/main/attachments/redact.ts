/**
 * Mask sensitive digit sequences in text before sending to LLM.
 *
 * Rules:
 * - Runs of 8+ consecutive digits → masked, preserving last 4
 * - Patterns like "Account: 12345678" or "Routing: 123456789" → masked
 * - SSN-like patterns (xxx-xx-xxxx) → masked
 */
export function redactSensitive(text: string): string {
  // SSN patterns: xxx-xx-xxxx
  let result = text.replace(/\b\d{3}-\d{2}-\d{4}\b/g, '***-**-****')

  // Runs of 8+ digits (possibly with spaces/hyphens between groups)
  // Preserve last 4 digits
  result = result.replace(/\b(\d[\d\s-]{6,}\d)\b/g, (match) => {
    const digits = match.replace(/[\s-]/g, '')
    if (digits.length < 8) return match
    const last4 = digits.slice(-4)
    return '****' + last4
  })

  return result
}
