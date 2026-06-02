import { parseActivityXml } from '@odooseek/odoo-client/xml-parser'
import { describe, expect, test } from 'vitest'

describe('OdooActivityRenderer helpers', () => {
  test('parseActivityXml matches HR employee arch shape', () => {
    const arch = `<activity string="Employees">
      <field name="id"/>
      <templates>
        <div t-name="activity-box">
          <field name="name" class="fw-bold fs-5"/>
          <field name="job_id" class="o_text_block"/>
        </div>
      </templates>
    </activity>`
    const parsed = parseActivityXml(arch)
    expect(parsed.boxFields).toHaveLength(2)
    expect(parsed.fields).toContain('id')
  })
})
