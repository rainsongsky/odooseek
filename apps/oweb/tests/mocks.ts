import { vi } from 'vitest'

export function mockFetchResponse(result: unknown, ok = true, status = 200) {
  return vi.fn().mockResolvedValue({
    ok,
    status,
    json: () =>
      Promise.resolve(
        ok ? { jsonrpc: '2.0', id: 1, result } : { jsonrpc: '2.0', id: 1, error: result },
      ),
    headers: new Headers(),
  })
}

export function mockFetchError(message: string, status = 500) {
  return vi.fn().mockResolvedValue({
    ok: false,
    status,
    statusText: message,
    json: () => Promise.resolve({}),
    headers: new Headers(),
  })
}

export const FIXTURES = {
  listXml: `<list string="Contacts" editable="top">
    <field name="name"/>
    <field name="email"/>
    <field name="phone"/>
  </list>`,
  listWithDecorations: `<list string="Orders" decoration-bf="state=='draft'" decoration-danger="state=='cancel'">
    <field name="name"/>
    <field name="state" decoration-success="state=='done'"/>
  </list>`,
  formXml: `<form string="Partner">
    <sheet>
      <group string="Info" col="2">
        <field name="name" required="1"/>
        <field name="email" placeholder="Enter email"/>
        <field name="state" readonly="1"/>
      </group>
      <notebook>
        <page string="Details">
          <field name="notes"/>
        </page>
      </notebook>
    </sheet>
  </form>`,
  formEmpty: '<form string="Empty"></form>',
  kanbanXml: `<kanban string="Leads" default_group_by="stage_id" highlight_color="color">
    <field name="name"/>
    <field name="expected_revenue"/>
    <templates>
      <t t-name="card">
        <field name="name"/>
      </t>
    </templates>
  </kanban>`,
  kanbanNoTemplate: `<kanban string="Items">
    <field name="name"/>
  </kanban>`,
  searchXml: `<search string="Search Leads">
    <field name="name" string="Name"/>
    <field name="email" operator="ilike"/>
    <filter name="draft" string="Draft" domain="[('state','=','draft')]"/>
    <filter name="group_stage" string="Stage" context="{'group_by': 'stage_id'}"/>
    <filter name="group_month" string="Month" context="{'group_by': 'create_date:month'}"/>
    <separator/>
    <filter name="my_leads" string="My Leads" domain="[('user_id','=',uid)]"/>
  </search>`,
  searchEmpty: '<search string="Empty"/>',
  pivotXml: `<pivot string="Pipeline Analysis">
    <field name="stage_id" type="row"/>
    <field name="create_date" type="col" interval="month"/>
    <field name="expected_revenue" type="measure" operator="sum"/>
  </pivot>`,
  pivotNoMeasure: `<pivot string="Count Only">
    <field name="stage_id" type="row"/>
  </pivot>`,
  pivotEmpty: '<pivot string="Empty Pivot"/>',
}
