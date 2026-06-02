import { describe, expect, test } from 'vitest'
import { HR_WIZARD_STEPS } from '../hr-wizards'
import { enrichWizardContext, wizardValuesToWrite } from '../wizard-context'

describe('HR_WIZARD_STEPS (Odoo 19)', () => {
  test('departure wizard matches form arch fields (excl. employee_ids)', () => {
    expect(HR_WIZARD_STEPS['hr.departure.wizard'][0].fields).toEqual([
      'departure_reason_id',
      'departure_date',
      'set_date_end',
      'remove_related_user',
      'departure_description',
    ])
    expect(HR_WIZARD_STEPS['hr.departure.wizard'][0].buttons.map((b) => b.name)).toContain(
      'action_register_departure',
    )
  })

  test('version wizard only asks for contract_template_id', () => {
    expect(HR_WIZARD_STEPS['hr.version.wizard'][0].fields).toEqual(['contract_template_id'])
    expect(HR_WIZARD_STEPS['hr.version.wizard'][0].buttons.map((b) => b.name)).toContain(
      'action_load_template',
    )
  })

  test('bank allocation uses action_save', () => {
    expect(
      HR_WIZARD_STEPS['hr.bank.account.allocation.wizard'][0].buttons.map((b) => b.name),
    ).toContain('action_save')
  })
})

describe('enrichWizardContext', () => {
  test('adds default_employee_id from active employee', () => {
    expect(
      enrichWizardContext({ active_model: 'hr.employee', active_id: 42, active_ids: [42] }),
    ).toMatchObject({ default_employee_id: 42 })
  })
})

describe('wizardValuesToWrite', () => {
  test('coerces many2one ids to numbers', () => {
    expect(
      wizardValuesToWrite(
        { departure_reason_id: '3' },
        { departure_reason_id: { type: 'many2one' } },
      ),
    ).toEqual({ departure_reason_id: 3 })
  })
})
