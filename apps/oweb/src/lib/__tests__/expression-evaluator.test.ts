import { describe, expect, test } from 'vitest'
import { evalCondition, getValue } from '../../lib/expression-evaluator'
import type { KanbanTemplateNode } from '../../lib/odoo-types'
import { parseKanbanTemplate } from '../../lib/xml-parser'

describe('parseKanbanTemplate', () => {
  test('parses simple field elements', () => {
    const xml = `<templates>
      <t t-name="card">
        <field name="name"/>
        <field name="expected_revenue" widget="monetary"/>
      </t>
    </templates>`

    const nodes = parseKanbanTemplate(xml)
    expect(nodes).toHaveLength(2) // transparent <t> flattened → 2 fields

    expect(nodes[0]).toMatchObject({ type: 'field', name: 'name' })
    expect(nodes[1]).toMatchObject({ type: 'field', name: 'expected_revenue', widget: 'monetary' })
  })

  test('parses t-if condition', () => {
    const xml = `<template>
      <field name="name"/>
      <t t-if="record.expected_revenue">
        <field name="expected_revenue" widget="monetary"/>
      </t>
    </template>`

    const nodes = parseKanbanTemplate(xml)
    expect(nodes).toHaveLength(2)
    expect(nodes[0]).toMatchObject({ type: 'field', name: 'name' })
    expect(nodes[1]).toMatchObject({ type: 'condition', if: 'record.expected_revenue' })

    const cond = nodes[1] as KanbanTemplateNode & {
      type: 'condition'
      children: KanbanTemplateNode[]
    }
    expect(cond.children).toHaveLength(1)
    expect(cond.children[0]).toMatchObject({
      type: 'field',
      name: 'expected_revenue',
      widget: 'monetary',
    })
  })

  test('parses t-elif / t-else chains', () => {
    const xml = `<template>
      <t t-if="record.type == 'opportunity'">
        <field name="expected_revenue"/>
      </t>
      <t t-elif="record.type == 'lead'">
        <field name="contact_name"/>
      </t>
      <t t-else="">
        <field name="name"/>
      </t>
    </template>`

    const nodes = parseKanbanTemplate(xml)
    expect(nodes).toHaveLength(1) // single chain
    expect(nodes[0]).toMatchObject({ type: 'condition', if: "record.type == 'opportunity'" })

    const root = nodes[0] as KanbanTemplateNode & {
      type: 'condition'
      children: KanbanTemplateNode[]
    }
    // First child is the field, second is the elif, third is the else
    expect(root.children).toHaveLength(3)
    expect(root.children[0]).toMatchObject({ type: 'field', name: 'expected_revenue' })
    expect(root.children[1]).toMatchObject({ type: 'condition', elif: "record.type == 'lead'" })
    expect(root.children[2]).toMatchObject({ type: 'condition', else: '' })
  })

  test('parses t-foreach loop', () => {
    const xml = `<template>
      <t t-foreach="record.tag_ids" t-as="tag">
        <span t-out="tag[1]"/>
      </t>
    </template>`

    const nodes = parseKanbanTemplate(xml)
    expect(nodes).toHaveLength(1)
    expect(nodes[0]).toMatchObject({ type: 'loop', foreach: 'record.tag_ids', as: 'tag' })

    const loop = nodes[0] as KanbanTemplateNode & { type: 'loop'; children: KanbanTemplateNode[] }
    expect(loop.children).toHaveLength(1)
    expect(loop.children[0]).toMatchObject({ type: 'output', expr: 'tag[1]' })
  })

  test('parses footer separately', () => {
    const xml = `<template>
      <field name="name"/>
      <footer>
        <field name="priority" widget="priority"/>
      </footer>
    </template>`

    const nodes = parseKanbanTemplate(xml)
    expect(nodes).toHaveLength(2)
    expect(nodes[1]).toMatchObject({ type: 'footer' })

    const footer = nodes[1] as KanbanTemplateNode & {
      type: 'footer'
      children: KanbanTemplateNode[]
    }
    expect(footer.children).toHaveLength(1)
    expect(footer.children[0]).toMatchObject({
      type: 'field',
      name: 'priority',
      widget: 'priority',
    })
  })
})

describe('evalCondition', () => {
  test('evaluates truthy record field', () => {
    const record = { expected_revenue: 5000, name: 'Test' }
    expect(evalCondition('record.expected_revenue', record)).toBe(true)
    expect(evalCondition('record.name', record)).toBe(true)
  })

  test('evaluates falsy record field', () => {
    const record = { expected_revenue: 0, contact_name: false }
    expect(evalCondition('record.expected_revenue', record)).toBe(false)
    expect(evalCondition('record.contact_name', record)).toBe(false)
  })

  test('evaluates negation', () => {
    const record = { active: false }
    expect(evalCondition('!record.active', record)).toBe(true)
  })

  test('evaluates AND expressions', () => {
    const record = { a: 1, b: 2 }
    expect(evalCondition('record.a && record.b', record)).toBe(true)
    expect(evalCondition('record.a && record.c', record)).toBe(false)
  })

  test('evaluates OR expressions', () => {
    const record = { a: 1, b: 0 }
    expect(evalCondition('record.a || record.b', record)).toBe(true)
    expect(evalCondition('record.c || record.d', record)).toBe(false)
  })
})

describe('getValue', () => {
  test('gets record field', () => {
    expect(getValue('record.name', { name: 'Test' })).toBe('Test')
  })

  test('gets array index for many2one', () => {
    expect(getValue('record.stage_id[0]', { stage_id: [1, 'New'] })).toBe(1)
    expect(getValue('record.stage_id[1]', { stage_id: [1, 'New'] })).toBe('New')
  })

  test('returns undefined for missing field', () => {
    expect(getValue('record.nonexistent', { name: 'Test' })).toBeUndefined()
  })
})
