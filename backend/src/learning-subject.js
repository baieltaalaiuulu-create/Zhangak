/**
 * Canonical subject identifiers exposed to student clients.
 *
 * Legacy curriculum imports used display labels while the current web client
 * filters the two ORT paths by stable identifiers. Keep the stored editorial
 * label intact for admins, but collapse known variants at the public API
 * boundary so old and new lessons remain in the same subject path.
 */
export function canonicalLearningSubject(value) {
  if (value == null) return null
  const text = String(value).trim()
  if (!text) return null
  const normalized = text.toLocaleLowerCase('ru').replace(/\s+/g, ' ')
  if (normalized === 'math' || normalized.startsWith('математ')) return 'math'
  if (normalized === 'kyr' || normalized.startsWith('kyrgyz') || normalized.includes('кыргыз')) return 'kyr'
  return text
}
