import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions'
import { getOpenAIClient, getModel, SYSTEM_PROMPT, type ModelTier } from './openaiClient'
import { toolDefinitions, executeTool } from './tools'
import type { ChatMessage, ToolAction, ChatResponse } from '../shared/types'

const MAX_TOOL_CALLS_PER_TURN = 100

/**
 * Run the chat-with-tools loop:
 * 1. Send conversation to OpenAI-compatible API (OpenRouter)
 * 2. If model returns tool_calls, execute them and loop
 * 3. Return final assistant message + list of actions taken
 *
 * onProgress is called with 'thinking' (waiting for LLM) or 'applying' (executing tools).
 */
export async function runAgent(
  history: ChatMessage[],
  spreadsheetId: string | undefined,
  sheetNames: string[],
  modelTier: ModelTier = 'smart',
  onProgress?: (status: string) => void
): Promise<ChatResponse> {
  const openai = getOpenAIClient()
  const model = getModel(modelTier)
  const actions: ToolAction[] = []

  const messages: ChatCompletionMessageParam[] = [
    { role: 'system', content: SYSTEM_PROMPT },
    ...history.map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content })),
  ]

  let toolCallCount = 0

  while (true) {
    onProgress?.('thinking')
    console.log(`[agent] calling ${model} (${messages.length} msgs, ${toolCallCount} tool calls so far)`)

    const completion = await openai.chat.completions.create({
      model,
      messages,
      tools: toolDefinitions,
      tool_choice: 'auto',
    })

    const choice = completion.choices[0]
    if (!choice) {
      return { message: 'No response from AI.', actions }
    }

    const msg = choice.message

    // If no tool calls, we have a final assistant reply
    if (!msg.tool_calls || msg.tool_calls.length === 0) {
      return { message: msg.content ?? '', actions }
    }

    // Guard: max tool calls
    if (toolCallCount + msg.tool_calls.length > MAX_TOOL_CALLS_PER_TURN) {
      return {
        message:
          (msg.content ?? '') +
          '\n\n(This task required many steps. Send another message to continue where I left off.)',
        actions,
      }
    }

    messages.push(msg as ChatCompletionMessageParam)

    onProgress?.('applying')

    for (const tc of msg.tool_calls) {
      toolCallCount++
      const toolName = tc.function.name
      const toolArgs = tc.function.arguments

      console.log(`[agent] tool #${toolCallCount}: ${toolName}(${toolArgs.substring(0, 200)})`)

      const { result, success } = await executeTool(toolName, toolArgs, spreadsheetId, sheetNames)

      let parsedToolArgs: Record<string, unknown> = {}
      try {
        parsedToolArgs = JSON.parse(toolArgs)
      } catch {
        parsedToolArgs = { raw: toolArgs }
      }

      actions.push({
        tool: toolName,
        args: parsedToolArgs,
        result: result.length > 500 ? result.substring(0, 500) + '...(truncated)' : result,
        success,
      })

      messages.push({
        role: 'tool',
        tool_call_id: tc.id,
        content: result,
      })
    }
  }
}
