import { parseFormXml, parseListXml } from '@odooseek/odoo-client'
import { describe, expect, test } from 'vitest'

describe('parseListXml', () => {
  test('parses simple list view with fields', () => {
    const xml = `<list string="Contacts">
      <field name="name"/>
      <field name="email"/>
      <field name="phone" optional="show"/>
    </list>`

    const result = parseListXml(xml)

    expect(result.type).toBe('list')
    expect(result.string).toBe('Contacts')
    expect(result.columns).toHaveLength(3)
    expect(result.columns[0]).toMatchObject({ name: 'name' })
    expect(result.columns[1]).toMatchObject({ name: 'email' })
  })

  test('parses editable and create/delete attributes', () => {
    const xml = '<list string="Orders" editable="top" create="false">\n<field name="id"/>\n</list>'

    const result = parseListXml(xml)

    expect(result.editable).toBe('top')
    expect(result.create).toBe(false)
  })

  test('handles empty list gracefully', () => {
    const xml = '<list string="Empty"/>'

    const result = parseListXml(xml)

    expect(result.columns).toHaveLength(0)
  })
})

describe('parseFormXml', () => {
  test('parses form with sheet, group, and fields', () => {
    const xml = `<form string="Partner">
      <sheet>
        <group string="Basic Info" col="2">
          <field name="name"/>
          <field name="email" required="true"/>
          <field name="company_id" nolabel="1"/>
        </group>
        <separator string="More"/>
        <field name="phone"/>
      </sheet>
    </form>`

    const result = parseFormXml(xml)

    expect(result.type).toBe('form')
    expect(result.string).toBe('Partner')

    const sheet = result.elements[0]
    expect(sheet.type).toBe('sheet')

    const group = (sheet as { type: 'sheet'; elements: typeof result.elements }).elements[0]
    expect(group.type).toBe('group')
    expect((group as { string?: string }).string).toBe('Basic Info')

    const fields = (group as { elements: { type: string; name?: string }[] }).elements
    expect(fields[0]).toMatchObject({ type: 'field', name: 'name' })
    expect(fields[1]).toMatchObject({ name: 'email', required: 'true' })
    expect(fields[2]).toMatchObject({ name: 'company_id', nolabel: true })
  })

  test('parses hr_org_chart field inside layout div', () => {
    const xml = `<form string="Employee">
      <sheet>
        <div id="o_employee_right">
          <field name="child_ids" widget="hr_org_chart" nolabel="1"/>
        </div>
      </sheet>
    </form>`

    const result = parseFormXml(xml)
    const sheet = result.elements[0] as {
      type: 'sheet'
      elements: { type: string; name?: string; widget?: string }[]
    }
    const orgField = sheet.elements.find((e) => e.type === 'field' && e.name === 'child_ids')
    expect(orgField).toMatchObject({ type: 'field', name: 'child_ids', widget: 'hr_org_chart' })
  })

  test('parses notebook with pages', () => {
    const xml = `<form string="Product">
      <notebook>
        <page string="General">
          <field name="name"/>
        </page>
        <page string="Sales">
          <field name="price"/>
        </page>
      </notebook>
    </form>`

    const result = parseFormXml(xml)

    const notebook = result.elements[0]
    expect(notebook.type).toBe('notebook')

    const pages = (notebook as { pages: { string: string; elements: { type: string }[] }[] }).pages
    expect(pages).toHaveLength(2)
    expect(pages[0].string).toBe('General')
    expect(pages[1].string).toBe('Sales')
  })
})
