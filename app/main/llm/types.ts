/**
 * Shared types for LLM tools
 */

import type { ChatCompletionTool } from 'openai/resources/chat/completions'

export type FunctionDefinition = ChatCompletionTool

export interface FunctionResult {
  result: string
  success: boolean
}
