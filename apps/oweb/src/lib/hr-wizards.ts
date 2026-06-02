import type { WizardStep } from '../components/WizardDialog'

/**
 * HR transient wizard steps aligned with Odoo 19 form views (docker odoo19).
 * `employee_ids` / `employee_id` are filled from wizard context on create — not listed here.
 */
export const HR_WIZARD_STEPS: Record<string, WizardStep[]> = {
  'hr.departure.wizard': [
    {
      title: 'Departure',
      fields: [
        'departure_reason_id',
        'departure_date',
        'set_date_end',
        'remove_related_user',
        'departure_description',
      ],
      buttons: [
        { label: 'Cancel', name: 'cancel', type: 'object', special: 'cancel' },
        { label: 'Apply', name: 'action_register_departure', type: 'object' },
      ],
    },
  ],
  'hr.bank.account.allocation.wizard': [
    {
      title: 'Salary allocation',
      // employee_id from context; allocation_ids requires inline one2many (future)
      fields: [],
      buttons: [
        { label: 'Cancel', name: 'cancel', type: 'object', special: 'cancel' },
        { label: 'Save', name: 'action_save', type: 'object' },
      ],
    },
  ],
  'hr.version.wizard': [
    {
      title: 'Contract template',
      fields: ['contract_template_id'],
      buttons: [
        { label: 'Cancel', name: 'cancel', type: 'object', special: 'cancel' },
        { label: 'Load', name: 'action_load_template', type: 'object' },
      ],
    },
  ],
}
