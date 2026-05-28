import { describe, expect, test } from 'vitest'
import {
  parseFormXml,
  parseKanbanXml,
  parseListXml,
  parsePivotXml,
  parseSearchXml,
} from '../../lib/xml-parser'

describe('parseListXml', () => {
  test('parses basic list fields', () => {
    const xml = `<list string="Partners">
      <field name="name"/>
      <field name="email"/>
    </list>`

    const result = parseListXml(xml)
    expect(result.type).toBe('list')
    expect(result.string).toBe('Partners')
    expect(result.columns).toHaveLength(2)
    expect(result.columns[0].name).toBe('name')
    expect(result.columns[1].name).toBe('email')
  })

  test('parses editable attribute', () => {
    const xml = `<list string="Items" editable="bottom">
      <field name="name"/>
    </list>`

    const result = parseListXml(xml)
    expect(result.editable).toBe('bottom')
    expect(result.create).toBe(true)
    expect(result.delete).toBe(true)
  })

  test('handles empty list', () => {
    const xml = `<list/>`

    const result = parseListXml(xml)
    expect(result.type).toBe('list')
    expect(result.string).toBe('')
    expect(result.columns).toHaveLength(0)
  })

  test('parses decoration attributes', () => {
    const xml = `<list decoration-bf="state=='draft'" decoration-danger="state=='cancel'">
      <field name="name"/>
    </list>`

    const result = parseListXml(xml)
    expect(result.decorations).toHaveProperty('decoration_bf', "state=='draft'")
    expect(result.decorations).toHaveProperty('decoration_danger', "state=='cancel'")
  })
})

describe('parseFormXml', () => {
  test('parses basic form with sheet', () => {
    const xml = `<form string="Partner">
      <sheet>
        <field name="name"/>
        <field name="email"/>
      </sheet>
    </form>`

    const result = parseFormXml(xml)
    expect(result.type).toBe('form')
    expect(result.string).toBe('Partner')
    expect(result.elements).toHaveLength(1)
    expect(result.elements[0].type).toBe('sheet')

    const sheet = result.elements[0] as { type: 'sheet'; elements: unknown[] }
    expect(sheet.elements).toHaveLength(2)
  })

  test('parses notebook with pages', () => {
    const xml = `<form string="Partner">
      <sheet>
        <notebook>
          <page string="Details">
            <field name="name"/>
          </page>
          <page string="Extra">
            <field name="email"/>
          </page>
        </notebook>
      </sheet>
    </form>`

    const result = parseFormXml(xml)
    const sheet = result.elements[0] as {
      type: 'sheet'
      elements: { type: 'notebook'; pages: { string: string }[] }[]
    }
    const notebook = sheet.elements[0]
    expect(notebook.type).toBe('notebook')
    expect(notebook.pages).toHaveLength(2)
    expect(notebook.pages[0].string).toBe('Details')
    expect(notebook.pages[1].string).toBe('Extra')
  })

  test('parses field readonly and invisible attributes', () => {
    const xml = `<form><sheet><field name="state" readonly="1" invisible="0"/></sheet></form>`

    const result = parseFormXml(xml)
    const sheet = result.elements[0] as {
      type: 'sheet'
      elements: { type: 'field'; name: string; readonly: boolean; invisible: number }[]
    }
    const field = sheet.elements[0]
    expect(field.type).toBe('field')
    expect(field.name).toBe('state')
    expect(field.readonly).toBe(true)
    expect(field.invisible).toBe(0)
  })

  test('parses group with col attribute', () => {
    const xml = `<form><group col="4"><field name="a"/></group></form>`

    const result = parseFormXml(xml)
    const group = result.elements[0] as {
      type: 'group'
      col: number
      elements: unknown[]
    }
    expect(group.type).toBe('group')
    expect(group.col).toBe(4)
    expect(group.elements).toHaveLength(1)
  })
})

describe('parseSearchXml', () => {
  test('parses search fields with name and operator', () => {
    const xml = `<search>
      <field name="name" string="Name"/>
      <field name="email" operator="ilike"/>
    </search>`

    const result = parseSearchXml(xml)
    expect(result.type).toBe('search')
    expect(result.fields).toHaveLength(2)
    expect(result.fields[0].name).toBe('name')
    expect(result.fields[0].string).toBe('Name')
    expect(result.fields[1].name).toBe('email')
    expect(result.fields[1].operator).toBe('ilike')
  })

  test('parses filters with domain', () => {
    const xml = `<search>
      <filter name="draft" string="Draft" domain="[('state','=','draft')]"/>
    </search>`

    const result = parseSearchXml(xml)
    expect(result.filters).toHaveLength(1)
    expect(result.filters[0].name).toBe('draft')
    expect(result.filters[0].domain).toEqual([['state', '=', 'draft']])
  })

  test('parses groupBy filters from context', () => {
    const xml = `<search>
      <filter name="group_stage" string="Stage" context="{'group_by': 'stage_id'}"/>
    </search>`

    const result = parseSearchXml(xml)
    expect(result.groupByFilters).toHaveLength(1)
    expect(result.groupByFilters[0].fieldName).toBe('stage_id')
    expect(result.groupByFilters[0].name).toBe('group_stage')
  })

  test('parses groupBy with interval', () => {
    const xml = `<search>
      <filter name="group_month" string="Month" context="{'group_by': 'create_date:month'}"/>
    </search>`

    const result = parseSearchXml(xml)
    expect(result.groupByFilters).toHaveLength(1)
    expect(result.groupByFilters[0].fieldName).toBe('create_date')
    expect(result.groupByFilters[0].interval).toBe('month')
  })

  test('skips filters with unparseable domain', () => {
    const xml = `<search>
      <filter name="my_filter" string="My" domain="[('user_id','=',uid)]"/>
    </search>`

    const result = parseSearchXml(xml)
    expect(result.filters).toHaveLength(0)
  })

  test('handles empty search', () => {
    const xml = `<search/>`

    const result = parseSearchXml(xml)
    expect(result.fields).toEqual([])
    expect(result.filters).toEqual([])
    expect(result.groupByFilters).toEqual([])
  })
})

describe('parseKanbanXml', () => {
  test('parses kanban fields and default_group_by', () => {
    const xml = `<kanban default_group_by="stage_id" highlight_color="color">
      <field name="name"/>
      <templates><t t-name="card"><field name="name"/></t></templates>
    </kanban>`

    const result = parseKanbanXml(xml)
    expect(result.type).toBe('kanban')
    expect(result.fields).toContain('name')
    expect(result.defaultGroupBy).toBe('stage_id')
    expect(result.highlightColor).toBe('color')
  })

  test('handles kanban without templates', () => {
    const xml = `<kanban string="Items"><field name="name"/></kanban>`

    const result = parseKanbanXml(xml)
    expect(result.template).toBe('')
    expect(result.templateNodes).toBeUndefined()
  })

  test('extracts multiple fields', () => {
    const xml = `<kanban>
      <field name="name"/>
      <field name="email"/>
      <field name="phone"/>
    </kanban>`

    const result = parseKanbanXml(xml)
    expect(result.fields).toHaveLength(3)
    expect(result.fields).toEqual(expect.arrayContaining(['name', 'email', 'phone']))
  })

  test('parses kanban without default_group_by', () => {
    const xml = `<kanban string="Simple"><field name="name"/></kanban>`

    const result = parseKanbanXml(xml)
    expect(result.defaultGroupBy).toBeUndefined()
  })
})

describe('parsePivotXml', () => {
  test('parses row, col, and measure fields', () => {
    const xml = `<pivot>
      <field name="stage_id" type="row"/>
      <field name="create_date" type="col" interval="month"/>
      <field name="amount" type="measure" operator="sum"/>
    </pivot>`

    const result = parsePivotXml(xml)
    expect(result.type).toBe('pivot')
    expect(result.rowFields).toHaveLength(1)
    expect(result.rowFields[0].name).toBe('stage_id')
    expect(result.colFields).toHaveLength(1)
    expect(result.colFields[0].interval).toBe('month')
    expect(result.measures).toHaveLength(1)
    expect(result.measures[0].operator).toBe('sum')
  })

  test('adds default __count measure when no measures defined', () => {
    const xml = `<pivot><field name="stage_id" type="row"/></pivot>`

    const result = parsePivotXml(xml)
    expect(result.measures).toEqual([{ name: '__count', string: 'Count' }])
  })

  test('handles empty pivot', () => {
    const xml = `<pivot string="Empty"/>`

    const result = parsePivotXml(xml)
    expect(result.rowFields).toEqual([])
    expect(result.colFields).toEqual([])
    expect(result.measures).toEqual([{ name: '__count', string: 'Count' }])
  })

  test('parses pivot string and disable_linking', () => {
    const xml = `<pivot string="Analysis" disable_linking="1"><field name="x" type="row"/></pivot>`

    const result = parsePivotXml(xml)
    expect(result.string).toBe('Analysis')
    expect(result.disableLinking).toBe(true)
  })

  test('parses multiple row fields', () => {
    const xml = `<pivot>
      <field name="a" type="row"/>
      <field name="b" type="row"/>
    </pivot>`

    const result = parsePivotXml(xml)
    expect(result.rowFields).toHaveLength(2)
    expect(result.rowFields[0].name).toBe('a')
    expect(result.rowFields[1].name).toBe('b')
  })
})
