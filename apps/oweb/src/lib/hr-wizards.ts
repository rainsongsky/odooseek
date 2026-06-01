import type { WizardStep } from '../components/WizardDialog'

/** Minimal step definitions for HR transient wizards (expand when arch is wired). */
export const HR_WIZARD_STEPS: Record<string, WizardStep[]> = {
  'hr.departure.wizard': [
    {
      title: 'Departure',
      fields: ['departure_reason_id', 'departure_description', 'departure_date'],
      buttons: [
        { label: 'Cancel', name: 'cancel', type: 'object', special: 'cancel' },
        { label: 'Apply', name: 'action_register_departure', type: 'object' },
      ],
    },
  ],
  'hr.bank.account.allocation.wizard': [
    {
      title: 'Salary allocation',
      fields: ['employee_id'],
      buttons: [
        { label: 'Cancel', name: 'cancel', type: 'object', special: 'cancel' },
        { label: 'Save', name: 'action_save', type: 'object' },
      ],
    },
  ],
  'hr.version.wizard': [
    {
      title: 'Contract template',
      fields: ['employee_id', 'contract_template_id'],
      buttons: [
        { label: 'Cancel', name: 'cancel', type: 'object', special: 'cancel' },
        { label: 'Load', name: 'action_load_template', type: 'object' },
      ],
    },
  ],
}
