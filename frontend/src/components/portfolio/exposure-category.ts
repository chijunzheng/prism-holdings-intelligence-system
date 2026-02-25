export function formatExposureCategory(category: string): string {
  if (category === 'Diversified Holdings') {
    return 'Residual Constituents'
  }

  const diversifiedMatch = category.match(/^Diversified Holdings \((.+)\)$/)
  if (diversifiedMatch) {
    return `Residual Constituents (${diversifiedMatch[1]})`
  }

  return category
}

export function formatWarningMessage(message: string, rawCategory: string): string {
  return message.replace(rawCategory, formatExposureCategory(rawCategory))
}
