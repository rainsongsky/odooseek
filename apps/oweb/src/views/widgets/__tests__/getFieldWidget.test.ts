import type { FieldElement } from '@odooseek/odoo-client'
import { describe, expect, test } from 'vitest'
import {
  BadgeWidget,
  getFieldWidget,
  OrgChartWidget,
  PresenceIcon,
  VersionTimeline,
} from '../index'

function field(widget?: string): FieldElement {
  return { type: 'field', name: 'x', widget }
}

describe('getFieldWidget', () => {
  test('resolves HR widget aliases', () => {
    expect(getFieldWidget(field('hr_org_chart'), 'char')).toBe(OrgChartWidget)
    expect(getFieldWidget(field('hr_presence_status'), 'char')).toBe(PresenceIcon)
    expect(getFieldWidget(field('hr_version_timeline'), 'char')).toBe(VersionTimeline)
    expect(getFieldWidget(field('versions_timeline'), 'char')).toBe(VersionTimeline)
    expect(getFieldWidget(field('employee_badge'), 'char')).toBe(BadgeWidget)
  })

  test('resolves direct widget overrides', () => {
    expect(getFieldWidget(field('org_chart'), 'char')).toBe(OrgChartWidget)
    expect(getFieldWidget(field('badge_print'), 'char')).toBe(BadgeWidget)
  })

  test('falls back to type widget', () => {
    const Widget = getFieldWidget(field(undefined), 'integer')
    expect(Widget).toBeDefined()
    expect(Widget).not.toBe(OrgChartWidget)
  })
})
