let resetProjectUiStateHandler: (() => void) | null = null

export function registerProjectUiStateReset(handler: (() => void) | null): void {
  resetProjectUiStateHandler = handler
}

export function resetProjectUiState(): void {
  resetProjectUiStateHandler?.()
}