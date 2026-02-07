/**
 * LLM tools for template operations
 */

import { randomUUID } from 'crypto'
import type { FunctionDefinition, FunctionResult } from './types'
import { getOAuth2Client } from '../auth/googleAuth'
import {
  listTemplates,
  getTemplate,
  updateTemplate,
  saveTemplateRun,
  getTemplateRun,
  updateTemplateRun,
} from '../templates/templateStore'
import {
  copyTemplate as copyTemplateDrive,
  setTemplateInputs as setTemplateInputsDrive,
  readTemplateOutputs as readTemplateOutputsDrive,
} from '../templates/templateDriveClient'
import type { TemplateRun } from '../templates/templateTypes'

/**
 * Tool 1: list_templates
 */
export const listTemplatesDefinition: FunctionDefinition = {
  type: 'function',
  function: {
    name: 'list_templates',
    description: 'List all available financial model templates (DCF, LBO, etc.)',
    parameters: {
      type: 'object',
      properties: {
        category: {
          type: 'string',
          enum: ['dcf', 'lbo', 'comps', 'merger', 'other', 'all'],
          description: 'Filter by template category (default: all)',
        },
      },
    },
  },
}

export async function executeListTemplates(args: { category?: string }): Promise<FunctionResult> {
  const templates = listTemplates()

  let filtered = templates
  if (args.category && args.category !== 'all') {
    filtered = templates.filter((t) => t.category === args.category)
  }

  if (filtered.length === 0) {
    return {
      result: 'No templates found. User must upload a template first.',
      success: true,
    }
  }

  const output = filtered
    .map(
      (t) =>
        `• ${t.name} (${t.category})\n  ID: ${t.templateId}\n  Inputs: ${t.requiredInputs.length} required, ${t.optionalInputs.length} optional\n  Last used: ${t.lastUsed ? new Date(t.lastUsed).toLocaleDateString() : 'never'}`
    )
    .join('\n\n')

  return {
    result: `Available templates:\n\n${output}`,
    success: true,
  }
}

/**
 * Tool 2: describe_template
 */
export const describeTemplateDefinition: FunctionDefinition = {
  type: 'function',
  function: {
    name: 'describe_template',
    description:
      'Get metadata about a template (category, usage stats, Drive link). To understand the actual structure and layout of a template, create a model from it first, then use get_sheet_preview and search_cells to explore its structure.',
    parameters: {
      type: 'object',
      properties: {
        template_id: {
          type: 'string',
          description: 'The template ID',
        },
      },
      required: ['template_id'],
    },
  },
}

export async function executeDescribeTemplate(args: {
  template_id: string
}): Promise<FunctionResult> {
  const template = getTemplate(args.template_id)

  if (!template) {
    return {
      result: `Template ${args.template_id} not found`,
      success: false,
    }
  }

  const output = `Template: ${template.name}
Category: ${template.category}
Description: ${template.description || 'N/A'}

REQUIRED INPUTS (${template.requiredInputs.length}):
${template.requiredInputs
  .map((r) => {
    const rules = []
    if (template.validationRules.percentageInputs.includes(r)) rules.push('percentage (0-1)')
    if (template.validationRules.positiveInputs.includes(r)) rules.push('must be positive')
    if (template.validationRules.integerInputs.includes(r)) rules.push('must be integer')
    return `  • ${r}${rules.length > 0 ? ` [${rules.join(', ')}]` : ''}`
  })
  .join('\n')}

OPTIONAL INPUTS (${template.optionalInputs.length}):
${template.optionalInputs.map((r) => `  • ${r}`).join('\n')}

OUTPUT RANGES:
${template.outputRanges.map((r) => `  • ${r}`).join('\n')}

Usage: ${template.usageCount} time(s)
Template link: ${template.driveWebViewLink}`

  return {
    result: output,
    success: true,
  }
}

/**
 * Tool 3: create_model_from_template
 */
export const createModelFromTemplateDefinition: FunctionDefinition = {
  type: 'function',
  function: {
    name: 'create_model_from_template',
    description:
      'Create a new financial model by copying a template to a new spreadsheet. After creation, use get_sheet_preview and search_cells to understand the template structure, then use write_range to fill in data from datasets. This is a flexible approach that works with any template layout.',
    parameters: {
      type: 'object',
      properties: {
        template_id: {
          type: 'string',
          description: 'The template ID to use',
        },
        model_name: {
          type: 'string',
          description: 'Name for the new model (e.g., "Apple DCF - Jan 2024")',
        },
      },
      required: ['template_id', 'model_name'],
    },
  },
}

export async function executeCreateModelFromTemplate(
  args: { template_id: string; model_name: string },
  setCurrentSpreadsheetId: (id: string) => void
): Promise<FunctionResult> {
  const template = getTemplate(args.template_id)

  if (!template) {
    return {
      result: `Template ${args.template_id} not found`,
      success: false,
    }
  }

  try {
    const authClient = getOAuth2Client()

    // Copy template to new spreadsheet
    const { newSpreadsheetId, newWebViewLink } = await copyTemplateDrive(
      template.driveFileId,
      args.model_name,
      authClient
    )

    // Create run record
    const run: TemplateRun = {
      runId: randomUUID(),
      templateId: template.templateId,
      templateName: template.name,
      spreadsheetId: newSpreadsheetId,
      spreadsheetUrl: newWebViewLink,
      spreadsheetName: args.model_name,
      inputs: {},
      outputs: {},
      createdAt: Date.now(),
      createdBy: 'llm',
      status: 'draft',
    }

    saveTemplateRun(run)

    // Update template usage stats
    updateTemplate(template.templateId, {
      lastUsed: Date.now(),
      usageCount: template.usageCount + 1,
    })

    // Set as current spreadsheet
    setCurrentSpreadsheetId(newSpreadsheetId)

    return {
      result: `✓ Created model "${args.model_name}" from template "${template.name}"

Spreadsheet: ${newWebViewLink}
Run ID: ${run.runId}

RECOMMENDED WORKFLOW:
1. Use get_sheet_preview(sheetName="...") to see the template structure
2. Use search_cells(query="Revenue") to find input cells (search for common terms like "Revenue", "WACC", "Growth", etc.)
3. Query datasets for the company data you need
4. Use write_range(a1Range="Sheet1!B5", values=[[...]]) to fill in the template with data
5. Use read_range to read calculated outputs

This flexible approach works with any template layout, not just templates with predefined named ranges.`,
      success: true,
    }
  } catch (err: any) {
    return {
      result: `Failed to create model: ${err.message}`,
      success: false,
    }
  }
}

/**
 * Tool 4: set_template_inputs
 */
export const setTemplateInputsDefinition: FunctionDefinition = {
  type: 'function',
  function: {
    name: 'set_template_inputs',
    description:
      '[LEGACY - Use write_range instead] Set input values using named ranges. This only works if the template has predefined named ranges. For most templates, use get_sheet_preview to understand structure, search_cells to find input cells, then write_range to fill them. CRITICAL: All percentage inputs must be decimals (0.10 = 10%).',
    parameters: {
      type: 'object',
      properties: {
        run_id: {
          type: 'string',
          description: 'The run ID (from create_model_from_template)',
        },
        inputs: {
          type: 'object',
          description:
            'Input values keyed by named range. Example: {"wacc": 0.10, "terminal_growth": 0.025, "company_name": "Apple Inc"}',
          additionalProperties: true,
        },
      },
      required: ['run_id', 'inputs'],
    },
  },
}

export async function executeSetTemplateInputs(args: {
  run_id: string
  inputs: Record<string, any>
}): Promise<FunctionResult> {
  const run = getTemplateRun(args.run_id)

  if (!run) {
    return {
      result: `Run ${args.run_id} not found`,
      success: false,
    }
  }

  const template = getTemplate(run.templateId)
  if (!template) {
    return {
      result: `Template ${run.templateId} not found`,
      success: false,
    }
  }

  // Validate inputs
  const errors: string[] = []

  for (const [key, value] of Object.entries(args.inputs)) {
    // Check if range exists in template
    if (!template.requiredInputs.includes(key) && !template.optionalInputs.includes(key)) {
      errors.push(`Unknown input range: ${key}`)
      continue
    }

    // Type validation
    if (typeof value !== 'number' && typeof value !== 'string') {
      errors.push(`${key}: Invalid type (must be number or string)`)
      continue
    }

    if (typeof value === 'number') {
      // Percentage validation
      if (template.validationRules.percentageInputs.includes(key)) {
        if (value < 0 || value > 1) {
          errors.push(`${key}: Percentage must be 0-1 (got ${value})`)
        }
      }

      // Positive validation
      if (template.validationRules.positiveInputs.includes(key)) {
        if (value <= 0) {
          errors.push(`${key}: Must be positive (got ${value})`)
        }
      }

      // Integer validation
      if (template.validationRules.integerInputs.includes(key)) {
        if (!Number.isInteger(value)) {
          errors.push(`${key}: Must be integer (got ${value})`)
        }
      }
    }
  }

  if (errors.length > 0) {
    return {
      result: `Validation errors:\n${errors.map((e) => `• ${e}`).join('\n')}`,
      success: false,
    }
  }

  try {
    const authClient = getOAuth2Client()

    // Set inputs in spreadsheet
    const result = await setTemplateInputsDrive(run.spreadsheetId, args.inputs, authClient)

    if (!result.success) {
      return {
        result: `Failed to set inputs:\n${result.errors.join('\n')}`,
        success: false,
      }
    }

    // Update run record
    updateTemplateRun(run.runId, {
      inputs: { ...run.inputs, ...args.inputs },
    })

    // Check if all required inputs are now set
    const allInputs = { ...run.inputs, ...args.inputs }
    const missingRequired = template.requiredInputs.filter((r) => !(r in allInputs))

    let statusMsg = `✓ Set ${Object.keys(args.inputs).length} input(s) in "${run.spreadsheetName}"`

    if (missingRequired.length > 0) {
      statusMsg += `\n\n⚠️  Still missing required inputs: ${missingRequired.join(', ')}`
    } else {
      statusMsg += `\n\n✓ All required inputs set. Model is ready to calculate.`
      updateTemplateRun(run.runId, { status: 'complete' })
    }

    return {
      result: statusMsg,
      success: true,
    }
  } catch (err: any) {
    return {
      result: `Failed to set inputs: ${err.message}`,
      success: false,
    }
  }
}

/**
 * Tool 5: read_template_outputs
 */
export const readTemplateOutputsDefinition: FunctionDefinition = {
  type: 'function',
  function: {
    name: 'read_template_outputs',
    description: '[LEGACY - Use read_range instead] Read output values using named ranges. This only works if template has predefined output ranges. For most templates, use search_cells to find output cells (search for "Valuation", "NPV", "IRR", etc.), then use read_range to read them.',
    parameters: {
      type: 'object',
      properties: {
        run_id: {
          type: 'string',
          description: 'The run ID',
        },
        output_ranges: {
          type: 'array',
          items: { type: 'string' },
          description: 'Named ranges to read (default: all output ranges from template)',
        },
      },
      required: ['run_id'],
    },
  },
}

export async function executeReadTemplateOutputs(args: {
  run_id: string
  output_ranges?: string[]
}): Promise<FunctionResult> {
  const run = getTemplateRun(args.run_id)

  if (!run) {
    return {
      result: `Run ${args.run_id} not found`,
      success: false,
    }
  }

  const template = getTemplate(run.templateId)
  if (!template) {
    return {
      result: `Template ${run.templateId} not found`,
      success: false,
    }
  }

  try {
    const authClient = getOAuth2Client()

    const rangesToRead = args.output_ranges || template.outputRanges

    const outputs = await readTemplateOutputsDrive(run.spreadsheetId, rangesToRead, authClient)

    // Update run record
    updateTemplateRun(run.runId, {
      outputs: { ...run.outputs, ...outputs },
    })

    // Format output
    const formatted = Object.entries(outputs)
      .map(([key, value]) => {
        let displayValue: any = value
        if (typeof value === 'number') {
          // Format based on range name
          if (key.includes('price')) {
            displayValue = `$${value.toFixed(2)}`
          } else if (key.includes('value')) {
            displayValue = `$${(value / 1000000).toFixed(1)}M`
          } else if (key.includes('pct') || key.includes('percent')) {
            displayValue = `${(value * 100).toFixed(1)}%`
          } else {
            displayValue = value.toFixed(2)
          }
        }
        return `  ${key}: ${displayValue}`
      })
      .join('\n')

    return {
      result: `Outputs from "${run.spreadsheetName}":\n\n${formatted}\n\nSpreadsheet: ${run.spreadsheetUrl}`,
      success: true,
    }
  } catch (err: any) {
    return {
      result: `Failed to read outputs: ${err.message}`,
      success: false,
    }
  }
}

/**
 * Get all template tool definitions
 */
export function getTemplateToolDefinitions(): FunctionDefinition[] {
  return [
    listTemplatesDefinition,
    describeTemplateDefinition,
    createModelFromTemplateDefinition,
    setTemplateInputsDefinition,
    readTemplateOutputsDefinition,
  ]
}

/**
 * Execute a template tool by name
 */
export async function executeTemplateTool(
  toolName: string,
  args: any,
  setCurrentSpreadsheetId: (id: string) => void
): Promise<FunctionResult> {
  switch (toolName) {
    case 'list_templates':
      return executeListTemplates(args)
    case 'describe_template':
      return executeDescribeTemplate(args)
    case 'create_model_from_template':
      return executeCreateModelFromTemplate(args, setCurrentSpreadsheetId)
    case 'set_template_inputs':
      return executeSetTemplateInputs(args)
    case 'read_template_outputs':
      return executeReadTemplateOutputs(args)
    default:
      return {
        result: `Unknown template tool: ${toolName}`,
        success: false,
      }
  }
}
